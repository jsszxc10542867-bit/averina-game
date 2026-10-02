// NPC 욕구 (통합 명세 7절). 0~100, 높을수록 급하다. 욕구가 높을수록 관련 행동의 점수가 오른다.
const Needs = (() => {
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

  // 몸 상태: 피를 흘리면 체력이 줄고, 충격과 통증은 시간이 지나며 가라앉는다
  function body(S, n, dt) {
    const p = n.physical;
    if (p.bleed > 0) {
      p.health = Math.max(0, p.health - p.bleed * dt);
      if (p.health <= 0) { Npc.kill(S, n, '피를 너무 많이 흘렸다', null); return; }
    }
    // 충격은 천천히 가라앉는다 (쉬면 조금 더 빨리). 다친 뒤 대여섯 시간은 멀리 걷지 못한다.
    p.shock = Math.max(0, p.shock - dt * 0.12);
    const act = n.currentAction && n.currentAction.type;
    if ((act === 'rest' || act === 'sleep') && p.bleed === 0) p.health = Math.min(p.maxHealth, p.health + dt * 0.02);
    p.pain = clamp(p.injured ? 40 + (60 - p.health) : p.pain - dt * 0.1);
    if (p.health >= p.maxHealth * 0.9 && p.bleed === 0) p.injured = false;
  }

  function update(S, n, dt) {
    const x = n.needs, p = n.physical;
    const act = n.currentAction && n.currentAction.type;
    x.hunger = clamp(x.hunger + dt * 0.02);
    x.thirst = clamp(x.thirst + dt * (p.bleed > 0 ? 0.06 : 0.035));
    if (act !== 'sleep' && act !== 'rest') x.fatigue = clamp(x.fatigue + dt * (act === 'work' || n.location.transit ? 0.05 : 0.025));
    x.social = clamp(x.social + dt * 0.01 * (n.personality.sociability / 50));
    x.health = clamp((1 - p.health / p.maxHealth) * 100 + p.pain * 0.3 + (p.bleed > 0 ? 20 : 0) + Condition.need(n));
    x.money = clamp(60 - n.money * 0.5);
    // 두려움은 위험이 없으면 천천히 가라앉는다 (용감할수록 빨리)
    n.mental.fear = clamp(n.mental.fear - dt * 0.02 * (0.5 + n.personality.bravery / 100));
    x.safety = clamp(n.mental.fear);
    n.mental.stress = clamp(n.mental.stress + dt * 0.01 * ((x.hunger + x.thirst + x.health) / 150 - 0.5));
  }

  // 가장 급한 욕구 순으로
  const urgent = (n) => Object.entries(n.needs).sort((a, b) => b[1] - a[1]);

  // 도움을 받으면 몸과 마음이 조금 놓인다 (통합 명세 36절: 물을 주면 갈증이 줄어든다)
  const RELIEF = { water: { thirst: -100, shock: 30 }, herb: { shock: 15 }, treat: { shock: 15 }, heal: { shock: 15 }, gift: { shock: 5 } };
  Bus.on('NPC_HELPED', (S, e) => {
    const n = S.W.npcs[e.npcId];
    const r = RELIEF[e.kind];
    if (!n || !n.alive || !r) return;
    if (r.thirst) n.needs.thirst = clamp(n.needs.thirst + r.thirst);
    if (r.shock) n.physical.shock = Math.max(0, n.physical.shock - r.shock);
  });

  return { RELIEF, body, update, urgent };
})();

if (typeof module !== 'undefined') module.exports = { Needs };
