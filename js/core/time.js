// 시간. W.time.t = 1일차 0시부터 흐른 분.
const Time = (() => {
  const DAY = 1440;
  const START = 15 * 60; // 첫날 오후 3시에 눈을 뜬다

  // 시간대 (통합 명세 4절)
  const BANDS = [
    ['late_night', 0, 5], ['dawn', 5, 8], ['morning', 8, 12],
    ['afternoon', 12, 17], ['evening', 17, 20], ['night', 20, 24],
  ];
  const KO = { late_night: '심야', dawn: '새벽', morning: '오전', afternoon: '오후', evening: '저녁', night: '밤' };
  const DAY_KO = ['', '첫날', '둘째 날', '셋째 날', '넷째 날', '다섯째 날', '여섯째 날', '일곱째 날', '여덟째 날', '아홉째 날', '열흘째'];

  // 행동이 쓰는 시간 (지시서 11절 [확정]): 탐색 +10 / 이동 +20 / 휴식 +30 / 전투 +5
  const COST = { explore: 10, move: 20, rest: 30, fight: 5, talk: 5 };

  const clock = (t) => ((t % DAY) + DAY) % DAY;
  const day = (t) => Math.floor(t / DAY) + 1;
  const hour = (t) => clock(t) / 60;
  const band = (t) => { const h = hour(t); return BANDS.find(([, a, b]) => h >= a && h < b)[0]; };
  const dark = (t) => { const b = band(t); return b === 'night' || b === 'late_night'; };
  const at = (d, h, m = 0) => (d - 1) * DAY + h * 60 + m; // d일차 h시 m분
  const dayLabel = (t) => DAY_KO[day(t)] || `${day(t)}일째`;

  // 다음 아침 6시까지 남은 분 (밤을 넘길 때)
  function untilDawn(t) {
    const c = clock(t);
    const target = c >= 6 * 60 ? t - c + DAY + 6 * 60 : t - c + 6 * 60;
    return Math.max(1, target - t);
  }

  // a에서 b로 넘어가는 동안 시계가 h시를 지났는가
  function crossed(a, b, h) {
    const mark = h * 60;
    const first = a - clock(a) + mark;
    const next = first > a ? first : first + DAY;
    return next <= b;
  }

  return { DAY, START, BANDS, KO, DAY_KO, COST, clock, day, hour, band, dark, at, dayLabel, untilDawn, crossed };
})();

if (typeof module !== 'undefined') module.exports = { Time };
