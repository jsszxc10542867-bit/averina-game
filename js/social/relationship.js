// 관계 (통합 명세 11절). 호감도 하나가 아니라 열 가지 축. 한쪽 방향이다 ('lia>player' ≠ 'player>lia').
// 수치는 플레이어에게 보여 주지 않는다. 행동으로만 드러난다 (narrative.js).
const Rel = (() => {
  const AXES = ['trust', 'fear', 'respect', 'affection', 'suspicion', 'hostility', 'gratitude', 'resentment', 'familiarity', 'dependence'];
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const key = (a, b) => `${a}>${b}`;
  const blank = () => Object.fromEntries(AXES.map((k) => [k, 0]));

  const peek = (W, a, b) => W.relationships[key(a, b)] || null;

  // 없으면 만든다. NPC 정의의 관계, 또는 낯선 사람을 대하는 첫 태도에서 시작한다.
  function get(W, a, b) {
    const k = key(a, b);
    if (W.relationships[k]) return W.relationships[k];
    const def = NPC_DEFS[a];
    const base = def ? (b === 'player' ? (def.attitude && def.attitude.stranger) : (def.relations && def.relations[b])) : null;
    W.relationships[k] = Object.assign(blank(), base || {});
    return W.relationships[k];
  }

  // delta: { trust: +10, ... }. 두려움은 그 NPC의 마음 상태(mental.fear)도 함께 흔든다.
  function change(S, a, b, delta, cause, silent) {
    const r = get(S.W, a, b);
    let big = false;
    for (const k in delta) {
      if (!AXES.includes(k)) throw new Error('알 수 없는 관계 축: ' + k);
      r[k] = clamp(r[k] + delta[k]);
      if (Math.abs(delta[k]) >= 3) big = true;
    }
    const n = S.W.npcs[a];
    if (n && delta.fear) n.mental.fear = clamp(n.mental.fear + delta.fear);
    if (big && !silent) {
      Bus.emit(S, 'RELATIONSHIP_CHANGED', { from: a, to: b, delta, cause: cause || null });
      // 마음이 크게 흔들렸다: 하던 일을 멈추고 다시 판단한다
      if (n && n.alive) Behavior.interrupt(n);
    }
    return r;
  }

  function set(S, a, b, axis, v) { get(S.W, a, b)[axis] = clamp(v); }

  // NPC 정의에 적힌 서로의 관계로 시작한다
  function seed(W) {
    Object.entries(NPC_DEFS).forEach(([a, d]) => Object.keys(d.relations || {}).forEach((b) => get(W, a, b)));
  }

  // 한 시간마다: 두려움과 적의는 사건이 없으면 가라앉는다. 원한이 남아 있으면 적의는 잘 가라앉지 않는다.
  function process(S) {
    Object.values(S.W.relationships).forEach((r) => {
      r.fear = clamp(r.fear - 2);
      if (r.familiarity > 20) r.suspicion = clamp(r.suspicion - 0.5);
      if (r.resentment < 30) r.hostility = clamp(r.hostility - 0.5);
      r.gratitude = clamp(r.gratitude - 0.1);
    });
  }

  // ---------- 사건이 관계를 바꾼다 ----------
  // 도움: 장면이 수치를 정해 주면 그대로 (지시서 22절: 물을 주면 신뢰 +10, 경계 -5), 없으면 기본값. 감사는 늘 오른다.
  Bus.on('NPC_HELPED', (S, e) => {
    const n = S.W.npcs[e.npcId];
    if (!n || !n.alive) return;
    const d = Object.assign({ gratitude: 10 }, e.delta || { trust: 8, suspicion: -5, affection: 3 });
    change(S, e.npcId, e.helperId, d, 'helped');
  });
  Bus.on('NPC_THREATENED', (S, e) => {
    if (S.W.npcs[e.npcId] && S.W.npcs[e.npcId].alive) change(S, e.npcId, e.by, e.delta || { fear: 20, hostility: 30, trust: -20, suspicion: 15 }, 'threatened');
  });
  Bus.on('NPC_ATTACKED', (S, e) => {
    if (S.W.npcs[e.npcId] && S.W.npcs[e.npcId].alive) change(S, e.npcId, e.by, { fear: 30, hostility: 50, trust: -40, resentment: 40 }, 'attacked');
    // 곁에서 본 사람도 공격한 쪽을 두려워하고 미워한다
    Npc.here(S.W, e.loc).filter((w) => w.id !== e.npcId).forEach((w) => {
      const aff = (peek(S.W, w.id, e.npcId) || {}).affection || 0;
      change(S, w.id, e.by, { fear: 20, hostility: 10 + aff * 0.4, trust: -20 }, 'saw_attack');
    });
  });

  return { AXES, peek, get, change, set, seed, process };
})();

if (typeof module !== 'undefined') module.exports = { Rel };
