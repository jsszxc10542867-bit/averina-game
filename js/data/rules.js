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
    // 밭일: 밭 주인(일반 주민)이 맡긴다 — 노파는 밭에 나가지 않는다 [D9]
    field: { label: '밭일을 거든다', giver: 'farmer', at: 'village_field', hours: [6, 11], min: 120, pay: 4,
      stat: 'str', fatigue: 25, tendency: 'labor', minTrust: 0,
      lines: ['흙을 뒤집고, 돌을 골라내고, 물을 길어 나른다.', '허리가 끊어질 것 같다. 해가 한 뼘 기울었다.'] },
    herbs: { label: '약초 손질을 돕는다', giver: 'herbalist', at: 'village_herbhouse', hours: [12, 17], min: 90, pay: 3,
      stat: 'int', fatigue: 10, tendency: 'healer', minTrust: 20,
      lines: ['마른 풀을 종류대로 가르고, 뿌리의 흙을 턴다.', '노파가 어떤 잎은 따로 두라고 손짓한다. 냄새가 다르다.'] },
    errand: { label: '짐 나르는 심부름을 한다', giver: 'merchant', at: 'village_square', hours: [8, 18], min: 60, pay: 2,
      stat: 'agi', fatigue: 15, tendency: 'trade', minTrust: 10,
      lines: ['자루를 등에 지고 광장과 집들 사이를 오간다.', '돌아올 때마다 상인이 손가락으로 다음 자루를 가리킨다.'] },
    watch: { label: '울타리를 함께 지킨다', giver: 'gatekeeper', at: 'village_gate', hours: [13, 18], min: 120, pay: 3,
      stat: 'sen', fatigue: 15, tendency: 'guard', minTrust: 40,
      lines: ['울타리에 기대어 숲 쪽을 본다.', '남자가 이따금 숲 쪽을 가리키며 무언가 중얼거린다.'] },
    // 돈 대신 일로 하룻밤 값을 치른다 (거처 room_work에서만 쓴다. 일 목록에는 나오지 않는다) [결정 #10]
    chores: { label: '여관 일을 거든다', giver: 'innkeeper', at: 'village_inn', hours: [16, 20], min: 90, pay: 0,
      stat: 'str', fatigue: 15, tendency: 'labor', minTrust: 0, lodgingOnly: true,
      lines: ['탁자를 닦고, 그릇을 나르고, 장작을 들인다.', '주인이 국자 끝으로 탁자와 장작더미를 번갈아 가리킨다.'] },
  },
  // 직업 경향의 이름 (플레이어에게 보이는 말. 숫자는 보이지 않는다)
  tendencyKo: { labor: '몸 쓰는 일', healer: '약초 다루는 일', trade: '장사 심부름', guard: '지키는 일' },

  // ---------- 거처 [임시] — 첫 잠자리는 앞의 행동에 따라 갈린다 [결정 #10]. 어느 길이 정답인지 알려 주지 않는다 ----------
  // at: 자는 곳 / owner: 허락해 줄 사람 / price: 하룻밤 값 / minTrust: 허락받을 만큼의 신뢰 / quality: 잠의 질(0 노숙 ~ 2 방)
  // work: 돈 대신 거들 일 (jobs의 id) / charity: 구호 조건 { maxMoney: 이만큼 이하로 가진 사람만, maxNights: 머물 수 있는 밤 }
  // stays: 같은 방을 가리키는 다른 길 (일로 치른 여관 방은 room에 묵는다)
  // ask: 선택지 문구 — 거처 이름도 비용도 드러내지 않고 행동으로 쓴다. 어느 쪽이 나은지 보이지 않게 (스토리설계.md 단계 5 장면 문장 D)
  lodgings: {
    barn: { label: '약초집 헛간', ask: '헛간 쪽을 가리키며, 하룻밤 묵을 수 있을지 묻는다', at: 'village_herbhouse', owner: 'herbalist', price: 0, minTrust: 30, quality: 1 },
    room: { label: '여관 방', ask: '동전을 꺼내 보이며, 계단 위를 가리킨다', at: 'village_inn', owner: 'innkeeper', price: 3, minTrust: 0, quality: 2 },
    // 돈이 없으면 여관 일을 거들고 방을 얻는다 [결정 #10 ②, D7: 여관 겸 밥집]
    room_work: { label: '여관 방', ask: '빈 주머니를 보이고, 일을 거들겠다고 손짓한다', at: 'village_inn', owner: 'innkeeper', price: 0, work: 'chores', stays: 'room', minTrust: 0, quality: 2 },
    chapel: { label: '예배당 구석', ask: '구석의 담요를 바라본다', at: 'village_chapel', owner: null, price: 0, minTrust: 0, quality: 1, charity: { maxMoney: 1, maxNights: 3 } },
    rough: { label: '울타리 밑', ask: '바람을 피할 자리를 찾는다', at: 'village_gate', owner: null, price: 0, minTrust: 0, quality: 0 },
  },
  sleep: {
    healPer30: [0, 1, 2],      // 30분 잘 때마다 회복하는 체력 (질에 따라)
    theftChance: [0.3, 0.05, 0], // 자는 동안 소지품을 잃을 가능성
    visitTrust: 50,            // 이만큼 믿는 사람은 아침에 거처로 찾아온다
    firstSoup: 20,             // 여관 일로 처음 묵는 날, 식은 국 한 그릇이 허기를 이만큼 덜어 준다 [후보]
    coverTrust: 20,            // 노숙하는 밤 울타리에 있던 문지기가 이만큼 믿으면 천을 던져 준다 (추위만 조금 덜하다) [후보]
  },

  // ---------- 낫지 않는 몸 상태 [결정 D9] — 수치는 [임시] ----------
  // 노파의 상처: 노쇠 + 낫지 않는 마물 상처. 약초로 관리된다. 단계: managed(관리됨) → unsteady(불안정) → bedridden(병상).
  // **죽음은 없다**: 단계는 bedridden에서 멈추고, 체력은 그 단계의 상한까지만 오른다(0으로 떨어지지 않는다).
  // herbPerDay: 하루(새벽 6시)에 쓰는 약초. need: 돌봐야 할 정도(욕구 health에 더해져 리아의 돌봄이 급해진다)
  // 단계는 사건(약재 부족)이 바꾼다. 여기서는 단계마다의 몸과 일정만 정한다
  conditions: {
    old_beast_wound: {
      herbPerDay: 1, need: 20,
      stages: {
        managed: { maxHealth: 70, schedule: 'herbalist', travel: true },
        unsteady: { maxHealth: 55, schedule: 'herbalist_unsteady', travel: true },
        bedridden: { maxHealth: 40, schedule: 'herbalist_bedridden', travel: false },
      },
      order: ['managed', 'unsteady', 'bedridden'],
    },
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
    forest_voice: { thread: 'forest', text: '밤의 숲은 내 이름을 안다.', from: { fact: ['name_call', 'voice_lost'] } },
    forest_path: { thread: 'forest', text: '밤에만 생기는 길이 있다.', from: { fact: ['night_path'] } },
    forest_light: { thread: 'forest', text: '해 질 녘의 빛은 나를 보고 있었다.', from: { fact: ['light_watches', 'light_touched'] } },
    beast_mana: { thread: 'beasts', text: '눈이 셋인 짐승의 피에서 빛이 났다.', from: { fact: ['beast_seen'] } },
    beast_rumor: { thread: 'beasts', text: '사람들이 짐승 이야기를 자주 한다.', from: { rumor: ['beast_seen', 'beasts_rising'] } },
    beast_claws: { thread: 'beasts', text: '리아의 상처는 세 갈래 발톱 자국이었다.', from: { fact: ['girl_wound'] } },
    north_light: { thread: 'world', text: '먼 북쪽에서 이상한 빛을 봤다는 이야기가 돈다.', from: { rumor: ['anomaly'] } },
    // 약재 부족을 알게 되면 (사건에서 직접 준다: Clues.gain)
    herb_short: { thread: 'herb', text: '약초집의 약초 통이 비어 간다.', from: {} },
  },
  threads: {
    herb: { need: 1, ko: '약초가 모자라다' },
    forest: { need: 3, ko: '이 숲은 무언가 이상하다' },
    beasts: { need: 2, ko: '짐승이 달라지고 있다' },
    world: { need: 1, ko: '먼 곳에서도 무언가 일어나고 있다' },
  },

  // ---------- 삶의 기록 (지시문 4의 23절, play/lifelog.js) ----------
  // 즐겨 하는 일 = 들인 시간 + 횟수 × countWeight. 활동이 minActs번은 쌓여야 정한다.
  // 둘째 활동이 첫째의 mixedRatio 이상이면 섞인 삶(지시문 4의 16절). 갈래 이름은 지시문 4의 7~15절 [임시 규칙]
  life: {
    countWeight: 5, minActs: 6, mixedRatio: 0.7,
    styles: { work: 'settler', trade: 'merchant', explore: 'explorer', fight: 'adventurer', talk: 'social', help: 'social', rest: 'settler' },
    // 평판 [결정 D6: 지역(마을) 단위]. standing이 이 이상이면 좋게, 이 이하면 나쁘게 본다 [임시]
    goodStanding: 20, badStanding: -20,
  },

  // ---------- 숲의 위험 [임시] — 공식 "현재의 문제: 마물 증가" ----------
  // 숲의 위협은 날마다 가라앉지만, 마물이 늘어나는 흐름(trendStart + perDay × 날) 아래로는 내려가지 않는다. 짐승 사건이 일어나면 오른다
  forest: { trendStart: 20, perDay: 3, max: 55, beastRaise: 8 },

  // ---------- 마을 사건 공통 (시작마을.md 13절) ----------
  incidents: { maxOpen: 2 }, // 동시에 진행 중인 마을 사건은 최대 2개 [임시]

  // ---------- 약재 부족 (herb_shortage) — 시작마을.md 8절. 수치·일수는 모두 [임시] ----------
  herbShortage: {
    openAfter: 2,          // 마을에 닿은 날 + 이만큼 지나야 열린다
    dangerOpen: 30,        // 숲의 위험이 이 이상("중간")이고
    supplyOpen: 40,        // 약재 공급이 이 이하일 때 열린다
    deadlineDays: 10,      // 열린 날 + 이만큼이 시한
    needed: 8,             // 해결에 필요한 약초 수
    ignoreAfter: 3,        // 알고도 이만큼 손대지 않으면 외면(IGNORED)
    supplyEscalate: 20, escalateAfter: 3, worsenEvery: 3, // 공급이 이 이하로 사흘 → 악화, 다시 사흘마다 한 단계
    escalatedExtra: { unsteady: 0.2, bedridden: 0.4 },    // 악화된 뒤 시작하면 필요량이 늘어난다
    perHerb: 10, perMarketHerb: 5,                       // 약재 공급 = 약초집 비축 × 10 + 시장 약초 × 5 (최대 100)
    gatherRate: 1.0,                                     // 약초 캐는 사람이 한 시간에 약초를 찾을 가능성 (behavior.js gather)
    rangeYield: { near: 0.4, edge: 1, inner: 1.5 },      // 리아의 채집 범위에 따른 채집량
    dangerNear: 40,                                      // 숲의 위험이 이 이상이면 리아가 평소에도 가까운 곳(밭)에서만 캔다
    liaSchedule: { near: 'herbalist_apprentice_near', edge: 'herbalist_apprentice', inner: 'herbalist_apprentice_inner' },
    gather: { min: 60, base: 1, knowBonus: 1, chase: 0.006 }, // 직접 채집: 숲의 위험 1마다 쫓길 가능성 0.6%
    withLia: { min: 120, herbs: 3, minTrust: 40 },
    ask: { minTrust: 30, herbs: 3, delayMin: 1440, targets: ['peer', 'farmer'] }, // 사냥꾼은 설계가 오면 더한다 [D18]
    order: { price: 6, herbs: 4 },
    guild: { fee: 5, herbs: 4, delayMin: 2880 },
    learn: { minTrust: 50, min: 90, factor: 0.6 },
    scarcePrice: 1.8,      // 악화·만료 뒤 약초 값의 하한 (기본값의 배수)
    helpedRumor: ['by_gather', 'by_lia', 'by_ask', 'by_learn'], // 이 방식으로 해결하면 "이방인이 약초집을 도왔다" 소문이 돈다
  },

  // ---------- 중요한 선택 [결정 D5] ----------
  // important: true인 것만 삶의 기록(major_choices)에 남는다. 처음 한 번만. outcomes의 문장은 [임시]
  choices: {
    lia_first_meeting: {
      important: true, label: '숲에서 리아를 처음 만났을 때',
      // helped: 물이나 풀을 건넸다(함께 마을로 간 경우 포함) / talked: 돕지는 않았지만 이름을 나누거나 곁에 다가가 말을 걸었다
      // kept_distance: 멀리서 지켜보기만 했다 / passed_by: 곧바로 지나쳤다 / threatened·attacked. 여럿이면 위의 것이 먼저다(공격 > 위협 > 도움 > …)
      outcomes: { helped: '도왔다', talked: '말을 나누었다', kept_distance: '거리를 두었다', passed_by: '지나쳤다', threatened: '위협했다', attacked: '공격했다' },
    },
    // 약재 부족을 처음 대한 방식 (시작마을.md 8-11) — "위험과 비용을 누가 지는가"
    herb_shortage_response: {
      important: true, label: '약재가 모자랄 때',
      outcomes: { gather: '직접 캤다', with_lia: '리아와 함께 캤다', buy: '사서 구했다', ask: '다른 사람에게 맡겼다',
        request: '행상·길드에 의뢰했다', learn: '배워서 줄였다', ignored: '외면했다', failed: '시도했지만 실패했다' },
    },
  },
};

if (typeof module !== 'undefined') module.exports = { RULES };
