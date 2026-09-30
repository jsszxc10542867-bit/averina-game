// NPC 기억 (통합 명세 10절). 강렬한 기억은 오래 남고, 약한 기억은 흐려진다.
// { id, type, subject, event, emotionalImpact(-100~100), importance(0~100), timestamp, detail }
const Memory = (() => {
  // 사건 종류별 기본 감정과 중요도
  const KIND = {
    met: [0, 30], helped_by: [40, 60], gift: [25, 45], healed_by: [55, 70], threatened_by: [-50, 70],
    attacked_by: [-80, 90], betrayed_by: [-90, 95], lied_to: [-40, 55], paid_by: [20, 35], promise_kept: [35, 50],
    shared_danger: [30, 60], witnessed_death: [-70, 90], lost: [-85, 95], heard_name: [10, 40], taught: [15, 35],
    stolen_from: [-50, 70], strange: [0, 35],
  };
  function add(S, n, o) {
    const [impact, importance] = KIND[o.type] || [0, 30];
    const m = {
      id: `m${S.W.run}-${++S.W.seq}`,
      type: o.type, subject: o.subject || null, event: o.event || null,
      emotionalImpact: o.impact != null ? o.impact : impact,
      importance: o.importance != null ? o.importance : importance,
      timestamp: S.W.time.t, detail: o.detail || null,
    };
    n.memories.push(m);
    return m;
  }

  const about = (n, subject, type) => n.memories.filter((m) => m.subject === subject && (!type || m.type === type));
  const has = (n, subject, type) => n.memories.some((m) => m.subject === subject && (!type || m.type === type));
  // 그 사람에 대한 느낌의 합 (중요한 기억일수록 크게)
  const feeling = (n, subject) => about(n, subject).reduce((s, m) => s + m.emotionalImpact * (m.importance / 100), 0);

  // 하루마다 흐려진다. 감정이 강했던 기억은 거의 흐려지지 않는다.
  function decay(S) {
    Object.values(S.W.npcs).forEach((n) => {
      n.memories.forEach((m) => { m.importance -= Math.abs(m.emotionalImpact) >= 60 ? 1 : 6; });
      n.memories = n.memories.filter((m) => m.importance > 0);
    });
  }

  // ---------- 사건이 기억이 된다 ----------
  Bus.on('NPC_HELPED', (S, e) => {
    const n = S.W.npcs[e.npcId];
    if (n && n.alive) add(S, n, { type: e.kind === 'heal' ? 'healed_by' : 'helped_by', subject: e.helperId, detail: e.kind });
  });
  Bus.on('NPC_THREATENED', (S, e) => {
    const n = S.W.npcs[e.npcId];
    if (n && n.alive) add(S, n, { type: 'threatened_by', subject: e.by });
  });
  Bus.on('NPC_ATTACKED', (S, e) => {
    const n = S.W.npcs[e.npcId];
    if (n && n.alive) add(S, n, { type: 'attacked_by', subject: e.by, detail: e.weapon || null });
  });
  Bus.on('NPC_MET_PLAYER', (S, e) => {
    const n = S.W.npcs[e.npcId];
    if (n && !has(n, 'player', 'met')) add(S, n, { type: 'met', subject: 'player', detail: e.loc });
  });
  // 누군가 죽는 것을 본 사람은 그것을 기억한다
  Bus.on('NPC_DIED', (S, e) => {
    Npc.here(S.W, e.loc).forEach((w) => add(S, w, { type: 'witnessed_death', subject: e.npcId, detail: e.cause }));
  });

  return { KIND, add, about, has, feeling, decay };
})();

if (typeof module !== 'undefined') module.exports = { Memory };
