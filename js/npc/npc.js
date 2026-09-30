// NPC 본체 (통합 명세 6절): 만들기, 위치와 이동, 다치고 죽기.
// NPC는 플레이어를 기다리지 않는다. 판단은 behavior.js, 욕구는 needs.js, 목표는 goals.js가 맡는다.
const Npc = (() => {
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function create(id, def) {
    const sched = typeof def.schedule === 'string' ? SCHEDULES[def.schedule] : def.schedule;
    return {
      id,
      identity: clone(def.identity),
      physical: { health: 100, maxHealth: 100, bleed: 0, pain: 0, shock: 0, injured: false, wounds: [] },
      mental: { fear: 0, stress: 10, mood: 60, alert: 20 },
      personality: clone(def.personality),
      needs: Object.assign({ hunger: 20, thirst: 20, fatigue: 20, health: 0, safety: 0, social: 30, money: 0 }, def.needs),
      goals: (def.goals || []).map((g) => Object.assign({ since: Time.START }, g)),
      location: { loc: def.start.loc, home: def.home, path: [], nextAt: null, dest: null, transit: false, speed: 1, hidden: false },
      schedule: clone(sched),
      memories: [],
      languages: clone(def.languages || {}),
      inventory: clone(def.inventory || {}),
      money: def.money || 0,
      knowledge: { facts: {}, rumors: {}, npcs: {}, events: {} },
      magic: def.magic ? clone(def.magic) : null,
      currentAction: null,
      flags: {},
      away: !!def.start.away,
      expectedHome: def.expectedHome ? Time.at(def.expectedHome[0], def.expectedHome[1]) : null,
      alive: true,
      death: null,
      simT: Time.START,
      lastDecide: -1e9, // 저장 파일(JSON)에 무한대는 들어가지 않으므로 아주 먼 과거로 둔다
    };
  }

  const createAll = () => Object.fromEntries(Object.entries(NPC_DEFS).map(([id, d]) => [id, create(id, d)]));

  // 그 장소에 (지나가는 중이 아니라) 머물러 있는 산 NPC
  const here = (W, loc) => Object.values(W.npcs).filter((n) => n.alive && !n.location.transit && n.location.loc === loc);
  const present = (W, n) => !!(n && n.alive && !n.location.transit && n.location.loc === W.player.loc);
  const at = (W, id, loc) => { const n = W.npcs[id]; return !!(n && n.alive && !n.location.transit && n.location.loc === loc); };
  const inRegion = (n, region) => Places.regionOf(n.location.loc) === region;
  const atHome = (n) => !n.location.transit && Places.regionOf(n.location.loc) === Places.regionOf(n.location.home);

  // 걷는 속도. 다쳤거나 충격이 남아 있으면 느리다.
  function speed(n) {
    let s = 1;
    if (n.physical.health < 50) s *= 0.7;
    if (n.physical.shock > 20) s *= 0.6;
    return s;
  }

  // dest까지 걷기 시작한다. 이미 거기 있으면 false
  function startMove(S, n, dest) {
    const { W } = S;
    if (n.location.loc === dest && !n.location.transit) return false;
    const r = Places.route(n.location.loc, dest);
    if (!r || r.path.length < 2) return false;
    const leaving = present(W, n);
    n.location.path = r.path.slice(1);
    n.location.dest = dest;
    n.location.transit = true;
    n.location.hidden = false;
    n.location.speed = speed(n);
    n.location.nextAt = W.time.t + Places.distance(n.location.loc, n.location.path[0]) / n.location.speed;
    if (leaving) Narrative.feedLeave(S, n);
    return true;
  }

  // 다음 장소에 닿는다 (여러 구간을 지나야 하면 다음 구간을 잡는다)
  function arrive(S, n) {
    const { W } = S;
    const from = n.location.loc;
    const to = n.location.path.shift();
    n.location.loc = to;
    if (n.location.path.length) {
      n.location.nextAt += Places.distance(to, n.location.path[0]) / n.location.speed;
    } else {
      n.location.transit = false;
      n.location.nextAt = null;
      n.location.dest = null;
    }
    Bus.emit(S, 'NPC_MOVED', { npcId: n.id, from, to });
    if (present(W, n)) Narrative.feedArrive(S, n);
  }

  // 즉시 옮긴다 (대본 사건과 디버그용)
  function place(S, n, loc) {
    const from = n.location.loc;
    Object.assign(n.location, { loc, path: [], nextAt: null, dest: null, transit: false, hidden: false });
    Bus.emit(S, 'NPC_MOVED', { npcId: n.id, from, to: loc });
  }

  function injure(S, n, o) {
    const p = n.physical;
    if (o.health != null) p.health = Math.max(0, Math.min(p.maxHealth, o.health));
    if (o.bleed != null) p.bleed = o.bleed;
    if (o.pain != null) p.pain = o.pain;
    if (o.shock != null) p.shock = o.shock;
    p.injured = true;
    p.wounds.push({ kind: o.kind || 'wound', t: S.W.time.t, by: o.by || null });
    if (p.health <= 0) kill(S, n, o.cause || '상처', o.by);
  }

  function hurt(S, n, amount, cause, by) {
    if (!n.alive) return;
    n.physical.health = Math.max(0, n.physical.health - amount);
    n.physical.injured = true;
    n.physical.pain = Math.min(100, n.physical.pain + amount * 2);
    if (n.physical.health <= 0) kill(S, n, cause, by);
  }

  // 죽음은 되돌리지 않는다 (같은 회차 안에서는). 되감기만이 시간을 되돌린다.
  function kill(S, n, cause, by) {
    if (!n.alive) return;
    const { W } = S;
    n.alive = false;
    n.death = { cause, location: n.location.loc, timestamp: W.time.t, by: by || null };
    n.currentAction = null;
    Object.assign(n.location, { path: [], nextAt: null, dest: null, transit: false });
    Places.addTrace(W, n.location.loc, 'body', { npc: n.id, ttl: 30 * Time.DAY });
    Bus.emit(S, 'NPC_DIED', { npcId: n.id, cause, by: by || null, loc: n.location.loc });
  }

  return { create, createAll, here, present, at, inRegion, atHome, speed, startMove, arrive, place, injure, hurt, kill };
})();

if (typeof module !== 'undefined') module.exports = { Npc };
