// 아이템 데이터 (통합 명세 22절). 무게는 kg, 값은 동전 수.
// name은 플레이어에게 보이는 이름이다. label(P)이 있으면 플레이어가 아는 만큼 이름이 달라진다.
// durability: 쓸 수 있는 횟수 (무기로 쓰면 1씩 준다). null이면 닳지 않는다.
// desc: 소지품 화면의 한 줄 [임시: 스토리 담당이 다시 쓴다]. 겉으로 보이는 것만 적는다.
// known: [사실, 문장] — 그 사실을 알아낸 뒤에만 desc 뒤에 붙는다 (Player.describe)

const ITEM_DEFS = {
  branch: { name: '나뭇가지', desc: '손에 쥐기 좋은 굵기의 나뭇가지. 몇 번 휘두르면 부러질 것 같다.', category: 'tool', weight: 0.5, value: 0, durability: 2,
    properties: { weapon: { dmg: 1 } }, effects: {}, rarity: 'common', origin: 'forest' },
  stone: { name: '날카로운 돌', desc: '한쪽 끝이 얇게 깨져 날이 선 돌.', category: 'tool', weight: 0.8, value: 0, durability: null,
    properties: { weapon: { dmg: 1 }, throwable: true }, effects: {}, rarity: 'common', origin: 'forest' },
  berry: { name: '붉은 열매', desc: '손톱만 한 붉은 열매. 달큰한 냄새가 난다.', known: ['berry_poison', '먹으면 배 속이 뒤틀린다.'], category: 'food', weight: 0.05, value: 0, durability: null,
    properties: { poison: true }, effects: { hunger: -25 }, rarity: 'common', origin: 'forest',
    label: (P) => (P.knowledge.berry_poison ? '붉은 열매 (독)' : '붉은 열매 (먹어도 되는지 모른다)') },
  herb: { name: '쓴 냄새가 나는 풀', desc: '잎을 비비면 쓴 냄새가 코를 찌른다.', known: ['herb_heals', '짓이겨 상처에 대면 피가 멎는다.'], category: 'medicine', weight: 0.05, value: 2, durability: null,
    properties: { stopsBleeding: true }, effects: { bleed: 0 }, rarity: 'common', origin: 'forest' },

  // 마을 사람과 상인이 쓰는 것
  dagger: { name: '단검', desc: '손잡이가 닳은 짧은 칼.', category: 'weapon', weight: 0.4, value: 15, durability: 60,
    properties: { weapon: { dmg: 2 } }, effects: {}, rarity: 'common', origin: 'village' },
  spear: { name: '창', desc: '긴 자루 끝에 쇠 날을 박은 창.', category: 'weapon', weight: 2.0, value: 20, durability: 80,
    properties: { weapon: { dmg: 3 } }, effects: {}, rarity: 'common', origin: 'village' },
  bread: { name: '빵', desc: '딱딱하게 구운 빵. 한 덩이면 한 끼는 된다.', category: 'food', weight: 0.3, value: 2, durability: null,
    properties: {}, effects: { hunger: -35 }, rarity: 'common', origin: 'village' },
  dried_meat: { name: '말린 고기', desc: '짜고 질긴 말린 고기.', category: 'food', weight: 0.2, value: 3, durability: null,
    properties: {}, effects: { hunger: -40 }, rarity: 'common', origin: 'village' },
  bandage: { name: '천 조각', desc: '깨끗하게 빨아 둔 천. 상처를 감쌀 수 있다.', category: 'medicine', weight: 0.1, value: 3, durability: null,
    properties: { stopsBleeding: true }, effects: { bleed: 0 }, rarity: 'common', origin: 'village' },
  waterskin: { name: '물주머니', desc: '가죽을 꿰매 만든 물주머니.', category: 'water', weight: 1.0, value: 5, durability: null,
    properties: { water: true }, effects: { thirst: -60 }, rarity: 'common', origin: 'village' },
  salt: { name: '소금', desc: '작은 자루에 든 거친 소금.', category: 'material', weight: 0.5, value: 6, durability: null,
    properties: {}, effects: {}, rarity: 'common', origin: 'far_town' },
};

if (typeof module !== 'undefined') module.exports = { ITEM_DEFS };
