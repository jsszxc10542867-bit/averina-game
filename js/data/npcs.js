// NPC 데이터. 세계가 만들어질 때 이 정의로 NPC가 생긴다.
// [제안] 리아를 뺀 마을 사람들은 시스템 검증을 위해 넣은 최소 인원이다. 이름·성격·관계는 스토리에서 정하면 바꾼다.
// 성격과 관계 수치는 0~100. 플레이어에게는 절대 숫자로 보여 주지 않는다.
//
// schedule: [시작 시, 끝 시, 할 일, 장소] — 장소 'home'은 그 NPC의 집이다.
// attitude.stranger: 처음 보는 사람(플레이어)을 대하는 첫 관계
// relations: 다른 NPC에 대한 관계 (한쪽 방향)

const SCHEDULES = {
  guard: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 12, 'work', 'village_gate'], [12, 13, 'eat', 'home'],
    [13, 18, 'work', 'village_gate'], [18, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  merchant: [[0, 6, 'sleep', 'home'], [6, 8, 'eat', 'home'], [8, 18, 'work', 'village_square'],
    [18, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  herbalist: [[0, 5, 'sleep', 'home'], [5, 6, 'pray', 'home'], [6, 11, 'gather', 'village_field'], [11, 12, 'eat', 'home'],
    [12, 17, 'work', 'home'], [17, 18, 'pray', 'home'], [18, 20, 'social', 'village_square'], [20, 24, 'sleep', 'home']],
  // 약초꾼 노파의 제자 [사용자 확정: 직업] — 일정은 NPC프로필_초안.md 1-4의 후보 (시간대는 [미확정 설정])
  herbalist_apprentice: [[0, 5, 'sleep', 'home'], [5, 6, 'eat', 'home'], [6, 12, 'gather', 'village_field'],
    [12, 13, 'eat', 'home'], [13, 17, 'work', 'home'], [17, 20, 'social', 'village_square'], [20, 22, 'rest', 'home'], [22, 24, 'sleep', 'home']],
  traveler: [[0, 6, 'sleep', 'home'], [6, 8, 'eat', 'home'], [8, 18, 'work', 'far_town'],
    [18, 21, 'social', 'far_town'], [21, 24, 'sleep', 'home']],
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
    home: 'village_homes',
    start: { loc: 'deepwood', away: true },
    expectedHome: [2, 18], // 둘째 날 18시까지 돌아올 예정이었다 (넘기면 마을에서 실종으로 여긴다)
    schedule: 'herbalist_apprentice',
    // 첫날은 숲 깊은 곳에서 약초를 캐고 야영한다. 둘째 날 새벽에 돌아갈 생각이었다.
    // 목표 "스승의 병을 돌본다" [임시: 사용자 확인 중] — 스토리설계.md 결정 #1(디렉터 기록, 2026-09-30)과
    // 스토리 담당 기록("리아의 욕망은 보류")이 엇갈린다. 병의 정도(#12)는 미정이라 노파는 아직 건강하다
    goals: [{ id: 'survive', type: 'survival', priority: 60 }, { id: 'return_home', type: 'personal', priority: 30, startAt: [2, 6] },
      { id: 'care_for_teacher', type: 'personal', priority: 50, target: 'herbalist' }],
    attitude: { stranger: { suspicion: 80 } },
    relations: {
      gatekeeper: { familiarity: 70, trust: 60, affection: 30, respect: 40 },
      herbalist: { familiarity: 80, trust: 75, affection: 60, respect: 60 },
      merchant: { familiarity: 60, trust: 40, affection: 15 },
    },
  },

  gatekeeper: {
    identity: { name: null, desc: '창을 든 남자', race: 'human', origin: 'village', faction: 'lumeris',
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
    identity: { name: null, desc: '앞치마를 두른 남자', race: 'human', origin: 'village', faction: 'lumeris',
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
    identity: { name: null, desc: '허리가 굽은 노파', race: 'human', origin: 'village', faction: 'lumeris',
      occupation: 'herbalist', education: 'literate', devout: true },
    personality: { bravery: 45, kindness: 75, honesty: 70, curiosity: 55, greed: 20, patience: 70, pride: 40, impulsiveness: 20, sociability: 55 },
    languages: {
      common_aver: { understanding: 100, speaking: 100, reading: 40, writing: 30 },
      silva: { understanding: 20, speaking: 5, reading: 0, writing: 0 },
    },
    inventory: { herb: 3, bandage: 2, bread: 1 }, money: 40,
    home: 'village_homes', start: { loc: 'village_homes' }, schedule: 'herbalist',
    goals: [{ id: 'survive', type: 'survival', priority: 40 }, { id: 'heal_people', type: 'personal', priority: 45 }],
    attitude: { stranger: { suspicion: 35 } },
    relations: {
      lia: { familiarity: 85, trust: 75, affection: 70, respect: 45 },
      gatekeeper: { familiarity: 80, trust: 60, affection: 30 },
      merchant: { familiarity: 70, trust: 50 },
    },
  },

  // 며칠에 한 번 먼 도시에서 마을로 오가는 행상. 먼 곳의 소문을 가져오고 마을의 소문을 가져간다.
  peddler: {
    identity: { name: null, desc: '짐을 짊어진 여행자', race: 'human', origin: 'far_town', faction: 'southern_confederation',
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
};

if (typeof module !== 'undefined') module.exports = { SCHEDULES, NPC_DEFS };
