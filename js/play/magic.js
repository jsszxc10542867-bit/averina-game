// 마법 (통합 명세 25절, 세계관 10·11절). 플레이어는 처음에 마법이 있다는 것조차 모른다. 목록을 보여 주지 않는다.
// 쓸 수 있는가는 마력(mana)·이해도·숙련도·재능·지식·훈련으로 정해진다.
// NPC: n.magic = { mana, maxMana, schools: { life: { understanding, proficiency, talent } } }
// 플레이어: 이해(지식) = P.magic.understanding, 마력과 재능(몸) = W.player.magic
const Magic = (() => {
  const SCHOOLS = ['fire', 'water', 'wind', 'earth', 'light', 'dark', 'space', 'time', 'mind', 'life', 'summoning', 'gravity', 'creation'];
  // 기본 속성은 1, 고위 마법은 2~3 (세계관 10절)
  const TIER = { fire: 1, water: 1, wind: 1, earth: 1, light: 1, dark: 1, mind: 2, life: 2, summoning: 2, space: 3, time: 3, gravity: 3, creation: 3 };

  function canCast(n, school, cost) {
    const m = n && n.magic;
    if (!m || m.mana < cost) return false;
    const s = m.schools && m.schools[school];
    if (!s) return false;
    const tier = TIER[school];
    return s.understanding >= 20 * tier && s.proficiency >= 10 * tier && s.talent >= 15 * tier;
  }

  // life: 상처가 아문다 (체력 +15, 출혈 절반)
  function cast(S, n, school, o) {
    const { W } = S;
    if (!canCast(n, school, o.cost)) return false;
    n.magic.mana -= o.cost;
    n.magic.schools[school].proficiency = Math.min(100, n.magic.schools[school].proficiency + 1);
    if (school === 'life') {
      const t = o.target === 'player' ? null : W.npcs[o.target];
      if (t) { t.physical.health = Math.min(t.physical.maxHealth, t.physical.health + 15); t.physical.bleed /= 2; }
      else if (o.target === 'player') Player.heal(W.player, 3);
    }
    const ev = WorldEvents.record(S, 'magic', { loc: n.location.loc, actors: [n.id], data: { subject: n.id, school, target: o.target } });
    // 곁에서 본 플레이어는 그 마법을 조금 이해하게 된다 (지식)
    if (ev.witnesses.includes('player')) observe(S, school, 5);
    return true;
  }

  function observe(S, school, n) {
    const u = S.P.magic.understanding;
    u[school] = Math.min(100, (u[school] || 0) + n);
  }

  // 한 시간마다 마력이 조금 돌아온다
  function regen(S) {
    Object.values(S.W.npcs).forEach((n) => { if (n.magic && n.alive) n.magic.mana = Math.min(n.magic.maxMana, n.magic.mana + 1); });
    const pm = S.W.player.magic;
    pm.mana = Math.min(pm.maxMana, pm.mana + 0.5);
  }

  // 플레이어가 그 계열을 쓸 수 있는 몸과 앎을 갖췄는가 (아직 쓰는 장면은 없다)
  function playerCanCast(S, school, cost) {
    const pm = S.W.player.magic;
    const tier = TIER[school];
    const u = S.P.magic.understanding[school] || 0;
    const prof = (S.W.player.magic.proficiency || {})[school] || 0;
    return pm.mana >= cost && u >= 20 * tier && prof >= 10 * tier && (pm.talent[school] || 0) >= 15 * tier;
  }

  return { SCHOOLS, TIER, canCast, cast, observe, regen, playerCanCast };
})();

if (typeof module !== 'undefined') module.exports = { Magic };
