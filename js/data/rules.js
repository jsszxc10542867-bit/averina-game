// 생활 규칙 수치. 스토리·밸런스를 정하면 이 파일만 고친다.
// [임시] = 시스템이 먼저 돌아가도록 넣은 값. 스토리_재설계.md 11절(쓰러짐)과 6절(생활 활동)의 결정을 기다린다.

const RULES = {
  // ---------- 첫날 밤 보호 [결정 #6, 2026-09-30] ----------
  // 게임 시작부터 이 시각까지는 피해가 체력 minHp에서 멈추고 쓰러지지 않는다. 탈진·부상·소모는 그대로 남는다.
  // 장면이 죽음으로 끝나도(밤의 목소리) 쓰러짐 대신 "정신이 아득해졌다가 돌아오는" 결과로 받는다 (engine.js shaken)
  protection: { until: [2, 6], minHp: 1, shakenMin: 60, shakenFatigue: 30 },

  // ---------- 쓰러짐 (체력 0) — 죽지 않는다. 대가가 남는다 [임시] ----------
  collapse: {
    aloneMin: [360, 600],      // 아무도 없으면 이만큼(분) 정신을 잃는다
    aloneHp: 0.3,              // 혼자 깨어났을 때 체력 비율
    rescuedMin: 180,           // 누군가 구해 주면 돌봄을 받다가 이만큼 뒤 깨어난다
    rescuedHp: 0.6,
    // 구해 줄 사람: 곁이나 바로 이웃 장소에 있고, 나를 적대하지 않으며, 믿거나(신뢰) 착하다(친절)
    rescuer: { maxHostility: 30, minTrust: 30, minKindness: 60 },
    lossChanceAlone: 0.5,      // 혼자 쓰러져 있는 동안 소지품 하나를 잃을 가능성 (짐승이 뒤지거나 누가 가져간다)
    repeatWindow: 1440,        // 이 시간(분) 안에 또 쓰러지면 더 오래 정신을 잃는다
    repeatExtra: 180,
  },

  // ---------- 일 (품삯) [임시] ----------
  // giver: 일을 주는 NPC / at: 일하는 곳 / hours: 일을 받을 수 있는 시각 / min: 걸리는 시간 / pay: 품삯(동전)
  // stat: 쓰는 몸 / tendency: 쌓이는 직업 경향 / minTrust: 일을 맡길 만큼 믿어야 하는 정도
  jobs: {
    // 일을 주는 사람이 그 시각에 그곳에 있어야 한다 (NPC 일정: data/npcs.js SCHEDULES)
    field: { label: '밭일을 거든다', giver: 'herbalist', at: 'village_field', hours: [6, 11], min: 120, pay: 4,
      stat: 'str', fatigue: 25, tendency: 'labor', minTrust: 0,
      lines: ['흙을 뒤집고, 돌을 골라내고, 물을 길어 나른다.', '허리가 끊어질 것 같다. 해가 한 뼘 기울었다.'] },
    herbs: { label: '약초 손질을 돕는다', giver: 'herbalist', at: 'village_homes', hours: [12, 17], min: 90, pay: 3,
      stat: 'int', fatigue: 10, tendency: 'healer', minTrust: 20,
      lines: ['마른 풀을 종류대로 가르고, 뿌리의 흙을 턴다.', '노파가 어떤 잎은 따로 두라고 손짓한다. 냄새가 다르다.'] },
    errand: { label: '짐 나르는 심부름을 한다', giver: 'merchant', at: 'village_square', hours: [8, 18], min: 60, pay: 2,
      stat: 'agi', fatigue: 15, tendency: 'trade', minTrust: 10,
      lines: ['자루를 등에 지고 광장과 집들 사이를 오간다.', '돌아올 때마다 상인이 손가락으로 다음 자루를 가리킨다.'] },
    watch: { label: '울타리를 함께 지킨다', giver: 'gatekeeper', at: 'village_gate', hours: [13, 18], min: 120, pay: 3,
      stat: 'sen', fatigue: 15, tendency: 'guard', minTrust: 40,
      lines: ['울타리에 기대어 숲 쪽을 본다.', '남자가 이따금 숲 쪽을 가리키며 무언가 중얼거린다.'] },
    // 돈 대신 일로 하룻밤 값을 치른다 (거처 room_work에서만 쓴다. 일 목록에는 나오지 않는다) [결정 #10]
    chores: { label: '가게 일을 거든다', giver: 'merchant', at: 'village_square', hours: [16, 20], min: 90, pay: 0,
      stat: 'str', fatigue: 15, tendency: 'labor', minTrust: 0, lodgingOnly: true,
      lines: ['천막을 걷고, 궤짝을 나르고, 바닥을 쓴다.', '상인이 이것저것 손짓으로 시킨다. 말이 통하지 않아도 일은 통한다.'] },
  },
  // 직업 경향의 이름 (플레이어에게 보이는 말. 숫자는 보이지 않는다)
  tendencyKo: { labor: '몸 쓰는 일', healer: '약초 다루는 일', trade: '장사 심부름', guard: '지키는 일' },

  // ---------- 거처 [임시] — 첫 잠자리는 앞의 행동에 따라 갈린다 [결정 #10]. 어느 길이 정답인지 알려 주지 않는다 ----------
  // at: 자는 곳 / owner: 허락해 줄 사람 / price: 하룻밤 값 / minTrust: 허락받을 만큼의 신뢰 / quality: 잠의 질(0 노숙 ~ 2 방)
  // work: 돈 대신 거들 일 (jobs의 id) / charity: 구호 조건 { maxMoney: 이만큼 이하로 가진 사람만, maxNights: 머물 수 있는 밤 }
  // stays: 같은 방을 가리키는 다른 길 (일로 치른 가게 뒷방은 room에 묵는다)
  lodgings: {
    barn: { label: '노파네 헛간', at: 'village_homes', owner: 'herbalist', price: 0, minTrust: 30, quality: 1 },
    room: { label: '가게 뒷방', at: 'village_square', owner: 'merchant', price: 3, minTrust: 0, quality: 2 },
    // 여관은 공식 시설이지만 아직 데이터가 없어, 가게 뒷방이 대신한다 [임시]
    room_work: { label: '가게 뒷방', at: 'village_square', owner: 'merchant', price: 0, work: 'chores', stays: 'room', minTrust: 0, quality: 2 },
    chapel: { label: '예배당 구석', at: 'village_chapel', owner: null, price: 0, minTrust: 0, quality: 1, charity: { maxMoney: 1, maxNights: 3 } },
    rough: { label: '울타리 밑', at: 'village_gate', owner: null, price: 0, minTrust: 0, quality: 0 },
  },
  sleep: {
    healPer30: [0, 1, 2],      // 30분 잘 때마다 회복하는 체력 (질에 따라)
    theftChance: [0.3, 0.05, 0], // 자는 동안 소지품을 잃을 가능성
    visitTrust: 50,            // 이만큼 믿는 사람은 아침에 거처로 찾아온다
  },

  // ---------- 동행 [임시] ----------
  companion: {
    minTrust: 35,              // 함께 가자는 손짓을 받아들일 만큼의 신뢰
    leaveTrust: 15,            // 신뢰가 이 아래로 떨어지면 떠난다
    refuseDanger: 60,          // 이보다 위험한 곳(지역 위협)으로는 따라가지 않는다
  },

  // ---------- 단서 [임시] — 내용은 스토리가 정한다 ----------
  // 단서마다 여러 경로가 있다 (알아낸 사실, 들은 소문, 본 사건). 같은 갈래(thread)의 단서가 need개 모이면 다음 사건이 열린다.
  clues: {
    forest_origin: { thread: 'forest', text: '내가 눈을 뜬 곳에는 오는 발자국이 없었다.', from: { fact: ['no_trail'] } },
    forest_voice: { thread: 'forest', text: '밤의 숲은 내 이름을 안다.', from: { fact: ['name_call', 'voice_kills'] } },
    forest_path: { thread: 'forest', text: '밤에만 생기는 길이 있다.', from: { fact: ['night_path'] } },
    forest_light: { thread: 'forest', text: '해 질 녘의 빛은 나를 보고 있었다.', from: { fact: ['light_watches', 'light_touched'] } },
    beast_mana: { thread: 'beasts', text: '눈이 셋인 짐승의 피에서 빛이 났다.', from: { fact: ['beast_seen'] } },
    beast_rumor: { thread: 'beasts', text: '사람들이 짐승 이야기를 자주 한다.', from: { rumor: ['beast_seen', 'beasts_rising'] } },
    beast_claws: { thread: 'beasts', text: '리아의 상처는 세 갈래 발톱 자국이었다.', from: { fact: ['girl_wound'] } },
    north_light: { thread: 'world', text: '먼 북쪽에서 이상한 빛을 봤다는 이야기가 돈다.', from: { rumor: ['anomaly'] } },
  },
  threads: {
    forest: { need: 3, ko: '이 숲은 무언가 이상하다' },
    beasts: { need: 2, ko: '짐승이 달라지고 있다' },
    world: { need: 1, ko: '먼 곳에서도 무언가 일어나고 있다' },
  },
};

if (typeof module !== 'undefined') module.exports = { RULES };
