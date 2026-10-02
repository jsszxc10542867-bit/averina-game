// 마을 하르넨의 장소 [결정 D7]. 구성은 시작마을.md 1-4절 (장소 8곳). 묘사 문장은 [임시] — 스토리 담당이 쓰면 이 파일을 바꾼다.
// 첫인상 세 가지(처마의 약초 다발 · 광장의 오래된 우물 · 울타리의 짐승 자국)는 [D7 확정], 문장은 [임시].
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
  desc: (g) => ['나무가 듬성해지고 앞이 트인다.', '낮은 울타리와 지붕 몇 개가 보인다.', '바람에 쓴 풀 냄새가 섞여 온다.', SKY[g.period]],
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
  // [처음] 짐승 자국을 손으로 만져 본다 (스토리설계.md 단계 5 장면 문장 A-③). 리아의 상처를 살펴봤다면 같은 모양임을 안다
  desc: (g) => (g.first('v_gate')
    ? ['나무 말뚝을 엮은 낮은 울타리다. 사람 하나 드나들 틈이 나 있다.',
      '말뚝 하나에 손을 대 본다. 손가락이 홈에 걸린다.', '나란히 난 세 줄. 깊다.',
      ...(g.P.knowledge.girl_wound ? ['……숲에서 본 그녀의 팔 상처와 같은 모양이다.'] : []),
      '새로 덧댄 말뚝 몇 개는 아직 껍질 색이 밝다. 얼마 전 일이다.', VSKY[g.period]]
    : ['나무 말뚝을 엮은 낮은 울타리다. 사람 하나 드나들 틈이 나 있다.',
      '말뚝 곳곳에 깊게 팬 발톱 자국이 있다. 새로 덧댄 말뚝은 아직 색이 밝다.', VSKY[g.period]]),
  exits: [
    { to: 'village_square', label: '울타리 안으로 들어간다', min: 5, kw: ['안', '들어', '광장'], text: ['울타리 틈을 지나 안으로 들어선다.'], block: gateBlock },
    { to: 'edge', label: '숲 쪽으로 물러난다', min: 20, kw: ['숲', '물러'], text: ['울타리를 등지고 숲 쪽으로 걷는다.'] },
  ],
  actions: [],
};

LOCS.village_square = {
  name: '마을 광장',
  // 시장은 8~18시, 저녁(18~20시)에는 우물가에 사람들이 모인다 (시작마을.md 1-4절 ②, 15절)
  // [처음] 우물과 처마의 풀 다발, 그리고 처음 들어선 저녁·밤의 광장 (스토리설계.md 단계 5 장면 문장 A-①②, B)
  desc: (g) => {
    const first = g.first('v_square');
    const l = ['흙바닥이 다져진 작은 광장이다.'];
    if (first) l.push('광장 한가운데에 우물이 있다.', '돌을 둥글게 쌓아 올렸는데, 아래쪽 돌일수록 색이 검고 닳아 있다.', '마을보다 우물이 먼저 있었던 것처럼 보인다.');
    else l.push('가운데에 이끼 낀 오래된 우물이 있고, 둘레에 돌의자가 놓여 있다.');
    if (g.period === 'evening') l.push('돌의자마다 사람들이 앉아 있다. 낮은 말소리가 오간다.');
    l.push(g.period === 'morning' || g.period === 'afternoon' ? '한쪽에 천막을 친 가게가 있다.' : '한쪽의 천막 가게가 접혀 있다.');
    if (first) l.push('지붕마다 처마 끝에 무언가가 거꾸로 매달려 있다.', '풀이다. 묶어서 말린 풀.', '숲 가장자리에서 맡았던 쓴 냄새가, 여기서는 마을 전체에 배어 있다.');
    else l.push('처마마다 마른 풀 다발이 매달려 있다. 쓴 냄새가 난다.');
    l.push(VSKY[g.period]);
    if (first) l.push(...firstEvening(g));
    return l;
  },
  exits: [
    { to: 'village_gate', label: '울타리 쪽으로 간다', min: 5, kw: ['울타리', '밖'], text: ['울타리 쪽으로 걷는다.'] },
    { to: 'village_inn', label: '연기가 오르는 큰 집으로 간다', min: 3, kw: ['여관', '밥집', '식당', '큰 집'], text: ['국 끓는 냄새를 따라 큰 집으로 걷는다.'] },
    { to: 'village_herbhouse', label: '약초 냄새가 짙은 집으로 간다', min: 5, kw: ['약초집', '약초', '노파'], text: ['쓴 풀 냄새가 가장 짙은 집으로 걷는다.'] },
    { to: 'village_homes', label: '집들 사이로 간다', min: 5, kw: ['집'], text: ['낮은 지붕들 사이로 걸어 들어간다.'] },
    { to: 'village_field', label: '밭으로 간다', min: 10, kw: ['밭'], text: ['울타리 안쪽 밭으로 걷는다.'] },
    { to: 'village_smithy', label: '쇠 냄새가 나는 작업장으로 간다', min: 3, kw: ['대장간', '잡화', '쇠'], text: ['광장 모퉁이의 작업장으로 걷는다.'] },
    { to: 'village_chapel', label: '뾰족한 지붕의 건물로 간다', min: 5, kw: ['예배당', '교회', '뾰족'], text: ['광장 한쪽, 지붕이 뾰족한 건물로 걷는다.'] },
    { to: 'village_guild', label: '문패가 걸린 작은 건물로 간다', min: 5, kw: ['길드', '연락소', '문패'], text: ['문패가 걸린 작은 건물 앞으로 걷는다.'] },
  ],
  actions: [
    { id: 'well', label: '우물물을 마신다', kw: ['물', '마시', '우물'], min: 5, kind: 'rest',
      run: (g) => {
        g.me.surv.thirst = 0;
        return ['두레박을 내려 물을 길어 올린다.', '차갑다. 개울물과는 맛이 조금 다르다.',
          ...(g.first('v_well') ? ['두레박 줄에 손때가 반들반들하다. 많은 사람이 오래 써 온 줄이다.'] : [])];
      } },
  ],
};

// 처음 들어선 광장이 저녁·밤일 때 (단계 5 장면 문장 B). 리아와 함께 왔거나 보증을 받았으면 / 위협·공격 소문이 돌면 줄이 달라진다
function firstEvening(g) {
  const h = Time.hour(g.W.time.t);
  if (h >= 20 || h < 5) return ['', '광장은 비어 있다. 우물 둘레 돌의자에 아무도 없다.', '불 켜진 창 하나에서 그림자가 움직이더니, 덧문이 닫힌다.'];
  if (h < 18) return [];
  const W = g.W;
  const feared = Object.values(W.npcs).some((n) => n.alive && n.role !== 'visitor' && Object.keys(n.knowledge.rumors)
    .some((id) => W.rumors[id] && W.rumors[id].subject === 'player' && ['threatened', 'attacked'].includes(W.rumors[id].type)));
  return ['', '돌의자에 앉아 있던 사람들의 말소리가 뚝 끊긴다.', '얼굴들이 일제히 이쪽을 향한다.',
    ...(W.worldFlags.vouched || W.worldFlags.cameWithLia ? ['누군가 울타리 쪽을 턱으로 가리킨다. 다들 무언가 들은 눈치다.'] : []),
    feared ? '아무도 다시 말을 잇지 않는다. 누군가 일어나 집 안으로 들어가 문을 닫는다.' : '……그리고 하나둘, 다시 저희끼리 낮게 말을 나눈다. 이쪽을 힐끔거리면서.'];
}

const mealTime = (W) => { const h = Time.hour(W.time.t); return (h >= 6 && h < 8) || (h >= 12 && h < 13) || (h >= 18 && h < 22); };
const HERBYARD = {
  managed: '마당 가득 풀을 펴 말리고 있다.',
  unsteady: '널린 풀 사이로 손이 덜 간 자리가 보인다.',
  bedridden: '마당의 풀이 널린 채 그대로 말라 간다.',
};

LOCS.village_inn = {
  name: '여관 겸 밥집',
  // 식사 시간 6~8 · 12~13 · 18~22시 (시작마을.md 1-4절 ③, 15절)
  desc: (g) => [`나무 탁자 몇 개와 긴 의자가 놓인 넓은 방이다. ${mealTime(g.W) ? '안쪽에서 국 끓는 냄새가 난다.' : '안쪽 화덕이 낮게 가라앉아 있다.'}`,
    '계단 위로 작은 방들이 이어진다.', g.dark ? '화로 불빛이 탁자 위에 흔들린다.' : '창으로 광장이 내다보인다.'],
  exits: [{ to: 'village_square', label: '광장으로 나간다', min: 3, kw: ['광장', '나가'], text: ['광장으로 나간다.'] }],
  actions: [],
};

// 약초집: 노파의 집이자 치료소. 리아도 여기서 산다 [D10]. 마당 한쪽에 헛간이 있다 (첫 잠자리 ① [결정 #10])
LOCS.village_herbhouse = {
  name: '약초집',
  // 노파의 단계가 풍경에 보인다 [D13] (시작마을.md 15절). [처음] 풀 다발이 몇 배는 많다 (단계 5 장면 문장 A-①)
  desc: (g) => [
    ...(g.first('v_herbhouse') ? ['다른 집보다 풀 다발이 몇 배는 많다. 처마가 풀에 덮여 기울어 보일 정도다.',
      ...(g.W.worldFlags.cameWithLia ? ['리아가 들어간 집이다.'] : [])] : []),
    `처마 밑에 약초 다발이 빽빽하게 매달려 있다. ${HERBYARD[Condition.stageOf(g.W.npcs.herbalist) || 'managed']}`,
    '안쪽에 약초 통과 절구가 보인다.', '마당 한쪽에 마른 풀 냄새가 나는 헛간이 있다.', VSKY[g.period]],
  exits: [
    { to: 'village_square', label: '광장으로 간다', min: 5, kw: ['광장'], text: ['광장으로 걷는다.'] },
    { to: 'village_homes', label: '이웃집들 쪽으로 간다', min: 3, kw: ['집', '이웃'], text: ['낮은 지붕들 사이로 걷는다.'] },
  ],
  actions: [],
};

LOCS.village_homes = {
  name: '마을 집들',
  desc: (g) => ['낮은 지붕의 집 몇 채가 모여 있다. 굴뚝에서 연기가 오른다.', '처마마다 약초 다발이 한두 개씩 걸려 있다.', VSKY[g.period]],
  exits: [
    { to: 'village_square', label: '광장으로 간다', min: 5, kw: ['광장'], text: ['광장으로 걷는다.'] },
    { to: 'village_herbhouse', label: '약초 냄새가 짙은 집으로 간다', min: 3, kw: ['약초집', '약초'], text: ['쓴 풀 냄새가 가장 짙은 집으로 걷는다.'] },
  ],
  actions: [],
};

LOCS.village_field = {
  name: '마을 밭',
  desc: (g) => ['울타리 안쪽의 밭이다. 이랑이 곧게 나 있다.', '밭 가장자리에 잎이 넓은 풀이 무성하다.', VSKY[g.period]],
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 10, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

// 대장간 겸 잡화 가게 [D7]. 대장장이는 일반 주민 [후보]이라 아직 없다 — 장소만 있다
LOCS.village_smithy = {
  name: '대장간',
  desc: (g) => ['모루와 화덕이 있는 작업장이다. 벽에 낫과 괭이, 손질을 기다리는 칼 몇 자루가 걸려 있다.',
    '선반에는 밧줄과 등잔 같은 잡동사니가 쌓여 있다.', '화덕은 식어 있다. 주인은 보이지 않는다.'],
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 3, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

// 길드 연락소 [D7: 나중에 열림]. 여는 조건은 아직 없다 (스토리설계.md PART 5 단계 8 [미확정]) — worldFlags.guildOpen
LOCS.village_guild = {
  name: '길드 연락소',
  desc: (g) => (g.W.worldFlags.guildOpen
    ? ['작은 방에 탁자 하나와 게시판이 있다. 게시판에 종이 몇 장이 꽂혀 있다.']
    : ['문패가 걸린 작은 건물이다. 문이 굳게 닫혀 있다.', '문 옆 게시판은 비어 있다.']),
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 5, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

// [임시] 교회의 구호 거처. 플레이어는 처음에 이곳이 무엇인지 모른다 (이름은 HUD에만 보인다)
LOCS.village_chapel = {
  name: '작은 예배당',
  // 신앙의 상징은 [미확정 설정]이라 문양을 두지 않는다 (시작마을.md 15절)
  desc: (g) => ['지붕이 뾰족한 작은 건물이다. 안은 서늘하고 조용하다.', '앞쪽에 돌 하나가 놓여 있다.', '한쪽 구석에 담요 몇 장이 개어져 있다.'],
  exits: [{ to: 'village_square', label: '광장으로 간다', min: 5, kw: ['광장'], text: ['광장으로 걷는다.'] }],
  actions: [],
};

if (typeof module !== 'undefined') module.exports = { gateBlock };
