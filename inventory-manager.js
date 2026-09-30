// 인벤토리 관리자 — 아이템 소지 여부를 확인하고, 획득·소모를 처리한다.
// 상태는 s.items({ 아이템id: 개수 })에 저장된다.
// 선택지에는 item({ rope: 1 } 또는 'rope')으로 필요 아이템을, consume: true로 사용 시 소모 여부를 적는다.
const ITEMS = {
  rope: '밧줄',
  torch: '횃불',
  map: '낡은 지도',
};

const Inventory = {
  // 'rope' | ['rope', 'torch'] | { rope: 2 } 를 { id: 수량 } 으로 통일한다.
  normalize(req) {
    if (!req) return {};
    if (typeof req === 'string') return { [req]: 1 };
    if (Array.isArray(req)) return Object.fromEntries(req.map((id) => [id, 1]));
    return req;
  },

  count(s, id) {
    return (s.items && s.items[id]) || 0;
  },

  // 필요한 아이템을 모두(수량 포함) 갖고 있는지
  has(s, req) {
    return Object.entries(this.normalize(req)).every(([id, n]) => this.count(s, id) >= n);
  },

  add(s, id, n = 1) {
    if (!s.items) s.items = {};
    s.items[id] = this.count(s, id) + n;
    if (s.d) s.d.push(`${ITEMS[id] || id} 획득`);
  },

  // 모자라면 아무것도 깎지 않고 false를 반환한다.
  remove(s, req) {
    if (!this.has(s, req)) return false;
    for (const [id, n] of Object.entries(this.normalize(req))) {
      s.items[id] -= n;
      if (s.items[id] <= 0) delete s.items[id];
      if (s.d) s.d.push(`${ITEMS[id] || id} 소모`);
    }
    return true;
  },

  // 선택지 버튼에 표시할 필요 아이템 문구 (예: "밧줄", "밧줄 ×2")
  describe(req) {
    return Object.entries(this.normalize(req)).map(([id, n]) => `${ITEMS[id] || id}${n > 1 ? ` ×${n}` : ''}`).join(', ');
  },

  // 소지품 목록 문구. 비었으면 빈 문자열.
  summary(s) {
    return Object.entries(s.items || {}).map(([id, n]) => `${ITEMS[id] || id}${n > 1 ? ` ×${n}` : ''}`).join(', ');
  },
};

if (typeof module !== 'undefined') module.exports = { Inventory, ITEMS };
