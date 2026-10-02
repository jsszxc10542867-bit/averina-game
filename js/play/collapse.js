// 쓰러짐 (스토리_재설계.md 11절 A안 [임시]). 체력이 0이 되어도 죽지 않는다. 쓰러지고, 구조되거나 깨어나며, 대가가 남는다.
// 대가: 흐른 시간(그동안 세계는 움직인다), 남은 상처, 잃은 소지품, 구해 준 사람에게 진 빚.
// 수치는 data/rules.js의 RULES.collapse. 판단만 여기서 하고, 화면 연출은 engine.js가 한다.
const Collapse = (() => {
  // 곁이나 바로 이웃한 곳에 있는 사람 가운데, 나를 적대하지 않고 믿거나 착한 사람
  function findRescuer(S) {
    const { W } = S;
    const C = RULES.collapse.rescuer;
    const loc = W.player.loc;
    const near = [loc, ...Places.neighbors(loc)];
    let best = null;
    Object.values(W.npcs).forEach((n) => {
      if (!n.alive || n.location.transit || !near.includes(n.location.loc)) return;
      const r = Rel.get(W, n.id, 'player');
      if (r.hostility > C.maxHostility || r.fear >= 60) return;
      if (r.trust < C.minTrust && n.personality.kindness < C.minKindness) return;
      const score = r.trust + n.personality.kindness * 0.5 + (n.location.loc === loc ? 20 : 0);
      if (!best || score > best.score) best = { n, score };
    });
    return best ? best.n : null;
  }

  // 쓰러진다. 결과: { rescuer, minutes, lost, again, lines(그사이 지나간 이야기 시계) }
  function resolve(S, cause) {
    const { W, P } = S;
    const me = W.player;
    const C = RULES.collapse;
    P.collapses = (P.collapses || 0) + 1;
    const again = me.lastCollapse != null && W.time.t - me.lastCollapse < C.repeatWindow;
    me.lastCollapse = W.time.t;
    const loc = me.loc;
    Bus.emit(S, 'PLAYER_COLLAPSED', { cause: cause || null, loc, again });
    const n = findRescuer(S);
    let minutes, hpRatio, lost = null;
    if (n) {
      minutes = C.rescuedMin;
      hpRatio = C.rescuedHp;
      if (n.location.loc !== loc) Npc.place(S, n, loc);
      n.flags.caring = W.time.t + minutes; // 깨어날 때까지 곁을 지킨다
      Player.treat(S);
      Memory.add(S, n, { type: 'rescued', subject: 'player', detail: cause || null });
      Rel.change(S, n.id, 'player', { familiarity: 10, affection: 3 }, 'rescued', true);
      me.debts.push({ npcId: n.id, kind: 'rescue', t: W.time.t, repaid: false });
      WorldEvents.record(S, 'rescued_player', { loc, actors: [n.id, 'player'], witnesses: [n.id, 'player'],
        data: { subject: 'player', target: n.id, cause: cause || null } });
      Bus.emit(S, 'PLAYER_RESCUED', { npcId: n.id, loc });
    } else {
      const [a, b] = C.aloneMin;
      minutes = Math.round(Rng.between(W, a, b));
      hpRatio = C.aloneHp;
      const items = Object.keys(me.inv).filter((k) => me.inv[k] > 0);
      if (items.length && Rng.chance(W, C.lossChanceAlone)) { lost = Rng.pick(W, items); Player.take(me, lost); }
    }
    if (again) minutes += C.repeatExtra;
    // 정신을 잃은 동안에도 세계는 흐른다. 그사이 벌어진 이야기 시계(해 질 녘 등)는 깨어난 뒤 짧게 알린다.
    const lines = [];
    let left = minutes;
    while (left > 0) {
      const r = World.tick(S, left, { sleep: true, unconscious: true });
      lines.push(...r.lines);
      left -= r.spent;
      // 정신을 잃은 사람에게는 밤의 목소리가 닿지 않는다
      const call = W.worldFlags.pending.indexOf('call');
      if (call >= 0) W.worldFlags.pending.splice(call, 1);
      if (r.spent <= 0) break;
    }
    W.worldFlags.feed.length = 0;
    me.hp = Math.max(me.hp, Math.ceil(hpMax(me) * hpRatio));
    return { rescuer: n, minutes, lost, again, lines };
  }

  // 밤의 목소리를 따라갔다 [결정 #6 · 스토리설계.md 단계 0~4 장면 문장 B]: 쓰러지지 않는다 (쓰러진 횟수에 세지 않는다).
  // 정신을 잃었다가 새벽 직전에 깨어난다. 처음 보는 자리다 (가 보지 않은 이웃 숲으로 옮긴다 [후보]). 잃는 것은 시간과 힘뿐이다.
  function lose(S) {
    const { W } = S;
    const me = W.player;
    const R = RULES.protection;
    const from = me.loc;
    World.tick(S, Math.max(R.shakenMin, Time.untilDawn(W.time.t) - 30), { unconscious: true });
    W.worldFlags.feed.length = 0;
    W.worldFlags.notes.length = 0;
    me.hp = Math.max(me.hp, R.minHp);
    me.surv.fatigue = Math.min(100, me.surv.fatigue + R.shakenFatigue);
    const near = Places.neighbors(from).filter((l) => LOCS[l] && Places.regionOf(l) === 'forest' && !['edge', 'hollow'].includes(l));
    const strange = near.find((l) => ['unknown', 'seen'].includes(Knowledge.locState(S.P, l))) || near[0];
    if (strange) Player.teleport(S, strange);
    return { from, to: me.loc };
  }

  return { findRescuer, resolve, lose };
})();

if (typeof module !== 'undefined') module.exports = { Collapse };
