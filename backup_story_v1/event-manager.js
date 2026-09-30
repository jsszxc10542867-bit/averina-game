// 이벤트 관리자 — 현재 스토리를 화면에 띄우고, 선택지에 맞는 다음 스토리를 불러온다.
// game.js(EVENTS, pickEvent, runChoice, canPay, LABEL, ROLES)에 의존한다.
// 선택지에 next(이벤트 id 또는 (s)=>id)를 두면 다음 스토리가 그 이벤트로 이어진다.
const EventManager = {
  current: null,

  // 다음 스토리를 불러온다. 예약된 이어지기가 있으면 그 이벤트, 없으면 랜덤.
  load(s) {
    const queued = s.nextEvent && EVENTS.find((e) => e.id === s.nextEvent);
    s.nextEvent = null;
    this.current = queued || pickEvent(s);
    return this.current;
  },

  isAvailable(s, c) {
    return canPay(s, c.need) && (!c.role || s.people.some((p) => p.role === c.role)) && Inventory.has(s, c.item);
  },

  // 현재 스토리를 화면에 띄운다. onChoose(idx)는 선택지 버튼이 눌리면 호출된다.
  render(s, esc = (t) => t) {
    const ev = this.current;
    return `<div class="panel"><h2>${esc(ev.title)}</h2><p>${esc(ev.text)}</p>` +
      ev.choices.map((c, i) => {
        const need = c.need ? Object.entries(c.need).map(([k, v]) => `${LABEL[k]} ${v}`).join(', ') : '';
        return `<button data-a="choice" data-i="${i}" ${this.isAvailable(s, c) ? '' : 'disabled'}>${esc(c.label)}` +
          `${c.role ? `<span class="tag">[${ROLES[c.role]}]</span>` : ''}` +
          `${c.item ? `<span class="tag">[${Inventory.describe(c.item)}${c.consume ? ' 소모' : ' 필요'}]</span>` : ''}${need ? `<span class="cost">-${need}</span>` : ''}</button>`;
      }).join('') + `</div>`;
  },

  // 선택지를 적용하고 결과를 반환한다. 선택지에 next가 있으면 다음 스토리로 예약한다.
  choose(s, idx) {
    const ev = this.current;
    const c = ev.choices[idx];
    if (!c || !this.isAvailable(s, c)) return { text: '필요한 자원이나 아이템이 없다.', delta: [] };
    const text = runChoice(s, ev, idx);
    if (c.consume) Inventory.remove(s, c.item);
    const next = typeof c.next === 'function' ? c.next(s) : c.next;
    if (next) s.nextEvent = next;
    return { text, delta: s.d.slice() };
  },
};

if (typeof module !== 'undefined') module.exports = { EventManager };
