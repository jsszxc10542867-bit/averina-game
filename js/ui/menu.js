// 메뉴와 정보 화면 (디자인담당). 게임 흐름(engine.js)은 건드리지 않는다.
// 열려 있는 동안 키 입력을 가로채서, 뒤의 선택지가 숫자키로 눌리지 않게 한다.
// 데이터는 모두 UIData(js/ui/data.js)에서 받는다.
(() => {
  'use strict';
  if (typeof document === 'undefined') return; // 테스트(node)에서는 화면이 없다
  const $ = (s, r = document) => r.querySelector(s);
  const esc = (s) => String(s).replace(/[&<>"]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' })[c]);

  // ---------- 설정 (화면 취향일 뿐이라 세이브와 따로 이 브라우저에만 둔다) ----------
  const PREF_KEY = 'avernia_ui';
  const PREF_DEFAULT = { size: 'm', leading: 'normal', motion: 'auto' };
  let pref = { ...PREF_DEFAULT };
  try { Object.assign(pref, JSON.parse(localStorage.getItem(PREF_KEY)) || {}); } catch (e) { /* 저장소가 막힌 환경 */ }
  function applyPref() {
    const h = document.documentElement;
    h.dataset.size = pref.size;
    h.dataset.leading = pref.leading;
    h.dataset.motion = pref.motion;
  }
  function savePref() { try { localStorage.setItem(PREF_KEY, JSON.stringify(pref)); } catch (e) { /* 무시 */ } applyPref(); }
  applyPref();

  // ---------- 대사 줄 표시 ----------
  // 엔진은 줄마다 cls만 준다. 「」나 따옴표로 시작하는 줄을 대사로 보고 모양만 붙인다 (내용은 바꾸지 않는다).
  const story = $('#story');
  if (story) {
    new MutationObserver((ms) => ms.forEach((m) => m.addedNodes.forEach((p) => {
      if (p.nodeType !== 1 || !p.classList.contains('line')) return;
      // 시스템이 말한 사람을 알려 주면 이름표 (모르는 사람은 겉모습). 아니면 「로 시작하는 줄을 대사로 짐작한다
      if (p.dataset.who) { const n = UIData.speaker(p.dataset.who); if (n) p.dataset.label = n; }
      if (/^\s*[「『"“]/.test(p.textContent)) p.classList.add('speech');
    }))).observe(story, { childList: true });
  }

  // ---------- 메뉴 버튼과 창 ----------
  const btn = document.createElement('button');
  btn.id = 'menuBtn';
  btn.type = 'button';
  btn.setAttribute('aria-label', '메뉴 열기 (Esc)');
  btn.setAttribute('aria-haspopup', 'dialog');
  btn.setAttribute('aria-expanded', 'false');
  btn.innerHTML = '<span></span><span></span><span></span>';

  const sheet = document.createElement('div');
  sheet.id = 'sheet';
  sheet.hidden = true;
  sheet.innerHTML = `
    <div class="scrim" data-close></div>
    <section class="panel" role="dialog" aria-modal="true" aria-labelledby="sheetTitle">
      <header class="panelHead">
        <h2 id="sheetTitle">메뉴</h2>
        <button type="button" class="close" data-close aria-label="닫기 (Esc)">닫기</button>
      </header>
      <nav class="tabs" role="tablist" aria-label="메뉴"></nav>
      <div class="panelBody" role="tabpanel" tabindex="-1"></div>
    </section>`;
  document.body.append(btn, sheet);
  const tabsEl = $('.tabs', sheet);
  const bodyEl = $('.panelBody', sheet);

  const TABS = [
    ['now', '지금'], ['journal', '기록'], ['people', '사람'], ['items', '소지품'],
    ['map', '지도'], ['words', '말'], ['save', '저장'], ['settings', '설정'],
  ];
  let tab = 'now';
  let lastFocus = null;

  TABS.forEach(([id, ko]) => {
    const b = document.createElement('button');
    b.type = 'button'; b.setAttribute('role', 'tab'); b.dataset.tab = id; b.textContent = ko;
    b.onclick = () => { tab = id; render(); };
    tabsEl.appendChild(b);
  });

  function open(which) {
    const S = UIData.source();
    if (!S || !S.P || !S.W) return;
    if (which) tab = which;
    lastFocus = document.activeElement;
    sheet.hidden = false;
    void sheet.offsetWidth;
    sheet.classList.add('in');
    btn.setAttribute('aria-expanded', 'true');
    render();
    $(`[data-tab="${tab}"]`, tabsEl).focus();
  }
  function close() {
    sheet.classList.remove('in');
    btn.setAttribute('aria-expanded', 'false');
    setTimeout(() => { sheet.hidden = true; }, 220);
    if (lastFocus && lastFocus.focus) lastFocus.focus();
  }
  const isOpen = () => !sheet.hidden;

  btn.onclick = () => (isOpen() ? close() : open());
  sheet.addEventListener('click', (e) => { if (e.target.closest('[data-close]')) close(); });

  // 열려 있으면 키를 먼저 받는다 (엔진의 숫자키·Enter가 뒤에서 눌리지 않게)
  window.addEventListener('keydown', (e) => {
    if (!isOpen()) {
      if (e.key === 'Escape' && !document.body.classList.contains('black') && !document.body.classList.contains('titling') && document.activeElement.tagName !== 'INPUT') { e.preventDefault(); open(); }
      return;
    }
    e.stopImmediatePropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); return; }
    if (e.key === 'Tab') trap(e);
    if ((e.key === 'ArrowRight' || e.key === 'ArrowLeft') && e.target.closest('.tabs')) {
      const i = TABS.findIndex(([id]) => id === tab);
      tab = TABS[(i + (e.key === 'ArrowRight' ? 1 : TABS.length - 1)) % TABS.length][0];
      render();
      $(`[data-tab="${tab}"]`, tabsEl).focus();
    }
  }, true);
  // 메뉴 위의 클릭이 뒤의 "다음으로(▾)"를 누르지 않게
  ['pointerdown', 'click'].forEach((t) => sheet.addEventListener(t, (e) => e.stopPropagation()));

  function trap(e) {
    const f = [...sheet.querySelectorAll('button, [href], input, select, [tabindex]:not([tabindex="-1"])')].filter((x) => !x.disabled && x.offsetParent);
    if (!f.length) return;
    const first = f[0], last = f[f.length - 1];
    if (e.shiftKey && document.activeElement === first) { e.preventDefault(); last.focus(); }
    else if (!e.shiftKey && document.activeElement === last) { e.preventDefault(); first.focus(); }
  }

  // ---------- 화면들 ----------
  const empty = (t) => `<p class="empty">${esc(t)}</p>`;
  const section = (title, html) => `<section class="block">${title ? `<h3>${esc(title)}</h3>` : ''}${html}</section>`;

  const VIEWS = {
    now(S) {
      const d = UIData.now(S);
      const rows = [
        ['때', `${d.day} · ${d.band}`],
        ['곳', d.region && d.region !== d.place ? `${esc(d.place)} <span class="sub">${esc(d.region)}</span>` : esc(d.place)],
        ['잘 곳', d.lodging ? esc(d.lodging) : '<span class="sub">정해진 곳이 없다</span>'],
        ['함께', d.companions.length ? esc(d.companions.join(', ')) : '<span class="sub">혼자다</span>'],
        ['가진 돈', d.money ? `동전 ${d.money}닢` : '<span class="sub">한 푼도 없다</span>'],
      ];
      return section(null, `<h4 class="who">${esc(d.name || '이름을 떠올리지 못했다')}</h4>
          <dl class="facts">${rows.map(([k, v]) => `<dt>${k}</dt><dd>${k === '때' ? esc(v) : v}</dd>`).join('')}</dl>`)
        + section('몸', `<ul class="body">${d.body.map(([k, v]) => `<li><span>${esc(k)}</span>${esc(v)}</li>`).join('')}</ul>`
          + (d.feeling ? `<p class="feel">${esc(d.feeling)}</p>` : ''))
        + (d.status ? section('상태', `<pre class="statbox">${esc(d.status.map((l) => l.t).join('\n'))}</pre>`) : '');
    },

    journal(S) {
      const j = UIData.journal(S);
      const days = j.days.map((g) => `<section class="day"><h3>${esc(g.day)}</h3><ol>${g.items.map((x) =>
        `<li class="${x.kind}"><span class="when">${esc(x.when)}</span>${esc(x.text)}</li>`).join('')}</ol></section>`).join('');
      return (days || empty('아직 아무 일도 없었다.'))
        + (j.facts.length ? section('알아낸 것', `<ul class="facts-list">${j.facts.map((f) => `<li>${esc(f)}</li>`).join('')}</ul>`) : '');
    },

    people(S) {
      const list = UIData.people(S);
      if (!list.length) return empty('아직 아무도 만나지 못했다.');
      return list.map((p) => `<article class="person">
          <div class="portrait" aria-hidden="true">${esc(p.named ? p.name[0] : '?')}</div>
          <div class="pbody">
            <h3>${esc(p.name)}${p.together ? '<span class="tag">함께 있다</span>' : ''}</h3>
            <p class="sub">${esc(p.look)} · ${esc(p.first)}에 처음 만났다${p.last ? ` · 마지막으로 본 때: ${esc(p.last)}` : ''}</p>
            ${p.attitude.length ? `<ul class="attitude">${p.attitude.map((a) => `<li>${esc(a)}</li>`).join('')}</ul>` : '<p class="sub">아직 이 사람의 마음을 읽을 수 없다.</p>'}
            <p class="unknown">${p.named ? '' : '이름 · '}이 사람에 대해 모르는 것이 더 많다.</p>
          </div>
        </article>`).join('');
    },

    items(S) {
      const it = UIData.items(S);
      const money = `<p class="money">${it.money ? `동전 <b>${it.money}</b>닢` : '돈이 한 푼도 없다.'}</p>`;
      if (!it.list.length) return money + empty('가진 것이 없다.');
      return money + `<ul class="inv">${it.list.map((x) => `<li>
          <button type="button" class="invItem" aria-expanded="false">
            <span class="iname">${esc(x.name)}</span><span class="icount">× ${x.count}</span>
          </button>
          <p class="idesc" hidden><span class="sub">${esc(x.kind)}</span>${x.desc ? ' — ' + esc(x.desc) : ''}</p>
        </li>`).join('')}</ul>`;
    },

    map(S) {
      const m = UIData.map(S);
      if (!m.places.length) return empty('아직 아는 곳이 없다.');
      const routes = window.Avernia ? Avernia.routes() : [];
      const go = routes.length ? section('여기서 갈 수 있는 곳', `<ul class="routes">${routes.map((r) => `<li><button type="button" class="act route${r.dark ? ' dark' : ''}" data-act="go" data-to="${esc(r.to)}">
          <span>${esc(r.label)}</span><span class="sub">${esc(r.far || '')}${r.hint ? ' · ' + esc(r.hint) : ''}</span></button></li>`).join('')}</ul>`) : '';
      return mapSvg(m) + go + Object.entries(groupBy(m.places, 'regionName')).map(([r, ps]) => section(r,
        `<ul class="places">${ps.map((p) => `<li class="${p.id === m.here ? 'here' : ''}"><span>${esc(p.name)}</span><span class="sub">${esc(p.state)}</span></li>`).join('')}</ul>`)).join('');
    },

    words(S) {
      const w = UIData.words(S);
      if (!w.words.length && !w.langs.length) return empty('아직 낯선 말을 들어 본 적이 없다.');
      return (w.words.length ? section('들은 말', `<ul class="wordlist">${w.words.map((x) => `<li class="${x.dim ? 'dim' : ''}">${esc(x.text)}</li>`).join('')}</ul>`) : '')
        + (w.langs.length ? section('알아듣는 정도', `<pre class="statbox">${esc(w.langs.join('\n'))}</pre>`) : '');
    },

    save() {
      const ok = window.Avernia && Avernia.canSave();
      const card = (x) => {
        const title = x.slot === 'auto' ? '자동 저장' : `기록 ${x.slot}`;
        const info = x.empty ? '<p class="sub">비어 있음</p>'
          : `<p class="slotName">${esc(x.name)}</p><p>${esc(x.when)} · ${esc(x.place)}</p>${x.ago ? `<p class="sub">${esc(x.ago)}</p>` : ''}`;
        const acts = x.slot === 'auto' ? `<button type="button" class="mini" data-act="load" data-slot="auto" ${ok && !x.empty ? '' : 'disabled'}>이어 하기</button>`
          : `<button type="button" class="mini" data-act="save" data-slot="${x.slot}" ${ok ? '' : 'disabled'}>여기에 저장</button>
             <button type="button" class="mini" data-act="load" data-slot="${x.slot}" ${ok && !x.empty ? '' : 'disabled'}>불러오기</button>`;
        return `<div class="slot${x.empty ? ' emptySlot' : ''}"><div class="slotInfo"><p class="slotTitle">${title}</p>${info}</div><div class="slotActs">${acts}</div></div>`;
      };
      return `<p class="sub saveNote">${ok ? '지금 저장할 수 있다.' : '장면이 끝나고 다음 행동을 고를 때 저장할 수 있다.'}</p>`
        + UIData.slots().map(card).join('') + '<p class="sub" id="saveMsg" role="status"></p>';
    },

    settings() {
      const opt = (key, val, ko) => `<button type="button" class="seg${pref[key] === val ? ' on' : ''}" data-pref="${key}" data-val="${val}" aria-pressed="${pref[key] === val}">${ko}</button>`;
      return section('글자 크기', `<div class="segs">${opt('size', 's', '작게')}${opt('size', 'm', '보통')}${opt('size', 'l', '크게')}${opt('size', 'xl', '아주 크게')}</div>`)
        + section('줄 간격', `<div class="segs">${opt('leading', 'normal', '보통')}${opt('leading', 'wide', '넓게')}</div>`)
        + section('움직임', `<div class="segs">${opt('motion', 'auto', '기기 설정 따름')}${opt('motion', 'reduce', '줄이기')}</div>`)
        + section('조작', `<dl class="facts keys"><dt>Esc</dt><dd>메뉴 열기 · 닫기</dd><dt>1–9, 0</dt><dd>선택지 고르기</dd><dt>Space · Enter</dt><dd>다음 글로</dd></dl>`);
    },
  };

  function groupBy(a, k) { return a.reduce((o, x) => ((o[x[k]] = o[x[k]] || []).push(x), o), {}); }

  // 손으로 그린 듯한 지도. 자리는 디자인 데이터다 (아는 곳만 그린다).
  // [x, y, 'b'] — 'b'는 이름을 점 아래에 쓴다 (이웃과 겹치지 않게)
  const POS = {
    hill: [16, 22], deep: [36, 16], deepwood: [54, 6], clearing: [30, 40], hollow: [18, 60, 'b'],
    stream: [46, 52, 'b'], downstream: [56, 72, 'b'], edge: [70, 44],
    village_gate: [86, 50, 'b'], village_square: [104, 56, 'b'], village_guild: [100, 30],
    village_homes: [122, 42], village_herbhouse: [140, 54], village_smithy: [86, 70, 'b'],
    village_chapel: [106, 76, 'b'], village_inn: [124, 64, 'b'], village_field: [138, 80, 'b'],
    road: [90, 16], far_town: [116, 6],
  };
  function mapSvg(m) {
    const ps = m.places.filter((p) => POS[p.id]);
    if (!ps.length) return '';
    // 아는 곳만큼만 펼친다 (처음엔 숲 몇 곳뿐이라 크게 보인다)
    const xs = ps.map((p) => POS[p.id][0]), ys = ps.map((p) => POS[p.id][1]);
    const pad = 9;
    let x0 = Math.min(...xs) - pad, x1 = Math.max(...xs) + pad, y0 = Math.min(...ys) - pad, y1 = Math.max(...ys) + pad / 2;
    const w = Math.max(x1 - x0, 48), h = Math.max(y1 - y0, 32);
    x0 -= (w - (x1 - x0)) / 2; y0 -= (h - (y1 - y0)) / 2;
    const line = ([a, b]) => (POS[a] && POS[b] ? `<line x1="${POS[a][0]}" y1="${POS[a][1]}" x2="${POS[b][0]}" y2="${POS[b][1]}"/>` : '');
    return `<figure class="map"><svg viewBox="${x0} ${y0} ${w} ${h}" style="--k:${(w / 60).toFixed(2)}" role="img" aria-label="아는 곳의 지도">
        <g class="paths">${m.paths.map(line).join('')}</g>
        ${ps.map((p) => `<g class="node${p.id === m.here ? ' here' : ''}${POS[p.id][2] === 'b' ? ' below' : ''}" transform="translate(${POS[p.id][0]} ${POS[p.id][1]})">
          <circle r="${p.id === m.here ? 1.8 : 1.2}"/><text>${esc(p.name)}</text></g>`).join('')}
      </svg></figure>`;
  }

  function render() {
    const S = UIData.source();
    tabsEl.querySelectorAll('[data-tab]').forEach((b) => {
      const on = b.dataset.tab === tab;
      b.classList.toggle('on', on);
      b.setAttribute('aria-selected', on);
      b.tabIndex = on ? 0 : -1;
    });
    $('#sheetTitle').textContent = TABS.find(([id]) => id === tab)[1];
    try { bodyEl.innerHTML = VIEWS[tab](S); } catch (err) {
      console.error('[메뉴]', err);
      bodyEl.innerHTML = empty('이 화면을 그리지 못했다.');
    }
    bodyEl.scrollTop = 0;
  }

  bodyEl.addEventListener('click', (e) => {
    const inv = e.target.closest('.invItem');
    if (inv) {
      const d = inv.nextElementSibling;
      d.hidden = !d.hidden;
      inv.setAttribute('aria-expanded', String(!d.hidden));
      return;
    }
    const p = e.target.closest('[data-pref]');
    if (p) { pref[p.dataset.pref] = p.dataset.val; savePref(); render(); $(`[data-pref="${p.dataset.pref}"][data-val="${p.dataset.val}"]`, bodyEl).focus(); return; }
    const a = e.target.closest('[data-act]');
    if (!a || a.disabled) return;
    const slot = a.dataset.slot === 'auto' ? null : Number(a.dataset.slot); // null = 자동 저장 칸
    const say = (t) => { const m = $('#saveMsg'); if (m) m.textContent = t; };
    if (a.dataset.act === 'save') {
      if (Avernia.save(slot)) { render(); say(`기록 ${slot}에 남겼다.`); } else say('지금은 저장할 수 없다.');
    } else if (a.dataset.act === 'load') {
      if (Avernia.load(slot)) close(); else say('지금은 불러올 수 없다.');
    } else if (a.dataset.act === 'go') {
      close();
      Avernia.go(a.dataset.to);
    }
  });

  window.UIMenu = { open, close, isOpen, renderSettings: () => VIEWS.settings() };
})();
