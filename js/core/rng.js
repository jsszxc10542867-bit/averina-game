// 난수. 씨앗을 세계 상태 안에 넣어 두므로, 저장했다 불러와도 같은 흐름이 이어진다.
// 씨앗이 두 갈래다: 'rng'(사람과 사건)와 날씨(weather.seed). 날씨는 플레이어의 행동과 무관하게 새 게임마다 같다.
const Rng = (() => {
  // mulberry32. obj[key]가 씨앗이다.
  function next(obj, key = 'rng') {
    let t = (obj[key] = (obj[key] + 0x6d2b79f5) >>> 0);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  }
  const chance = (W, p) => next(W) < Math.max(0, Math.min(1, p));
  const pick = (W, arr) => arr[Math.floor(next(W) * arr.length)];
  const between = (W, lo, hi) => lo + next(W) * (hi - lo);
  return { next, chance, pick, between };
})();

if (typeof module !== 'undefined') module.exports = { Rng };
