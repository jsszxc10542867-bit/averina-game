// 장소 데이터: 지역, 지형 특징, NPC가 다니는 길(분).
// 플레이어가 고르는 길과 장소 묘사는 world.js(숲)에 있다. 여기는 시스템이 쓰는 사실만 둔다.
// features: water(물이 있다) shelter(몸을 숨기거나 잘 수 있다) market(사고팔 수 있다)
//           rocks, trees, slope, high, dense, roots, bushes, fence, field, homes

const PLACE_DATA = {
  // 숲 (이름은 world.js의 LOCS에서 가져온다)
  clearing:   { region: 'forest', features: ['trees', 'rocks'] },
  stream:     { region: 'forest', features: ['water'] },
  downstream: { region: 'forest', features: ['water', 'bushes'] },
  hill:       { region: 'forest', features: ['rocks', 'slope', 'high'] },
  deep:       { region: 'forest', features: ['trees', 'dense'] },
  hollow:     { region: 'forest', features: ['roots', 'shelter'] },
  edge:       { region: 'forest', features: [] },
  // 플레이어는 들어갈 수 없는 숲 깊은 곳 (리아가 첫날 밤을 보낸 곳)
  deepwood:   { region: 'forest', name: '숲 깊은 곳', features: ['trees', 'dense', 'shelter'] },

  // 마을 [제안] 스토리에서 이름과 구성을 정하면 바꾼다
  village_gate:   { region: 'village', name: '마을 울타리', features: ['fence'] },
  village_square: { region: 'village', name: '마을 광장', features: ['market', 'water'] },
  village_homes:  { region: 'village', name: '마을 집들', features: ['shelter', 'homes'] },
  village_field:  { region: 'village', name: '마을 밭', features: ['field'] },
  // [임시] 교회의 구호 거처 (세계관 14절 "교회: 종교와 구호 활동") [결정 #10]
  village_chapel: { region: 'village', name: '작은 예배당', features: ['shelter'] },

  // 먼 곳 (추상 시뮬레이션만 한다)
  road:     { region: 'road', name: '큰길', features: [] },
  far_town: { region: 'far', name: '먼 도시', features: ['market', 'shelter', 'water', 'homes'] },
};

// 지역. adj = 이웃 지역 (플레이어가 있는 지역의 이웃은 중간 정밀도로 계산한다)
const REGION_DATA = {
  forest:  { name: '숲', adj: ['village'] },
  village: { name: '마을', adj: ['forest', 'road'] },
  road:    { name: '큰길', adj: ['village', 'far'] },
  far:     { name: '먼 곳', adj: ['road'] },
};

// NPC가 걷는 길 [장소 A, 장소 B, 걸리는 분]. 양방향이다.
const PATHS = [
  ['clearing', 'stream', 15], ['clearing', 'hill', 30], ['clearing', 'deep', 15], ['clearing', 'hollow', 20],
  ['stream', 'downstream', 20], ['stream', 'hollow', 15],
  ['deep', 'deepwood', 40], ['hollow', 'deepwood', 60],
  ['hollow', 'edge', 200], ['hill', 'edge', 240], ['downstream', 'edge', 230],
  ['edge', 'village_gate', 20],
  ['village_gate', 'village_square', 5], ['village_square', 'village_homes', 5], ['village_square', 'village_field', 10],
  ['village_square', 'village_chapel', 5],
  ['village_gate', 'road', 60], ['road', 'far_town', 720],
];

if (typeof module !== 'undefined') module.exports = { PLACE_DATA, REGION_DATA, PATHS };
