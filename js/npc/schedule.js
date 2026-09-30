// NPC 일정. 지금 시각에 무엇을, 어디서 하는가. 'home'은 그 NPC의 집이다.
const Schedule = (() => {
  function current(n, t) {
    const h = Time.hour(t);
    const e = n.schedule.find(([a, b]) => h >= a && h < b);
    if (!e) return null;
    return { act: e[2], at: e[3] === 'home' ? n.location.home : e[3] };
  }
  return { current };
})();

if (typeof module !== 'undefined') module.exports = { Schedule };
