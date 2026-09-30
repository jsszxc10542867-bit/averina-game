// 탐험 (통합 명세 20절). 장소는 모름 → 멀리서 봄 → 가 봄 → 살펴봄 → 잘 앎 으로 드러난다.
// 지도는 발견한 만큼만 보여 준다.
const Explore = (() => {
  // 사실을 알면 장소도 알게 된다
  const FACT_PLACES = { girl_hollow: ['hollow', 'known'], smoke: ['edge', 'seen'], broken_branch: ['deep', 'explored'] };

  // 갈 수 있는 길이 보이면 그 끝을 "멀리서 봤다"
  function seeExits(S, exits) { exits.forEach((e) => Knowledge.location(S, e.to, 'seen')); }

  // 그 장소에서 해 본 일. 절반 넘게 해 봤으면 "살폈다"
  function didAction(S, loc, id) {
    const { W } = S;
    const done = W.worldFlags.done[loc] = W.worldFlags.done[loc] || {};
    done[id] = true;
    const total = (LOCS[loc] && LOCS[loc].actions.length) || 1;
    if (Object.keys(done).length >= Math.ceil(total / 2)) Knowledge.location(S, loc, 'explored');
  }

  function onFact(S, id) {
    const f = FACT_PLACES[id];
    if (f) Knowledge.location(S, f[0], f[1]);
  }

  // 알고 있는 장소 (숲 안, 플레이어가 갈 수 있는 곳만)
  function mapLines(S) {
    return Object.keys(LOCS).filter((k) => Knowledge.locState(S.P, k) !== 'unknown')
      .map((k) => ({ t: `· ${LOCS[k].name} — ${Knowledge.KO[Knowledge.locState(S.P, k)]}`, cls: 'note' }));
  }

  return { FACT_PLACES, seeExits, didAction, onFact, mapLines };
})();

if (typeof module !== 'undefined') module.exports = { Explore };
