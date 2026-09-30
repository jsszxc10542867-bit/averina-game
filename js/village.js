// [임시] 마을 장소. 스토리_재설계.md 5절 "첫 마을" — 이름과 구성, 묘사는 스토리 담당이 정하면 이 파일을 바꾼다.
// 일·거처·가게 선택지는 여기 적지 않는다. 시스템(play/life.js)이 장소와 사람을 보고 붙인다.
// 형식은 world.js의 LOCS와 같다. g = { W, P, me, period, dark, first, give, know, use }

// [임시] 마을의 하늘 (숲의 SKY는 나무 그늘을 말하므로 따로 둔다)
const VSKY = {
  dawn: '동쪽 하늘이 희끄무레하다.',
  morning: '햇빛이 낮은 지붕들 위로 쏟아진다.',
  afternoon: '해가 기울어 울타리 그림자가 길다.',
  evening: '하늘이 붉다. 굴뚝마다 연기가 오른다.',
  night: '불 켜진 창 몇 개 말고는 어둡다.',
  late_night: '불 켜진 창 몇 개 말고는 어둡다.',
};

// 숲의 가장자리: 숲과 마을 사이
LOCS.edge = {
  name: '숲의 가장자리',
  desc: (g) => ['나무가 듬성해지고 앞이 트인다.', '낮은 울타리와 지붕 몇 개가 보인다.', SKY[g.period]],
  exits: [
    { to: 'village_gate', label: '울타리 쪽으로 간다', min: 20, kw: ['울타리', '마을'], text: ['울타리를 향해 걷는다.'] },
    { to: 'hill', label: '숲으로 돌아간다', min: 240, kw: ['숲', '돌아'], use: 'vit',
      text: ['왔던 숲으로 다시 들어간다.', '비탈 위까지는 한참이다.'],
      block: (g) => (g.dark ? { min: 5, lines: ['밤의 숲으로 들어갈 자신은 없다.'] } : null) },
  ],
  actions: [],
};

// 울타리를 지키는 사람이 나를 믿지 못하면 들여보내 주지 않는다 (리아가 함께 있거나, 나를 아는 사람이 보증하면 들어갈 수 있다)
function gateBlock(g) {
  const gk = g.W.npcs.gatekeeper;
  if (!gk || !Npc.present(g.W, gk) || g.dark) return null;
  const r = Rel.get(g.W, 'gatekeeper', 'player');
  if (r.suspicion < 60 && r.hostility < 30) return null;
  if (g.W.player.companions.some((id) => Npc.present(g.W, g.W.npcs[id]))) return null;
  return { min: 5, lines: ['울타리 틈으로 들어서려 하자, 창을 든 남자가 창대를 가로로 들어 길을 막는다.', '고개를 젓는다. 들여보내 줄 생각이 없다.'] };
}

LOCS.village_gate = {
  name: '마을 울타리',
  desc: (g) => ['나무 말뚝을 엮은 낮은 울타리다. 사람 하나 드나들 틈이 나 있다.', VSKY[g.period]],
  exits: [
    { to: 'village_square', label: '울타리 안으로 들어간다', min: 5, kw: ['안', '들어', '광장'], text: ['울타리 틈을 지나 안으로 들어선다.'], block: gateBlock },
    { to: 'edge', label: '숲 쪽으로 물러난다', min: 20, kw: ['숲', '물러'], text: ['울타리를 등지고 숲 쪽으로 걷는다.'] },
  ],
  actions: [],
};

LOCS.village_square = {
  name: '마을 광장',
  desc: (g) => ['흙바닥이 다져진 작은 광장이다. 가운데에 우물이 있다.', '한쪽에 천막을 친 가게가 있다.', VSKY[g.period]],
  exits: [
    { to: 'village_gate', label: '울타리 쪽으로 간다', min: 5, kw: ['울타리', '밖'], text: ['울타리 쪽으로 걷는다.'] },
    { to: 'village_homes', label: '집들 사이로 간다', min: 5, kw: ['집'], text: ['낮은 지붕들 사이로 걸어 들어간다.'] },
    { to: 'village_field', label: '밭으로 간다', min: 10, kw: ['밭'], text: ['울타리 안쪽 밭으로 걷는다.'] },
    { to: 'village_chapel', label: '뾰족한 지붕의 건물로 간다', min: 5, kw: ['예배당', '교회', '뾰족'], text: ['광장 한쪽, 지붕이 뾰족한 건물로 걷는다.'] },
  ],
  actions: [
    { id: 'well', label: '우물물을 마신다', kw: ['물', '마시', '우물'], min: 5,
      run: (g) => { g.me.surv.thirst = 0; return ['두레박을 내려 물을 길어 올린다.', '차갑다. 개울물과는 맛이 조금 다르다.']; } },
  ],
};

LOCS.village_homes = {
  name: '마을 집들',
  desc: (g) => ['낮은 지붕의 집 몇 채가 모여 있다. 굴뚝에서 연기가 오른다.', '마른 풀 냄새가 나는 헛간이 하나 보인다.', VSKY[g.period]],
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 5, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

LOCS.village_field = {
  name: '마을 밭',
  desc: (g) => ['울타리 안쪽의 밭이다. 이랑이 곧게 나 있다.', '밭 가장자리에 잎이 넓은 풀이 무성하다.', VSKY[g.period]],
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 10, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

// [임시] 교회의 구호 거처. 플레이어는 처음에 이곳이 무엇인지 모른다 (이름은 HUD에만 보인다)
LOCS.village_chapel = {
  name: '작은 예배당',
  desc: (g) => ['지붕이 뾰족한 작은 건물이다. 안은 서늘하고 조용하다.', '앞쪽에 낯선 문양이 새겨진 돌이 놓여 있다.', '한쪽 구석에 담요 몇 장이 개어져 있다.'],
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 5, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

if (typeof module !== 'undefined') module.exports = { gateBlock };
