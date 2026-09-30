// 귀환 — 이세계 표류기 (게임 로직)
const MAX_DAY = 40;
const RESCUE_SIGNAL = 16;
// 스탯/자원 정의: 이름, 상한(없으면 무제한), 위험 기준(값이 이 이하이면 경고)
const STATS = {
  food: { label: '식량', low: (s) => rationNeed(s) },
  fuel: { label: '마력석', low: () => 2 },
  med: { label: '약초', low: () => 0 },
  morale: { label: '사기', max: 10, low: () => 2 },
  signal: { label: '의식', max: RESCUE_SIGNAL },
};
const STAT_KEYS = Object.keys(STATS);
const LABEL = Object.fromEntries(STAT_KEYS.map((k) => [k, STATS[k].label]));
const NAMES = ['민준', '서연', '하준', '지우', '도윤', '수아', '예준', '하은', '시우', '유나', '건우', '채원'];
const ROLES = { hero: '주인공', doctor: '간호사', mech: '기계공', hunter: '등산가', radio: '대학원생', teacher: '교사' };
const COMPANION_ROLES = ['doctor', 'mech', 'hunter', 'radio', 'teacher'];
const chance = (p) => Math.random() < p;
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
// 하루 식량 소비량: 정량 = 인원의 60%, 절반 배급 = 30% (올림)
const rationNeed = (s) => Math.ceil(s.people.length * (s.ration === 'full' ? 0.6 : 0.3));
const has = (s, role) => s.people.some((p) => p.role === role);
const heroAlive = (s) => s.people.some((p) => p.role === 'hero');

const INTRO = [
  '오전 8시 17분. 통학 셔틀버스가 터널에 들어서는 순간, 창밖이 하얗게 터졌다.',
  '눈을 떴을 때 나는 낯선 숲 한가운데 처박힌 버스 안에 있었다. 하늘에는 달이 두 개 떠 있었다.',
  '휴대폰은 먹통이고, 지도에 없는 짐승이 숲에서 울었다. 버스에서 함께 깨어난 사람은 넷이다.',
  '그런데 이상하다. 버스 뒤편에 갈라진 공기의 틈, 균열이 유독 나에게만 반응한다. 다가서면 푸르게 일렁이고, 손을 대면 따뜻하다.',
  '푸른 결정, 마력석을 모아 의식을 올리면 이 틈이 다시 열릴지 모른다. 그 의식을 이끌 수 있는 사람은 나뿐이다.',
  '집에 돌아가려면 내가 살아남아야 하고, 동료들도 지켜야 한다. 밤마다 마물이 다가오지 못하게 결계를 피워야 하고, 먹을 것도 구해야 한다.',
];

const MILESTONES = {
  7: '일주일이 지났다. 균열은 여전히 나에게만 미지근한 온기를 보낸다. 동료들은 그걸 신기한 듯, 조금 두렵게 바라본다.',
  15: '균열이 밤마다 조금씩 숨을 쉰다. 그 너머로 아주 희미하게 도시의 소음이 들린 것 같다. 나는 아무에게도 말하지 않았다.',
  25: '캠프에 제법 사람 사는 모양이 갖춰졌다. 돌아가고 싶은 마음과 남고 싶은 마음이 뒤섞인다.',
  35: '균열이 눈에 띄게 커졌다. 열 수 있는 날이 머지않았다. 아니면 이곳이 새 집이 될 수도 있다.',
};

function newState() {
  const names = [...NAMES].sort(() => Math.random() - 0.5);
  const roles = [...COMPANION_ROLES].sort(() => Math.random() - 0.5).slice(0, 4);
  return {
    day: 1, food: 16, fuel: 10, med: 3, morale: 6, signal: 0,
    people: [{ name: '나', role: 'hero', sick: false }, ...roles.map((role, i) => ({ name: names[i], role, sick: false }))],
    ration: 'full', broadcast: false, forage: false,
    items: {}, flags: {}, lastEvent: null, d: [], over: null,
  };
}

// 자원 변화 기록 (결과 화면에 표시)
function chg(s, k, n) {
  const before = s[k];
  const max = STATS[k].max ?? Infinity;
  s[k] = Math.max(0, Math.min(max, s[k] + n));
  const real = s[k] - before;
  if (real !== 0) s.d.push(`${LABEL[k]} ${real > 0 ? '+' : ''}${real}`);
}

function lose(s, prefer) {
  const cands = s.people.map((p, i) => i).filter((i) => s.people[i].role !== 'hero');
  if (!cands.length) return '';
  let idx = prefer ? s.people.findIndex((p) => p.role === prefer) : -1;
  if (idx < 0) idx = pick(cands);
  const [p] = s.people.splice(idx, 1);
  s.d.push(`${p.name}(${ROLES[p.role]}) 사망`);
  chg(s, 'morale', -1);
  return p.name;
}

function makeSick(s) {
  const healthy = s.people.filter((p) => !p.sick);
  if (!healthy.length) return null;
  const p = pick(healthy);
  p.sick = true;
  s.d.push(`${p.name} 앓아누움`);
  return p.name;
}

function addPerson(s, role) {
  const used = new Set(s.people.map((p) => p.name));
  const name = pick(NAMES.filter((n) => !used.has(n)).concat(['낯선이']));
  s.people.push({ name, role: role || pick(COMPANION_ROLES), sick: false });
  s.d.push(`${name}(${ROLES[s.people.at(-1).role]}) 합류`);
  return name;
}

// ---- 이벤트 ----
// choice: { label, need:{자원:수량}, role, run(s)->결과문 }
const EVENTS = [
  {
    id: 'quiet', title: '두 개의 달 아래', w: 5,
    text: '바람이 잦아들고 숲이 조용하다. 하늘에는 여전히 달이 두 개 떠 있다. 오늘은 아무 일도 없을 것 같다.',
    choices: [
      { label: '푹 쉰다', run: (s) => { chg(s, 'morale', 1); return '오랜만에 다들 깊이 잠들었다.'; } },
      { label: '주변을 정리하며 물자를 챙긴다', run: (s) => { chg(s, 'food', 1); chg(s, 'fuel', 1); return '풀숲에서 마력석 조각과 열매를 조금 주웠다.'; } },
    ],
  },
  {
    id: 'footprints', title: '세 갈래 발톱', w: 3,
    text: '진흙에 사람 발자국이 아닌 흔적이 찍혀 있다. 세 갈래 발톱이다. 흔적은 숲 안쪽 둥지로 이어진다.',
    choices: [
      { label: '흔적을 따라간다', run: (s) => {
          if (chance(0.6)) { chg(s, 'food', 3); return '주인 없는 둥지에서 알과 말린 고기를 찾았다.'; }
          lose(s); return '둥지의 주인이 돌아왔다. 돌아오지 못한 사람이 있다.'; } },
      { label: '결계를 강화하고 밤새 경계한다', run: (s) => { chg(s, 'fuel', -1); return '아무것도 오지 않았다. 마력석만 소모됐다.'; } },
    ],
  },
  {
    id: 'stranger', title: '숲에서 온 방랑자', w: 3,
    text: '숲에서 낯선 복장의 사람이 쓰러진 채 발견됐다. 말은 알아듣기 어렵지만, 무언가를 간절히 말하려 한다.',
    choices: [
      { label: '들여서 돌본다', need: { food: 2 }, run: (s) => {
          if (chance(0.5)) { addPerson(s); chg(s, 'morale', 1); return '회복한 그는 이곳 말을 조금씩 가르쳐 주며 남기로 했다.'; }
          if (chance(0.5)) { makeSick(s); return '그는 이튿날 떠났다. 낯선 열병만 남기고.'; }
          return '그는 밤을 넘기지 못했다. 다들 말이 없다.'; } },
      { label: '간호사가 진찰한 뒤 결정한다', role: 'doctor', run: (s) => {
          if (!has(s, 'doctor')) return '간호사가 없다.';
          addPerson(s); chg(s, 'food', -1); return '전염병은 아님을 확인하고 받아들였다.'; } },
      { label: '돌려보낸다', run: (s) => { chg(s, 'morale', -2); return '덤불 너머로 신음이 새벽까지 이어졌다.'; } },
    ],
  },
  {
    id: 'warehouse', title: '무너진 유적', w: 4,
    text: '이끼 낀 석조 유적이 보인다. 입구가 반쯤 무너졌고 안쪽에서 푸른 빛이 새어 나온다.',
    choices: [
      { label: '깊이 들어가 뒤진다', run: (s) => {
          if (chance(0.35)) { lose(s); return '천장이 무너졌다.'; }
          chg(s, 'food', 3); chg(s, 'fuel', 2); chg(s, 'med', 1); return '보물창고였다. 마력석과 저장 식량, 약초까지 건졌다.'; } },
      { label: '입구 쪽만 훑는다', run: (s) => { chg(s, 'food', 1); chg(s, 'fuel', 1); return '안전하게 조금만 챙겼다.'; } },
    ],
  },
  {
    id: 'generator', title: '버스의 계기판', w: 3,
    text: '버스 잔해의 계기판이 홀로 깜빡인다. 배터리가 없는데도 불이 들어온다. 균열과 공명하고 있는 것 같다.',
    choices: [
      { label: '기계공이 배선을 손본다', role: 'mech', run: (s) => {
          if (!has(s, 'mech')) return '기계공이 없다.';
          chg(s, 'signal', 1); return '마력석을 배선에 물려 공명을 안정시켰다. 의식이 한 걸음 나아갔다.'; } },
      { label: '마력석을 더 밀어 넣는다', need: { fuel: 2 }, run: () => '불이 안정됐다. 간신히 버틴다.' },
      { label: '내버려 둔다', run: (s) => { chg(s, 'signal', -1); chg(s, 'morale', -1); return '공명이 끊겼다. 의식이 조금 무너졌다.'; } },
    ],
  },
  {
    id: 'flu', title: '숲의 열병', w: 3,
    text: '밤새 누군가 기침을 멈추지 않는다. 이 세계의 병이라 면역이 없다. 곧 다른 사람에게도 옮을 것 같다.',
    choices: [
      { label: '약초를 나눠 먹인다', need: { med: 2 }, run: (s) => { chg(s, 'morale', 1); return '큰 일 없이 지나갔다.'; } },
      { label: '버스 뒷좌석에 격리한다', run: (s) => { makeSick(s); chg(s, 'morale', -1); return '한 사람이 격리된 채 앓고 있다.'; } },
      { label: '간호사에게 맡긴다', role: 'doctor', run: (s) => {
          if (!has(s, 'doctor')) return '간호사가 없다.';
          chg(s, 'med', -1); return '적은 약초로 효과적으로 처치했다.'; } },
    ],
  },
  {
    id: 'radio-trade', title: '떠돌이 상인', w: 3, cond: (s) => s.day >= 3,
    text: '짐마차를 끄는 상인이 손짓 발짓으로 물물교환을 청한다. 마차에는 상자가 가득하다.',
    choices: [
      { label: '식량 3 ↔ 약초 2', need: { food: 3 }, run: (s) => { chg(s, 'med', 2); return '거래가 무사히 끝났다.'; } },
      { label: '마력석 3 ↔ 식량 5', need: { fuel: 3 }, run: (s) => { chg(s, 'food', 5); return '넉넉한 거래였다.'; } },
      { label: '거래 대신 이 세계 이야기를 듣는다', run: (s) => { chg(s, 'signal', 1); return '균열에 대한 전설을 들었다. 의식에 도움이 될 단서다.'; } },
    ],
  },
  {
    id: 'hunt', title: '뿔 달린 사슴', w: 3,
    text: '숲 가장자리에 뿔이 세 개 달린 사슴이 나타났다. 사냥하기 좋은 기회다.',
    choices: [
      { label: '등산가와 함께 나선다', role: 'hunter', run: (s) => {
          if (!has(s, 'hunter')) return '등산가가 없다.';
          chg(s, 'food', 6); return '트래킹 솜씨로 한 마리를 잡아 왔다. 오늘 밤은 푸짐하다.'; } },
      { label: '아무나 보내 본다', run: (s) => {
          if (chance(0.35)) { chg(s, 'food', 4); return '운 좋게 잡았다.'; }
          if (chance(0.4)) { lose(s); return '돌아오지 않았다.'; }
          return '빈손으로 돌아왔다.'; } },
      { label: '포기한다', run: () => '무리할 필요 없다.' },
    ],
  },
  {
    id: 'blizzard', title: '마력 폭풍', w: 3,
    text: '하늘이 보랏빛으로 물들었다. 마력 폭풍이다. 결계가 흔들리고 마물이 웅성거린다.',
    choices: [
      { label: '마력석을 아낌없이 쓴다', need: { fuel: 2 }, run: (s) => { chg(s, 'morale', 1); return '결계가 버텼다. 폭풍이 지나갔다.'; } },
      { label: '버스 안에 모여 숨죽인다', run: (s) => { chg(s, 'morale', -1); if (chance(0.3)) makeSick(s); return '길고 무서운 밤이었다.'; } },
    ],
  },
  {
    id: 'thief', title: '사라진 식량', w: 3, cond: (s) => s.people.length >= 3 && s.food >= 3,
    text: '아침에 보니 식량이 없어졌다. 누군가 몰래 먹었거나 숨겼다. 마물의 짓일 수도 있지만, 흔적은 사람 발자국이다.',
    choices: [
      { label: '범인을 찾아낸다', run: (s) => {
          chg(s, 'food', 2); chg(s, 'morale', -2); return '한 사람이 고개를 숙였다. 분위기가 얼어붙었다.'; } },
      { label: '눈감아 준다', run: (s) => { chg(s, 'food', -2); chg(s, 'morale', 1); return '아무도 묻지 않았다. 다만 창고가 비었다.'; } },
      { label: '교사가 대화로 푼다', role: 'teacher', run: (s) => {
          if (!has(s, 'teacher')) return '교사가 없다.';
          chg(s, 'morale', 2); return '교사가 조용히 이야기를 들었다. 식량은 돌아왔다.'; } },
    ],
  },
  {
    id: 'phone', title: '꺼진 휴대폰', w: 2,
    text: '누군가 죽은 휴대폰의 갤러리를 마지막으로 한 번만 더 보고 싶다고 한다. 가족 사진이다. 충전할 방법은 없다.',
    choices: [
      { label: '마력석으로 잠깐 켜 준다', need: { fuel: 1 }, run: (s) => { chg(s, 'morale', 3); return '화면이 켜졌다. 다들 모여 사진을 들여다봤다.'; } },
      { label: '아껴야 한다고 말한다', run: (s) => { chg(s, 'morale', -1); return '그는 아무 말 없이 휴대폰을 주머니에 넣었다.'; } },
    ],
  },
  {
    id: 'raiders', title: '도적단', w: 3, cond: (s) => s.day >= 6,
    text: '숲 어귀에서 여러 사람이 다가온다. 손에 든 것은 창과 도끼다. 이쪽 캠프를 노리고 있다.',
    choices: [
      { label: '식량 4를 내주고 돌려보낸다', need: { food: 4 }, run: () => '그들은 물건을 받고 떠났다.' },
      { label: '매복해서 막는다', run: (s) => {
          if (chance(0.5)) { chg(s, 'food', 2); chg(s, 'med', 1); return '기습에 성공했다. 그들이 두고 간 물자가 있다.'; }
          lose(s); chg(s, 'food', -3); return '격렬한 교전이었다. 피해가 컸다.'; } },
      { label: '불을 끄고 숨는다', run: (s) => {
          if (chance(0.55)) return '그들은 지나쳐 갔다.';
          chg(s, 'food', -3); chg(s, 'fuel', -2); return '그들이 물자를 뒤지고 갔다.'; } },
    ],
  },
  {
    id: 'signal-boost', title: '균열의 맥동', w: 2, cond: (s) => s.day >= 5 && s.signal < 12,
    text: '버스 뒤편의 균열이 규칙적으로 깜빡인다. 마치 이쪽에 응답하려는 것 같다.',
    choices: [
      { label: '마력석으로 응답 파장을 보낸다', need: { fuel: 1 }, run: (s) => { chg(s, 'signal', 2); return '틈이 밝게 흔들렸다. 의식이 크게 나아갔다.'; } },
      { label: '대학원생에게 맡긴다', role: 'radio', run: (s) => {
          if (!has(s, 'radio')) return '대학원생이 없다.';
          chg(s, 'signal', 3); return '대학원생이 밤새 마법 문양을 해석했다. 의식이 훌쩍 나아갔다.'; } },
      { label: '무시한다', run: () => '맥동이 멎었다.' },
    ],
  },
  {
    id: 'song', title: '밤의 노래', w: 2,
    text: '모닥불 옆에서 누군가 흥얼거리기 시작했다. 고향에서 부르던 노래다. 어느새 다들 따라 부른다.',
    choices: [
      { label: '함께 부른다', run: (s) => { chg(s, 'morale', 2); return '숲도 잠깐 조용해졌다.'; } },
      { label: '소리가 마물을 부를까 봐 막는다', run: (s) => { chg(s, 'morale', -1); return '조용하지만 답답한 밤이었다.'; } },
    ],
  },
  {
    id: 'can', title: '수상한 열매', w: 3,
    text: '보랏빛 열매가 덤불에 가득 열려 있다. 냄새가 달콤하지만 이 세계의 독인지 모른다.',
    choices: [
      { label: '전부 먹는다', run: (s) => {
          if (chance(0.4)) { makeSick(s); makeSick(s); return '배탈이 났다.'; }
          chg(s, 'food', 5); return '멀쩡했다. 오히려 맛있다!'; } },
      { label: '한 사람이 먼저 먹어 본다', run: (s) => { chg(s, 'food', 2); return '별 탈이 없었다. 절반쯤만 챙겼다.'; } },
    ],
  },
  {
    id: 'airdrop', title: '별똥별', w: 2, cond: (s) => s.day >= 8,
    text: '하늘에서 무언가 떨어지는 것이 보였다. 마력석이 섞인 유성이다. 낙하지점은 두 곳이고 한 곳만 갈 수 있다.',
    choices: [
      { label: '동쪽 (가깝다, 작다)', run: (s) => { chg(s, 'food', 3); chg(s, 'fuel', 2); return '작은 파편을 주웠다.'; } },
      { label: '서쪽 (멀다, 크다)', run: (s) => {
          if (chance(0.55)) { chg(s, 'food', 6); chg(s, 'fuel', 4); chg(s, 'med', 2); return '거대한 마력석 덩어리와 열매숲을 발견했다!'; }
          chg(s, 'morale', -2); return '이미 도적단이 훑고 지나간 뒤였다.'; } },
    ],
  },
  {
    id: 'leave', title: '떠나자는 사람', w: 3, cond: (s) => s.people.length >= 3 && s.morale <= 6,
    text: '한 사람이 짐을 꾸린다. "남쪽에 성이 있대. 기사단이 보호해 준다는 소문도 있어. 여기서 이러고 있을 순 없어."',
    choices: [
      { label: '붙잡고 설득한다', run: (s) => {
          if (chance(0.5)) { chg(s, 'morale', 1); return '결국 남기로 했다.'; }
          lose(s); return '그는 새벽에 몰래 떠났다.'; } },
      { label: '식량을 챙겨 보내 준다', need: { food: 2 }, run: (s) => {
          const cands = s.people.map((q, i) => i).filter((i) => s.people[i].role !== 'hero');
          const p = s.people.splice(pick(cands), 1)[0];
          s.d.push(`${p.name} 떠남`); chg(s, 'morale', -1);
          return `${p.name}은(는) 숲길 너머로 사라졌다.`; } },
    ],
  },
  {
    id: 'wolves', title: '그림자 늑대', w: 2, cond: (s) => s.day >= 4,
    text: '밤에 결계 밖에서 눈 여섯 개짜리 그림자가 어른거린다. 식량 냄새를 맡았다.',
    choices: [
      { label: '결계를 키워 쫓는다', need: { fuel: 2 }, run: () => '그림자들이 물러났다.' },
      { label: '등산가가 나선다', role: 'hunter', run: (s) => {
          if (!has(s, 'hunter')) return '등산가가 없다.';
          chg(s, 'food', 3); return '한 마리를 잡고 나머지는 쫓았다.'; } },
      { label: '버스 문을 걸어 잠근다', run: (s) => {
          if (chance(0.5)) { chg(s, 'food', -3); return '식량 창고가 뜯겼다.'; }
          return '새벽에 물러갔다.'; } },
    ],
  },
  {
    id: 'diary', title: '모험가의 일지', w: 2,
    text: '숲에서 백골이 된 모험가의 가방을 찾았다. 일지의 마지막 장에 지도가 그려져 있다.',
    choices: [
      { label: '지도를 따라가 본다', run: (s) => {
          if (chance(0.55)) { chg(s, 'med', 2); chg(s, 'food', 2); return '지도가 가리킨 곳에 비축 창고가 있었다.'; }
          chg(s, 'fuel', -1); return '아무것도 없었다. 헛걸음이다.'; } },
      { label: '일지를 읽고 조용히 묻어 준다', run: (s) => {
          chg(s, 'morale', 1); if (!Inventory.has(s, 'rope')) Inventory.add(s, 'rope');
          return '낯선 세계의 누군가를 기억하기로 했다. 가방에 든 튼튼한 밧줄은 유품으로 받아 두었다.'; } },
    ],
  },
  {
    id: 'cliff', title: '절벽 아래의 빛', w: 3,
    text: '숲 끝의 절벽 아래에서 푸른 빛이 깜빡인다. 마력석 광맥 같다. 맨몸으로 내려가기엔 너무 가파르다.',
    choices: [
      { label: '밧줄을 걸고 내려간다', item: 'rope', run: (s) => {
          if (chance(0.15)) { lose(s); return '밧줄이 끊겼다. 돌아오지 못한 사람이 있다.'; }
          chg(s, 'fuel', 4); chg(s, 'med', 1); return '절벽 아래에서 마력석 광맥과 약초를 찾았다. 밧줄은 다시 회수했다.'; } },
      { label: '위에서 내려다보기만 한다', run: (s) => { chg(s, 'morale', -1); return '손이 닿지 않는 빛을 보며 다들 입맛만 다셨다.'; } },
    ],
  },
  {
    id: 'moons', title: '달이 겹치는 밤', w: 2, cond: (s) => s.day >= 10,
    text: '두 개의 달이 하늘에서 겹친다. 균열이 눈에 띄게 밝아졌다. 지금이 의식을 하기에 가장 좋은 때라고 대학원생이 말한다.',
    choices: [
      { label: '마력석 3을 모두 쏟아붓는다', need: { fuel: 3 }, run: (s) => { chg(s, 'signal', 4); return '균열이 크게 벌어졌다. 이 밤을 놓치지 않았다.'; } },
      { label: '무리하지 않고 지켜본다', run: (s) => { chg(s, 'morale', 1); return '달이 겹치는 모습은 놀랍도록 아름다웠다.'; } },
    ],
  },
  {
    id: 'knight', title: '순찰 기사', w: 2, cond: (s) => s.day >= 7,
    text: '갑옷을 입은 낯선 기사 한 명이 캠프 앞에 멈췄다. 말이 통하지 않지만, 악의는 없어 보인다.',
    choices: [
      { label: '식량을 나눠 주며 환대한다', need: { food: 2 }, run: (s) => {
          chg(s, 'morale', 1); chg(s, 'med', 1); return '기사는 약초 한 다발을 남기고 손짓하며 떠났다.'; } },
      { label: '교사가 손짓으로 대화를 시도한다', role: 'teacher', run: (s) => {
          if (!has(s, 'teacher')) return '교사가 없다.';
          chg(s, 'signal', 1); chg(s, 'morale', 1); return '몇 마디를 배웠다. 이 세계와 균열에 대한 소문도 들었다.'; } },
      { label: '경계하며 물러선다', run: () => '기사는 잠시 살피다 떠났다.' },
    ],
  },
];

function pickEvent(s) {
  const pool = EVENTS.filter((e) => e.id !== s.lastEvent && (!e.cond || e.cond(s)));
  const total = pool.reduce((a, e) => a + e.w, 0);
  let r = Math.random() * total;
  for (const e of pool) { if ((r -= e.w) < 0) return e; }
  return pool[0];
}

function canPay(s, need) {
  return !need || Object.entries(need).every(([k, v]) => s[k] >= v);
}

// 선택지를 실행하고 결과 텍스트 반환
function runChoice(s, ev, idx) {
  s.d = [];
  const c = ev.choices[idx];
  if (!canPay(s, c.need)) return '자원이 부족하다.';
  if (c.need) for (const [k, v] of Object.entries(c.need)) chg(s, k, -v);
  s.lastEvent = ev.id;
  return c.run(s);
}

// 하루를 마무리한다. 밤 처리 로그를 반환
function endDay(s) {
  s.d = [];
  const notes = [];
  const n = s.people.length;

  // 수색 파견
  if (s.forage) {
    chg(s, 'food', 2); chg(s, 'fuel', 1);
    notes.push('수색조가 숲 가장자리에서 물자를 조금 모아 왔다.');
    if (chance(0.2)) { makeSick(s); notes.push('수색 중 누군가 몸이 상했다.'); }
  }

  // 식량
  let fed = false, warm = false;
  const need = rationNeed(s);
  if (s.food >= need) {
    chg(s, 'food', -need);
    if (s.ration === 'full') fed = true;
    else notes.push('절반 배급에 다들 배를 움켜쥐고 잠들었다.');
  } else {
    const short = need - s.food;
    chg(s, 'food', -s.food);
    chg(s, 'morale', -2);
    notes.push('식량이 모자랐다.');
    if (short >= 2) lose(s);
  }

  // 결계·의식
  if (s.fuel >= 1) {
    chg(s, 'fuel', -1);
    warm = true;
    if (s.broadcast && s.fuel >= 1) {
      chg(s, 'fuel', -1);
      chg(s, 'signal', has(s, 'radio') ? 2 : 1);
      notes.push('귀환 의식을 올렸다. 균열이 내 손끝에서 푸르게 일렁였다.');
    } else if (s.broadcast) {
      notes.push('마력석이 부족해 의식을 올리지 못했다.');
    }
  } else {
    chg(s, 'morale', -1);
    makeSick(s);
    notes.push('결계가 꺼졌다. 밤새 마물 울음소리에 떨었다.');
  }

  if (fed && warm) chg(s, 'morale', 1);

  // 병자
  for (const p of [...s.people]) {
    if (!p.sick) continue;
    if (s.med >= 1) {
      chg(s, 'med', -1);
      p.sick = false;
      notes.push(`${p.name}은(는) 약초를 먹고 회복했다.`);
    } else if (chance(0.5)) {
      s.people.splice(s.people.indexOf(p), 1);
      s.d.push(`${p.name} 사망`);
      chg(s, 'morale', -2);
      notes.push(p.role === 'hero' ? '열병이 끝내 나를 쓰러뜨렸다. 의식이 흐려진다.' : `${p.name}은(는) 약초가 없어 끝내 숨을 거두었다.`);
    }
  }

  // 종료 판정
  if (s.signal >= RESCUE_SIGNAL) s.over = 'rescued';
  else if (!heroAlive(s)) s.over = 'dead';
  else if (s.morale <= 0) s.over = 'mutiny';
  else if (s.day >= MAX_DAY) s.over = 'lost';
  else { s.day += 1; s.broadcast = false; s.forage = false; }
  return { notes, delta: s.d.slice() };
}

const ENDINGS = {
  rescued: ['균열이 열렸다', '균열이 내 손끝에서 활짝 열렸다. 푸른 빛이 버스를 삼켰다. 눈을 뜨자 터널 안이었고, 시계는 8시 17분을 가리키고 있었다. 모든 게 꿈이었을까. 주머니 속에서 푸른 결정 하나가 손끝에 닿았다.'],
  dead: ['내가 쓰러졌다', '의식을 이끌 사람이 사라졌다. 남은 동료들이 나를 묻어 주었다. 균열은 더는 아무에게도 반응하지 않는다.'],
  mutiny: ['흩어진 사람들', '더는 아무도 나를 믿지 않는다. 동료들은 각자의 길로 숲속으로 흩어졌고, 나는 홀로 균열 앞에 남았다.'],
  lost: ['이 세계의 주민', `${MAX_DAY}일이 지났다. 균열은 끝내 열리지 않았다. 하지만 캠프는 어느새 작은 마을이 되었다. 나는 이 세계에서, 새로운 이야기를 시작하기로 했다.`],
};

if (typeof module !== 'undefined') {
  module.exports = { heroAlive, newState, pickEvent, runChoice, endDay, canPay, rationNeed, STATS, STAT_KEYS, EVENTS, ENDINGS, ROLES, MAX_DAY, RESCUE_SIGNAL, chance };
}
