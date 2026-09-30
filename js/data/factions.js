// 세력 데이터 (통합 명세 26절, 세계관_아베르니아.md 3~8절 요약). 플레이어에게 직접 설명하지 않는다.
// power/stability 0~100. relation: diplomacy·trade·trust는 높을수록 가깝고, hostility는 높을수록 적대적이다.

const FACTION_DEFS = {
  lumeris: { name: '루메리스 왕국', politics: '왕과 귀족의 봉건 국가', law: '영지마다 다르다', economy: '농업과 상업',
    military: '기사단, 영지 기사, 병사, 궁병, 마법병. 어려운 일은 모험가에게 맡긴다', religion: '여러 신앙이 섞여 있다',
    culture: '도시와 시골의 차이가 크다', races: ['human'], power: 60, stability: 65 },
  caelvar: { name: '카엘바르 제국', politics: '중앙집권', law: '범죄와 반역을 엄하게 벌한다', economy: '마도공학 산업',
    military: '강력한 군대와 마법 병기', religion: '국가가 통제한다', culture: '질서와 통제', races: ['human'], power: 85, stability: 75 },
  sylvarenne: { name: '실바렌느', politics: '숲과 엘프 사회 전체', law: '숲의 법', economy: '자급',
    military: '숲에 숨은 궁수와 정령', religion: '자연과 정령', culture: '장수, 자연 중심', races: ['elf'], power: 55, stability: 80 },
  dornak: { name: '도르나크 왕국', politics: '지하 왕국', law: '장인 길드의 규약', economy: '광산과 장비 제작',
    military: '중갑 보병, 마도 장비', religion: '대지 신앙', culture: '장인 정신', races: ['dwarf'], power: 60, stability: 70 },
  southern_confederation: { name: '남부 해양연합', politics: '섬과 항구도시의 연합', law: '항구마다 다르다', economy: '해상 무역',
    military: '용병과 선단', religion: '바다 신앙', culture: '여러 종족이 섞인 항구', races: ['human', 'beast', 'elf', 'demon', 'dwarf'], power: 50, stability: 50 },
  demon_territories: { name: '마족령', politics: '하나의 나라가 아니다. 도시국가, 부족, 왕국, 영지', law: '곳마다 다르다', economy: '곳마다 다르다',
    military: '곳마다 다르다', religion: '곳마다 다르다', culture: '다양하다', races: ['demon'], power: 65, stability: 40 },
};

// 세력 사이의 처음 관계 (한 쌍에 하나, 이름은 가나다순이 아니라 아래 적은 순서대로 'a|b')
const FACTION_RELATIONS = {
  'lumeris|caelvar': { diplomacy: 45, trade: 55, hostility: 35, trust: 30 },
  'lumeris|sylvarenne': { diplomacy: 50, trade: 25, hostility: 10, trust: 40 },
  'lumeris|dornak': { diplomacy: 60, trade: 65, hostility: 5, trust: 55 },
  'lumeris|southern_confederation': { diplomacy: 60, trade: 70, hostility: 5, trust: 50 },
  'lumeris|demon_territories': { diplomacy: 15, trade: 15, hostility: 55, trust: 10 },
  'caelvar|sylvarenne': { diplomacy: 30, trade: 15, hostility: 30, trust: 20 },
  'caelvar|dornak': { diplomacy: 50, trade: 60, hostility: 15, trust: 40 },
  'caelvar|southern_confederation': { diplomacy: 45, trade: 60, hostility: 20, trust: 35 },
  'caelvar|demon_territories': { diplomacy: 10, trade: 10, hostility: 65, trust: 5 },
  'sylvarenne|dornak': { diplomacy: 35, trade: 20, hostility: 15, trust: 30 },
  'sylvarenne|southern_confederation': { diplomacy: 40, trade: 30, hostility: 5, trust: 35 },
  'sylvarenne|demon_territories': { diplomacy: 20, trade: 5, hostility: 35, trust: 15 },
  'dornak|southern_confederation': { diplomacy: 50, trade: 65, hostility: 5, trust: 45 },
  'dornak|demon_territories': { diplomacy: 20, trade: 20, hostility: 40, trust: 15 },
  'southern_confederation|demon_territories': { diplomacy: 40, trade: 45, hostility: 15, trust: 30 },
};

// 먼 곳에서 벌어질 수 있는 큰 사건 (세계관 19절 "현재 세계의 문제"). 소문으로만 마을에 닿는다.
// weight(W, pair)는 그날 이 사건이 벌어질 가능성의 가중치다.
const WORLD_EVENT_TYPES = {
  war_tension: { place: 'caelvar', rumor: 'war_tension' },
  trade_boom: { place: 'southern_confederation', rumor: 'trade_boom' },
  anomaly: { place: 'dornak', rumor: 'anomaly' },
  beasts_rising: { place: 'lumeris', rumor: 'beasts_rising' },
};

if (typeof module !== 'undefined') module.exports = { FACTION_DEFS, FACTION_RELATIONS, WORLD_EVENT_TYPES };
