// 시작 화면 (디자인담당). 엔진의 main()이 이것을 기다린다 (시스템구조.md 9-1절).
// 돌려주는 것: 'continue' | 'new' | { slot }. 화면은 고르기만 하고, 불러오기·지우기는 엔진이 한다.
(() => {
  'use strict';
  if (typeof document === 'undefined') return;
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  window.UITitle = ({ hasSave, slots }) => new Promise((done) => {
    const saved = (slots || []).filter((x) => !x.empty && x.slot !== 'auto');
    const auto = (slots || []).find((x) => x.slot === 'auto' && !x.empty);
    const el = document.createElement('div');
    el.id = 'title';
    el.setAttribute('role', 'dialog');
    el.setAttribute('aria-label', '아베르니아 시작 화면');
    document.body.appendChild(el);
    document.body.classList.add('titling');

    const info = (x) => `${esc(x.name || '이름 없음')} · ${esc(UIData.when(x.t))} · ${esc(Places.name(x.loc))}`;
    const btn = (act, label, sub, extra = '') => `<button type="button" class="tbtn" data-act="${act}" ${extra}><span>${label}</span>${sub ? `<span class="sub">${sub}</span>` : ''}</button>`;

    function home() {
      el.innerHTML = `<div class="tInner">
          <h1 class="tName">아베르니아</h1>
          <p class="tSub">AVERNIA</p>
          <nav class="tMenu">
            ${hasSave && auto ? btn('continue', '이어 하기', info(auto)) : ''}
            ${btn('new', '새로 시작')}
            ${saved.length ? btn('slots', '불러오기') : ''}
            ${btn('settings', '설정')}
          </nav>
        </div>`;
      el.querySelector('.tbtn').focus();
    }
    function slotsView() {
      el.innerHTML = `<div class="tInner"><h2 class="tHead">불러오기</h2><nav class="tMenu">
          ${saved.map((x) => btn('slot', `기록 ${x.slot}`, info(x), `data-slot="${x.slot}"`)).join('')}
          ${btn('home', '돌아가기')}</nav></div>`;
      el.querySelector('.tbtn').focus();
    }
    function confirmNew() {
      el.innerHTML = `<div class="tInner"><h2 class="tHead">새로 시작</h2>
          <p class="tWarn">자동 저장이 지워진다. 손으로 남긴 기록 1~3은 남는다.</p>
          <nav class="tMenu">${btn('newYes', '처음부터 시작한다')}${btn('home', '돌아가기')}</nav></div>`;
      el.querySelector('[data-act="home"]').focus();
    }
    function finish(v) {
      el.classList.add('out');
      document.body.classList.remove('titling');
      setTimeout(() => el.remove(), 600);
      done(v);
    }

    el.addEventListener('click', (e) => {
      const b = e.target.closest('[data-act]');
      if (!b) return;
      const a = b.dataset.act;
      if (a === 'continue') finish('continue');
      else if (a === 'new') (hasSave ? confirmNew() : finish('new'));
      else if (a === 'newYes') finish('new');
      else if (a === 'slots') slotsView();
      else if (a === 'slot') finish({ slot: Number(b.dataset.slot) });
      else if (a === 'home') home();
      else if (a === 'settings' && window.UIMenu) UIMenu.open('settings');
    });
    // 시작 화면에서는 위아래 화살표로도 고른다
    el.addEventListener('keydown', (e) => {
      if (e.key !== 'ArrowDown' && e.key !== 'ArrowUp') return;
      const bs = [...el.querySelectorAll('.tbtn')];
      const i = bs.indexOf(document.activeElement);
      bs[(i + (e.key === 'ArrowDown' ? 1 : bs.length - 1)) % bs.length].focus();
      e.preventDefault();
    });
    home();
  });
})();
