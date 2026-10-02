// 낫지 않는 몸 상태 [결정 D9] — 노파의 상처(노쇠 + 낫지 않는 마물 상처). 수치는 RULES.conditions [임시].
// 단계(managed 관리됨 → unsteady 불안정 → bedridden 병상)에 따라 몸의 상한과 일정이 바뀐다. 단계를 바꾸는 것은 사건이다.
// **죽음은 없다**: 단계는 bedridden에서 멈추고, 이 상태가 체력을 깎지 않는다(상한만 낮춘다). 플레이어의 쓰러짐 규칙과도 무관하다.
const Condition = (() => {
  const def = (n) => (n.physical.chronic ? RULES.conditions[n.physical.chronic.id] : null);
  const stageOf = (n) => (n.physical.chronic ? n.physical.chronic.stage : null);

  function create(id) {
    return id ? { id, stage: RULES.conditions[id].order[0], since: Time.START, herbless: 0 } : null;
  }

  // 단계에 맞춰 몸의 상한과 일정을 맞춘다
  function apply(n) {
    const d = def(n);
    if (!d) return;
    const st = d.stages[n.physical.chronic.stage];
    n.physical.maxHealth = st.maxHealth;
    n.physical.health = Math.min(n.physical.health, st.maxHealth);
    n.schedule = JSON.parse(JSON.stringify(SCHEDULES[st.schedule]));
  }

  // 단계를 옮긴다. step +1 = 나빠짐, -1 = 나아짐. bedridden 너머로는 가지 않는다
  function shift(S, n, step) {
    const d = def(n);
    if (!d || !n.alive) return false;
    const c = n.physical.chronic;
    const i = d.order.indexOf(c.stage);
    const j = Math.max(0, Math.min(d.order.length - 1, i + step));
    if (j === i) return false;
    c.stage = d.order[j];
    c.since = S.W.time.t;
    apply(n);
    Behavior.interrupt(n);
    return true;
  }

  const canTravel = (n) => { const d = def(n); return !d || d.stages[n.physical.chronic.stage].travel; };
  const need = (n) => { const d = def(n); return d ? d.need : 0; };

  // 하루마다(새벽 6시): 관리에 약초를 쓴다. 약초가 없으면 "관리하지 못한 날"이 쌓인다 (단계는 사건이 바꾼다)
  function daily(S) {
    Object.values(S.W.npcs).forEach((n) => {
      const d = def(n);
      if (!d || !n.alive) return;
      const c = n.physical.chronic;
      if ((n.inventory.herb || 0) >= d.herbPerDay) {
        n.inventory.herb -= d.herbPerDay;
        c.herbless = 0;
        n.physical.health = Math.min(n.physical.maxHealth, n.physical.health + 5);
      } else {
        c.herbless++;
        n.physical.pain = Math.max(n.physical.pain, 30);
      }
    });
  }

  return { create, apply, shift, canTravel, need, daily, stageOf };
})();

if (typeof module !== 'undefined') module.exports = { Condition };
