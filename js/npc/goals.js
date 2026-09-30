// NPC 목표 (통합 명세 8절). 상황이 바뀌면 우선순위도 바뀐다.
// { id, type, priority, target?, since, plan? }
const Goals = (() => {
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));
  const get = (n, id) => n.goals.find((g) => g.id === id) || null;

  function add(n, goal, t) {
    const old = get(n, goal.id);
    if (old) return Object.assign(old, goal);
    const g = Object.assign({ since: t }, goal);
    n.goals.push(g);
    return g;
  }
  function remove(n, id) { n.goals = n.goals.filter((g) => g.id !== id); }

  // 우선순위를 다시 매긴다
  function update(S, n) {
    const { W } = S;
    const t = W.time.t;
    for (const g of n.goals) {
      if (g.id === 'survive') g.priority = clamp(40 + n.needs.health * 0.5 + n.needs.safety * 0.3);
      else if (g.id === 'return_home') {
        // 집 밖에 오래 있을수록 돌아가고 싶어진다. 다쳤으면 더. 떠날 날(startAt [일, 시])이 정해져 있으면 그때부터.
        const from = Array.isArray(g.startAt) ? Time.at(g.startAt[0], g.startAt[1]) : (g.startAt || g.since);
        g.priority = Npc.atHome(n) || t < from ? 0 : clamp(45 + (t - Math.max(g.since, from)) / 60 * 4 + (n.physical.injured ? 20 : 0));
      } else if (g.id === 'earn_money') g.priority = clamp(35 + n.needs.money * 0.5);
      else if (g.id === 'guard_village') g.priority = clamp(50 + (W.regions.village ? W.regions.village.threat * 0.3 : 0));
      // 스승(돌볼 사람)이 아프거나 다칠수록 돌보고 싶어진다. 세상을 떠나면 목표도 끝난다
      else if (g.id === 'care_for_teacher') { const t = W.npcs[g.target]; g.priority = t && t.alive ? clamp(50 + t.needs.health * 0.5) : 0; }
      // 수색은 정해 둔 새벽부터, 해가 있는 동안만
      else if (g.id === 'search') g.priority = t >= g.startAt && !Time.dark(t) ? g.base : 0;
      else if (g.id === 'trade_trip') {
        // 행상은 사흘에 한 번쯤 마을로 떠난다
        const last = n.flags.lastTrip == null ? Time.START - 2 * Time.DAY : n.flags.lastTrip;
        g.priority = n.flags.tripDone ? 0 : clamp(20 + (t - last) / Time.DAY * 20);
      }
    }
    // 집에 돌아왔으면 귀가 목표는 끝
    if (Npc.atHome(n) && get(n, 'return_home')) { remove(n, 'return_home'); n.away = false; }
  }

  const top = (n) => n.goals.reduce((a, g) => (!a || g.priority > a.priority ? g : a), null);

  return { get, add, remove, update, top };
})();

if (typeof module !== 'undefined') module.exports = { Goals };
