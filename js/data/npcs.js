// NPC 데이터. 세계가 만들어질 때 이 정의로 NPC가 생긴다. 마을 하르넨의 사람들은 시작마을.md 1-5절 [D7].
// 성격·관계·일정 수치는 [제안] (NPC 생성 담당의 초안이 확정되면 바꾼다). 플레이어에게는 절대 숫자로 보여 주지 않는다.
//
// 이름 [결정 D12]: 리아 말고는 아직 이름이 없다. 그때까지 NPC[역할]을 임시 이름으로 쓴다 — "[임시 이름]" 주석이 붙은 칸만 바꾸면 된다.
//   플레이어는 이름을 알게 되기 전까지 겉모습(desc)으로 부른다 (Knowledge.learnName → P.found.npcs[id].name).
// schedule: [시작 시, 끝 시, 할 일, 장소] — 장소 'home'은 그 NPC의 집이다.
// attitude.stranger: 처음 보는 사람(플레이어)을 대하는 첫 관계 / relations: 다른 NPC에 대한 관계 (한쪽 방향)
// role: 'resident'(기본) | 'visitor'(마을에 살지 않고 며칠에 한 번 오는 사람)
// teach: 말을 가르쳐 주는 사람 [결정 D11: 리아 · 마을 아이 · 또래]. minTrust = 가르쳐 줄 만큼 나를 믿는 정도 [임시]
// condition: 낫지 않는 몸 상태 (RULES.conditions) — 노파의 상처 [결정 D9]

const SCHEDULES = {
  guard: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 12, 'work', 'village_gate'], [12, 13, 'eat', 'home'],
    [13, 18, 'work', 'village_gate'], [18, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  merchant: [[0, 6, 'sleep', 'home'], [6, 8, 'eat', 'home'], [8, 18, 'work', 'village_square'],
    [18, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  // 노파 [결정 D9]: 숲·밭으로 채집하러 나가지 않는다. 집(약초집)에서 손질과 치료를 한다. 채집은 리아가 맡는다.
  // 상처의 단계(RULES.conditions.old_beast_wound)에 따라 일정이 바뀐다: 관리됨 → 불안정 → 병상 [시간대는 임시]
  herbalist: [[0, 5, 'sleep', 'home'], [5, 6, 'pray', 'home'], [6, 12, 'work', 'home'], [12, 13, 'eat', 'home'],
    [13, 17, 'work', 'home'], [17, 18, 'pray', 'home'], [18, 20, 'social', 'village_square'], [20, 24, 'sleep', 'home']],
  herbalist_unsteady: [[0, 6, 'sleep', 'home'], [6, 7, 'pray', 'home'], [7, 11, 'work', 'home'], [11, 14, 'rest', 'home'],
    [14, 17, 'work', 'home'], [17, 18, 'pray', 'home'], [18, 24, 'sleep', 'home']],
  herbalist_bedridden: [[0, 7, 'sleep', 'home'], [7, 21, 'rest', 'home'], [21, 24, 'sleep', 'home']],
  // 약초꾼 노파의 제자 [사용자 확정: 직업] — 일정은 NPC프로필_초안.md 1-4의 후보 (시간대는 [미확정 설정])
  // 채집 범위(약재 부족 사건, lia_range)에 따라 셋: 가장자리(평소) · 가까운 곳(부족할 때) · 안쪽(원정, 위험한 곳 [D14])
  herbalist_apprentice: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 12, 'gather', 'edge'],
    [12, 13, 'eat', 'home'], [13, 17, 'work', 'home'], [17, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  herbalist_apprentice_near: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 11, 'gather', 'village_field'],
    [11, 12, 'eat', 'home'], [12, 17, 'work', 'home'], [17, 19, 'social', 'village_square'], [19, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  herbalist_apprentice_inner: [[0, 4, 'sleep', 'home'], [4, 19, 'gather', 'stream'], [19, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  traveler: [[0, 6, 'sleep', 'home'], [6, 8, 'eat', 'home'], [8, 18, 'work', 'far_town'],
    [18, 21, 'social', 'far_town'], [21, 24, 'sleep', 'home']],
  // 여관 주인: 여관에 산다. 새벽부터 밤까지 여관에서 일한다 (시작마을.md 1-5-5)
  innkeeper: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 22, 'work', 'home'], [22, 24, 'sleep', 'home']],
  // 또래: 오전 밭일, 오후 심부름, 저녁 광장
  peer: [[0, 6, 'sleep', 'home'], [6, 7, 'eat', 'home'], [7, 12, 'work', 'village_field'], [12, 13, 'eat', 'home'],
    [13, 17, 'work', 'village_square'], [17, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  // 마을 아이: 광장과 밭을 오가며 논다
  child: [[0, 7, 'sleep', 'home'], [7, 8, 'eat', 'home'], [8, 12, 'social', 'village_square'], [12, 13, 'eat', 'home'],
    [13, 17, 'social', 'village_field'], [17, 19, 'social', 'village_square'], [19, 24, 'sleep', 'home']],
  // 밭 주인 (일반 주민): 밭에서 일한다
  farmer: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 12, 'work', 'village_field'], [12, 13, 'eat', 'home'],
    [13, 17, 'work', 'village_field'], [17, 20, 'rest', 'home'], [20, 24, 'sleep', 'home']],
};

const NPC_DEFS = {
  // 첫 번째 인간 NPC. 약초꾼 노파의 제자 [사용자 확정]. 첫날 숲 깊은 곳으로 약초를 캐러 나섰다가,
  // 둘째 날 새벽 그곳에서 무언가에게 습격당한다 (첫날 행적은 [시스템 임시]).
  lia: {
    identity: { name: '리아', desc: '젊은 여자', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'herbalist_apprentice', education: 'basic', devout: false },
    // [제안] 성격은 지금 장면의 행동(경계심, 자존심, 도움을 받으면 풀리는 태도)에 맞춰 잡았다
    personality: { bravery: 70, kindness: 55, honesty: 70, curiosity: 60, greed: 20, patience: 40, pride: 65, impulsiveness: 45, sociability: 45 },
    languages: { common_aver: { understanding: 100, speaking: 100, reading: 50, writing: 30 } },
    magic: { mana: 20, maxMana: 20, schools: { life: { understanding: 40, proficiency: 30, talent: 60 } } },
    inventory: { dagger: 1, dried_meat: 1 }, money: 12,
    needs: { hunger: 60, thirst: 50 },
    home: 'village_herbhouse', // 노파와 같은 집에 산다 [결정 D10]
    teach: { minTrust: 45 },
    start: { loc: 'deepwood', away: true },
    expectedHome: [2, 18], // 둘째 날 18시까지 돌아올 예정이었다 (넘기면 마을에서 실종으로 여긴다)
    schedule: 'herbalist_apprentice',
    // 첫날은 숲 깊은 곳에서 약초를 캐고 야영한다. 둘째 날 새벽에 돌아갈 생각이었다.
    // 목표 "스승의 병을 돌본다" [확정 D3] — 스토리설계.md "지시문 7개 적용 결정" D3 (사용자 결정 2026-09-30, 재확인 2026-10-01).
    // 스승의 병 [결정 D9]: 노쇠 + 낫지 않는 마물 상처. 약초로 관리된다 — 리아가 캐 온 약초를 건넨다 (behavior.js tend)
    goals: [{ id: 'survive', type: 'survival', priority: 60 }, { id: 'return_home', type: 'personal', priority: 30, startAt: [2, 6] },
      { id: 'care_for_teacher', type: 'personal', priority: 50, target: 'herbalist' }],
    attitude: { stranger: { suspicion: 80 } },
    relations: {
      gatekeeper: { familiarity: 70, trust: 60, affection: 30, respect: 40 },
      herbalist: { familiarity: 80, trust: 75, affection: 60, respect: 60 },
      merchant: { familiarity: 60, trust: 40, affection: 15 },
      innkeeper: { familiarity: 70, trust: 55, affection: 30 },
      peer: { familiarity: 75, trust: 50, affection: 40 },
      child: { familiarity: 70, trust: 50, affection: 50 },
    },
  },

  gatekeeper: {
    identity: { name: 'NPC[문지기]' /* [임시 이름] D12 */, desc: '창을 든 남자', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'guard', education: 'basic', devout: false },
    personality: { bravery: 75, kindness: 40, honesty: 65, curiosity: 35, greed: 30, patience: 35, pride: 60, impulsiveness: 50, sociability: 50 },
    languages: { common_aver: { understanding: 100, speaking: 100, reading: 20, writing: 10 } },
    inventory: { spear: 1, bread: 1 }, money: 20,
    home: 'village_homes', start: { loc: 'village_gate' }, schedule: 'guard',
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'guard_village', type: 'duty', priority: 55 }],
    attitude: { stranger: { suspicion: 70, fear: 10 } },
    relations: {
      lia: { familiarity: 70, trust: 60, affection: 35, respect: 55 },
      herbalist: { familiarity: 80, trust: 65, affection: 30, respect: 60 },
      merchant: { familiarity: 75, trust: 45, affection: 20 },
      peddler: { familiarity: 30, trust: 30, suspicion: 30 },
    },
  },

  merchant: {
    identity: { name: 'NPC[상인]' /* [임시 이름] D12 */, desc: '앞치마를 두른 남자', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'merchant', education: 'literate', devout: false },
    personality: { bravery: 30, kindness: 40, honesty: 45, curiosity: 50, greed: 65, patience: 55, pride: 45, impulsiveness: 30, sociability: 75 },
    languages: {
      common_aver: { understanding: 100, speaking: 100, reading: 80, writing: 70 },
      mar: { understanding: 40, speaking: 20, reading: 0, writing: 0 },
    },
    inventory: { bread: 2 }, money: 150,
    home: 'village_homes', start: { loc: 'village_homes' }, schedule: 'merchant',
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'earn_money', type: 'economic', priority: 55 }],
    attitude: { stranger: { suspicion: 40, fear: 20 } },
    relations: {
      lia: { familiarity: 60, trust: 45, affection: 20 },
      gatekeeper: { familiarity: 75, trust: 55, affection: 20 },
      herbalist: { familiarity: 70, trust: 60, respect: 50 },
      peddler: { familiarity: 50, trust: 40, respect: 30 },
    },
  },

  herbalist: {
    identity: { name: 'NPC[약초꾼 노파]' /* [임시 이름] D12 */, desc: '허리가 굽은 노파', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'herbalist', education: 'literate', devout: true },
    personality: { bravery: 45, kindness: 75, honesty: 70, curiosity: 55, greed: 20, patience: 70, pride: 40, impulsiveness: 20, sociability: 55 },
    languages: {
      common_aver: { understanding: 100, speaking: 100, reading: 40, writing: 30 },
      silva: { understanding: 20, speaking: 5, reading: 0, writing: 0 },
    },
    inventory: { herb: 3, bandage: 2, bread: 1 }, money: 40,
    home: 'village_herbhouse', start: { loc: 'village_herbhouse' }, schedule: 'herbalist',
    condition: 'old_beast_wound', // [결정 D9] 낫지 않는 마물 상처. 단계와 수치는 RULES.conditions [임시]
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'heal_people', type: 'personal', priority: 45 }],
    attitude: { stranger: { suspicion: 35 } },
    relations: {
      lia: { familiarity: 85, trust: 75, affection: 70, respect: 45 },
      gatekeeper: { familiarity: 80, trust: 60, affection: 30 },
      merchant: { familiarity: 70, trust: 50 },
      innkeeper: { familiarity: 75, trust: 60 },
    },
  },

  // 며칠에 한 번 먼 도시에서 마을로 오가는 행상. 먼 곳의 소문을 가져오고 마을의 소문을 가져간다.
  // 마을에 살지 않는 "방문하는 사람"이다 (시작마을.md 1-5-1): 핵심 인물이 아니고, 마을의 평판에 세지 않는다
  peddler: {
    role: 'visitor',
    identity: { name: 'NPC[행상]' /* [임시 이름] D12 */, desc: '짐을 짊어진 여행자', race: 'human', origin: 'far_town', faction: 'southern_confederation',
      occupation: 'peddler', education: 'literate', devout: false },
    personality: { bravery: 45, kindness: 45, honesty: 50, curiosity: 70, greed: 55, patience: 50, pride: 35, impulsiveness: 40, sociability: 80 },
    languages: {
      common_aver: { understanding: 100, speaking: 95, reading: 70, writing: 60 },
      mar: { understanding: 55, speaking: 40, reading: 10, writing: 0 },
      beast: { understanding: 35, speaking: 25, reading: 0, writing: 0 },
      dorn: { understanding: 20, speaking: 10, reading: 5, writing: 0 },
    },
    inventory: { bread: 6, bandage: 3, salt: 4, waterskin: 1 }, money: 80,
    home: 'far_town', start: { loc: 'far_town' }, schedule: 'traveler',
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'trade_trip', type: 'economic', priority: 50, target: 'village_square' }],
    attitude: { stranger: { suspicion: 30 } },
    relations: {
      merchant: { familiarity: 50, trust: 45 },
      gatekeeper: { familiarity: 30, trust: 30 },
    },
  },

  // ---------- 하르넨의 새 사람들 [D7 · 시작마을.md 1-5] — 성격·소지품·관계는 [제안] ----------

  // 여관 주인 (핵심 A 생활): 돈 없는 이방인이 가장 먼저 기댈 수 있는 생활의 문. 잠자리·일 대가 숙박 [결정 #10 ②]
  innkeeper: {
    identity: { name: 'NPC[여관 주인]' /* [임시 이름] D12 */, desc: '국자를 든 여자', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'innkeeper', education: 'basic', devout: false },
    personality: { bravery: 40, kindness: 60, honesty: 60, curiosity: 60, greed: 45, patience: 55, pride: 40, impulsiveness: 30, sociability: 80 },
    languages: { common_aver: { understanding: 100, speaking: 100, reading: 40, writing: 30 } },
    inventory: { bread: 4, dried_meat: 2 }, money: 60,
    home: 'village_inn', start: { loc: 'village_inn' }, schedule: 'innkeeper',
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'earn_money', type: 'economic', priority: 50 }],
    attitude: { stranger: { suspicion: 30 } },
    relations: {
      herbalist: { familiarity: 75, trust: 60, respect: 50 },
      merchant: { familiarity: 75, trust: 50 },
      gatekeeper: { familiarity: 70, trust: 50 },
      lia: { familiarity: 70, trust: 55, affection: 30 },
      peddler: { familiarity: 50, trust: 45 },
    },
  },

  // 또래 (핵심 E): 편하게 어울릴 수 있는 사람. 말을 가르쳐 준다 [D11]
  peer: {
    identity: { name: 'NPC[또래]' /* [임시 이름] D12 */, desc: '또래로 보이는 청년', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'laborer', education: 'basic', devout: false },
    personality: { bravery: 55, kindness: 60, honesty: 65, curiosity: 80, greed: 30, patience: 40, pride: 45, impulsiveness: 60, sociability: 70 },
    languages: { common_aver: { understanding: 100, speaking: 100, reading: 20, writing: 10 } },
    inventory: { bread: 1 }, money: 5,
    home: 'village_homes', start: { loc: 'village_homes' }, schedule: 'peer',
    teach: { minTrust: 30 },
    goals: [{ id: 'survive', type: 'survival', priority: 40 }],
    attitude: { stranger: { suspicion: 30 } },
    relations: {
      lia: { familiarity: 75, trust: 55, affection: 40 },
      gatekeeper: { familiarity: 70, trust: 50, respect: 45 },
      innkeeper: { familiarity: 70, trust: 55 },
    },
  },

  // 마을 아이 (일반 주민): 겁 없이 다가와 이것저것 가리키며 말을 가르쳐 준다 [D11]
  child: {
    identity: { name: 'NPC[마을 아이]' /* [임시 이름] D12 */, desc: '맨발의 아이', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'child', education: 'none', devout: false },
    personality: { bravery: 50, kindness: 70, honesty: 80, curiosity: 90, greed: 20, patience: 20, pride: 30, impulsiveness: 75, sociability: 85 },
    languages: { common_aver: { understanding: 100, speaking: 90, reading: 0, writing: 0 } },
    inventory: {}, money: 0,
    home: 'village_homes', start: { loc: 'village_homes' }, schedule: 'child',
    teach: { minTrust: 15 },
    goals: [{ id: 'survive', type: 'survival', priority: 40 }],
    attitude: { stranger: { suspicion: 15, fear: 10 } },
    relations: {
      lia: { familiarity: 70, trust: 60, affection: 50 },
      herbalist: { familiarity: 70, trust: 60, affection: 40 },
      peer: { familiarity: 80, trust: 60, affection: 40 },
    },
  },

  // 밭 주인 (일반 주민, 이름 없음 — 시작마을.md 1-5-4): 밭일(첫 일자리)을 맡긴다. 노파가 밭에 나가지 않게 되어[D9] 일을 주는 사람이 바뀌었다
  farmer: {
    identity: { name: 'NPC[밭 주인]' /* [임시 이름] D12 */, desc: '흙 묻은 장화를 신은 남자', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'farmer', education: 'basic', devout: false },
    personality: { bravery: 50, kindness: 45, honesty: 65, curiosity: 30, greed: 40, patience: 60, pride: 50, impulsiveness: 30, sociability: 40 },
    languages: { common_aver: { understanding: 100, speaking: 100, reading: 10, writing: 5 } },
    inventory: { bread: 1 }, money: 30,
    home: 'village_homes', start: { loc: 'village_homes' }, schedule: 'farmer',
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'earn_money', type: 'economic', priority: 45 }],
    attitude: { stranger: { suspicion: 50 } },
    relations: {
      herbalist: { familiarity: 70, trust: 55 },
      gatekeeper: { familiarity: 70, trust: 50 },
      peer: { familiarity: 70, trust: 50 },
    },
  },
};

if (typeof module !== 'undefined') module.exports = { SCHEDULES, NPC_DEFS };
