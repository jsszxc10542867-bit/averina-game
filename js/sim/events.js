// 세계 사건 (통합 명세 28~30절). 퀘스트로 보여 주지 않는다. 한 번 일어나면 흔적과 기억과 소문이 남는다.
// W.events = { log: [사건], active: { 'missing:lia': {...} }, scheduled: [{ at, type, done }] }
const WorldEvents = (() => {
  // 수색대가 숲을 뒤지는 순서
  const SEARCH_PLAN = ['edge', 'hollow', 'stream', 'downstream', 'clearing', 'deep', 'hill'];

  function initialSchedule() {
    return [{ at: Time.at(2, 6), type: 'lia_wounded', done: false }];
  }

  // 그 장소에서 보고 있던 사람들
  function witnessesAt(W, loc) {
    const w = Npc.here(W, loc).map((n) => n.id);
    if (W.player.loc === loc && W.player.hp > 0) w.push('player');
    return w;
  }

  function record(S, type, o = {}) {
    const { W } = S;
    const loc = o.loc || null;
    const ev = {
      id: `e-${++W.seq}`, type, t: W.time.t, loc,
      actors: o.actors || [], witnesses: o.witnesses || (loc ? witnessesAt(W, loc) : []),
      data: o.data || {}, distant: !!o.distant,
    };
    W.events.log.push(ev);
    if (W.events.log.length > 400) W.events.log.shift();
    Bus.emit(S, 'WORLD_EVENT_CREATED', { eventId: ev.id, kind: type, loc, witnesses: ev.witnesses });
    return ev;
  }

  // ---------- 정해진 사건 (이야기의 뼈대) ----------
  const SCRIPTED = {
    // 둘째 날 새벽, 숲 깊은 곳. 리아가 무언가에게 습격당하고 움푹한 곳으로 피한다. 플레이어는 보지 못한다.
    lia_wounded(S) {
      const { W } = S;
      const lia = W.npcs.lia;
      if (!lia || !lia.alive) return;
      const beast = W.creatures.thornback;
      if (beast && beast.alive) beast.loc = 'deepwood';
      if (lia.location.loc !== 'deepwood' || lia.location.transit) Npc.place(S, lia, 'deepwood');
      Npc.injure(S, lia, { health: 45, bleed: 1 / 12, pain: 75, shock: 100, kind: 'claw', by: 'thornback', cause: '짐승에게 습격당했다' });
      lia.mental.fear = 70;
      lia.needs.hunger = Math.max(lia.needs.hunger, 60);
      Memory.add(S, lia, { type: 'attacked_by', subject: 'thornback' });
      Places.addTrace(W, 'deepwood', 'blood');
      Places.addTrace(W, 'deepwood', 'struggle');
      // [제안 · 스토리 확인 필요] 습격 때 약초 주머니를 잃는다. 약초꾼의 제자가 약초를 지닌 채면 곧바로 스스로 피를 멎게 해서,
      // 피 흘리는 채로 만나는 첫 장면이 성립하지 않는다. 흩어진 약초는 숲 깊은 곳에 흔적으로 남는다.
      const lost = lia.inventory.herb || 0;
      delete lia.inventory.herb;
      delete lia.inventory.bandage;
      if (lost) Places.addTrace(W, 'deepwood', 'scattered_herbs', { count: lost });
      record(S, 'beast_attack', { loc: 'deepwood', actors: ['thornback', 'lia'], witnesses: ['lia'],
        data: { subject: 'thornback', target: 'lia' } });
      Goals.add(lia, { id: 'return_home', type: 'personal', priority: 65 }, W.time.t);
      // 움푹한 곳까지 한 시간 (7시에 닿는다)
      Npc.startMove(S, lia, 'hollow');
      lia.location.speed = 1;
      lia.location.nextAt = W.time.t + 60;
      lia.currentAction = { type: 'flee', start: W.time.t, until: W.time.t + 60, data: {} };
      // 움푹한 곳의 핏자국은 장면 글(주변을 조사한다)이 직접 묘사하므로 따로 적지 않는다
      Places.addTrace(W, 'hollow', 'blood', { ttl: 3 * Time.DAY, quiet: true });
    },
  };

  // ---------- 실종과 수색 ----------
  function checkMissing(S) {
    const { W } = S;
    const t = W.time.t;
    Object.values(W.npcs).forEach((n) => {
      if (!n.expectedHome || t < n.expectedHome || n.flags.missingResolved) return;
      if (n.alive && Npc.atHome(n)) return;
      const key = 'missing:' + n.id;
      if (W.events.active[key]) return;
      const homeRegion = Places.regionOf(n.location.home);
      // 마을 안에서 오가는 중인 사람도 마을 사람이다
      const villagers = Object.values(W.npcs).filter((v) => v !== n && v.alive
        && Places.regionOf(v.location.loc) === homeRegion);
      if (!villagers.length) return;
      const ev = record(S, 'missing', { loc: n.location.home, witnesses: villagers.map((v) => v.id),
        data: { target: n.id } });
      W.events.active[key] = { type: 'missing', target: n.id, since: t, event: ev.id };
      // 아끼는 사람과 마을을 지키는 사람이 다음 날 새벽 숲을 뒤진다
      const dawn = t - Time.clock(t) + Time.DAY + 6 * 60;
      villagers.forEach((v) => {
        const r = Rel.peek(W, v.id, n.id) || {};
        if ((r.affection || 0) >= 30 || v.identity.occupation === 'guard') {
          Goals.add(v, { id: 'search', type: 'social', base: 70 + (r.affection || 0) * 0.2, priority: 0,
            target: n.id, plan: SEARCH_PLAN.slice(), idx: 0, startAt: dawn }, t);
        }
      });
    });
  }

  // 수색대의 한 걸음 (behavior.js의 search 행동)
  function searchStep(S, n, c) {
    const { W } = S;
    const g = Goals.get(n, 'search');
    if (!g) return { min: 5 };
    if (c.dark || Time.hour(c.now) >= 18) {
      // 해가 지면 돌아가고, 내일 새벽 처음부터 다시 찾는다
      g.idx = 0;
      g.startAt = c.now - Time.clock(c.now) + Time.DAY + 6 * 60;
      if (c.loc !== c.home) Npc.startMove(S, n, c.home);
      return { min: 10 };
    }
    const where = g.plan[g.idx];
    if (!where) {
      Goals.remove(n, 'search');
      Npc.startMove(S, n, c.home);
      return { min: 10 };
    }
    if (c.loc !== where) { Npc.startMove(S, n, where); return { min: 10 }; }
    const target = W.npcs[g.target];
    if (target.alive && !target.location.transit && target.location.loc === c.loc) { found(S, n, target, 'alive'); return { min: 20 }; }
    if (!target.alive && Places.traces(W, c.loc).some((x) => x.kind === 'body' && x.npc === target.id)) { found(S, n, target, 'dead'); return { min: 30 }; }
    Places.addTrace(W, c.loc, 'footprints', { by: n.id, ttl: 2 * Time.DAY });
    g.idx++;
    return { min: 20 };
  }

  function stopSearch(W, targetId, onlyAt) {
    Object.values(W.npcs).forEach((v) => {
      const g = Goals.get(v, 'search');
      if (g && g.target === targetId && (!onlyAt || v.location.loc === onlyAt)) Goals.remove(v, 'search');
    });
  }

  function found(S, n, target, how) {
    const { W } = S;
    const loc = n.location.loc;
    delete W.events.active['missing:' + target.id];
    target.flags.missingResolved = true;
    if (how === 'alive') {
      record(S, 'found_alive', { loc, data: { subject: n.id, target: target.id } });
      // 부축해서 데려간다
      target.physical.shock = Math.min(target.physical.shock, 15);
      Goals.add(target, { id: 'return_home', type: 'personal', priority: 90 }, W.time.t);
      stopSearch(W, target.id, loc);
      Npc.startMove(S, n, n.location.home);
      return;
    }
    // 시신: 무엇이 그를 죽였는지는 흔적으로만 짐작한다. 곁에 이방인이 있었다면 의심은 그쪽으로 간다.
    const d = target.death || {};
    const by = d.by === 'thornback' ? 'thornback' : (d.by === 'player' && W.player.loc === loc ? 'player' : null);
    record(S, 'found_dead', { loc, data: { target: target.id, cause: d.cause || null, by } });
    Regions.raiseThreat(S, 'village', 25);
    W.regions.village.alert = 80;
    stopSearch(W, target.id, loc);
    Npc.startMove(S, n, n.location.home);
  }

  // ---------- 매 틱 ----------
  function process(S, prevT) {
    const { W } = S;
    W.events.scheduled.forEach((e) => {
      if (!e.done && W.time.t >= e.at) { e.done = true; SCRIPTED[e.type](S); }
    });
    if (Math.floor(prevT / 60) !== Math.floor(W.time.t / 60)) checkMissing(S);
  }

  // 누군가 죽었다. 곁에서 본 사람이 있으면 그들이 이야기를 시작한다.
  Bus.on('NPC_DIED', (S, e) => {
    const w = witnessesAt(S.W, e.loc).filter((x) => x !== e.npcId);
    record(S, 'death_witnessed', { loc: e.loc, witnesses: w, data: { target: e.npcId, cause: e.cause, by: e.by, subject: e.by === 'player' ? 'player' : null } });
    // 곁에서 본 사람은 죽인 쪽을 두려워하고 미워한다
    w.filter((x) => x !== 'player' && x !== e.by).forEach((x) => {
      if (!e.by || !S.W.npcs[x]) return;
      const aff = (Rel.peek(S.W, x, e.npcId) || {}).affection || 0;
      Rel.change(S, x, e.by, { fear: 40, hostility: 30 + aff * 0.7, resentment: aff }, 'saw_death');
    });
  });
  // 집으로 돌아오면 실종은 끝난다
  Bus.on('NPC_MOVED', (S, e) => {
    const n = S.W.npcs[e.npcId];
    if (!n || e.to !== n.location.home) return;
    if (S.W.events.active['missing:' + n.id]) {
      delete S.W.events.active['missing:' + n.id];
      n.flags.missingResolved = true;
      record(S, 'returned', { loc: e.to, data: { target: n.id } });
      stopSearch(S.W, n.id);
    }
  });
  // 누군가 죽었다는 이야기를 들은 수색꾼은 찾기를 그만둔다
  Bus.on('RUMOR_SPREAD', (S, e) => {
    const r = S.W.rumors[e.rumorId];
    if (r && r.type === 'died') { const v = S.W.npcs[e.to]; const g = v && Goals.get(v, 'search'); if (g && g.target === r.target) Goals.remove(v, 'search'); }
  });

  return { SEARCH_PLAN, initialSchedule, witnessesAt, record, SCRIPTED, checkMissing, searchStep, found, process };
})();

if (typeof module !== 'undefined') module.exports = { WorldEvents };
