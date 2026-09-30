// 화면과 게임 흐름: 시작 연출 → 기억 → 이름 → 숲 자유 탐색.
// 게임 상태는 S = { P, W } 하나다. P는 되감아도 남고, W(세계)는 되감으면 처음으로 돌아간다.
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), story = $('#story'), choicesEl = $('#choices'), hudEl = $('#hud'), barEl = $('#bar');
  const freeRow = $('#freeRow'), freeInput = $('#free');

  const S = { P: Persist.create(), W: World.create(0) };
  const DIE = { die: true }; // 장면 도중 개발용 강제 죽음
  let skip = false, wake = null, cancelChoice = null;

  const fmt = (s) => Text.fmt(s, { 이름: S.P.name });
  const me = () => S.W.player;
  const flags = () => S.W.worldFlags;

  // ---------- 출력 ----------
  function wait(ms) {
    return new Promise((res) => {
      const t = setTimeout(() => { wake = null; res(); }, ms);
      wake = () => { clearTimeout(t); wake = null; res(); };
    });
  }

  function addLine(text, cls) {
    const p = document.createElement('p');
    p.className = 'line' + (text === '' ? ' gap' : '') + (cls ? ' ' + cls : '');
    p.textContent = fmt(text);
    story.appendChild(p);
    void p.offsetWidth; // 강제 리플로우: 다음 줄에서 클래스를 붙여도 전환 효과가 난다
    p.classList.add('in');
    window.scrollTo({ top: document.body.scrollHeight, behavior: 'smooth' });
  }

  // 줄을 하나씩 보여 준다. 클릭/Space/Enter로 나머지를 한 번에 보여 줄 수 있다.
  async function say(lines, { pace = 520, cls = '' } = {}) {
    skip = false;
    const stop = () => { skip = true; if (wake) wake(); };
    const onKey = (e) => {
      if ((e.key === 'Enter' || e.key === ' ') && document.activeElement.tagName !== 'INPUT') stop();
    };
    app.addEventListener('pointerdown', stop);
    document.addEventListener('keydown', onKey);
    try {
      for (let i = 0; i < lines.length; i++) {
        const o = typeof lines[i] === 'string' ? { t: lines[i] } : lines[i];
        addLine(o.t, o.cls || cls);
        if (!skip && o.t !== '' && i < lines.length - 1) await wait(o.pause || pace);
      }
    } finally {
      app.removeEventListener('pointerdown', stop);
      document.removeEventListener('keydown', onKey);
    }
  }

  // 클릭이나 Space/Enter를 기다린다.
  function more() {
    return new Promise((res) => {
      const hint = document.createElement('div');
      hint.className = 'more';
      hint.textContent = '▾';
      story.appendChild(hint);
      const armAt = performance.now() + 300;
      const done = (e) => {
        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
        if (performance.now() < armAt) return;
        app.removeEventListener('click', done);
        document.removeEventListener('keydown', done);
        hint.remove();
        res();
      };
      app.addEventListener('click', done);
      document.addEventListener('keydown', done);
    });
  }

  function clearPage() {
    story.innerHTML = '';
    choicesEl.innerHTML = '';
    freeRow.hidden = true;
    window.scrollTo(0, 0);
  }

  // 선택지를 띄우고 고른 결과를 반환한다. { idx } | { text } | { die } | { refresh }
  function choose(options, { free = false } = {}) {
    return new Promise((res) => {
      choicesEl.innerHTML = '';
      const armAt = performance.now() + 300;
      const finish = (v) => {
        document.removeEventListener('keydown', onKey);
        freeRow.onsubmit = null;
        cancelChoice = null;
        choicesEl.innerHTML = '';
        freeRow.hidden = true;
        res(v);
      };
      options.forEach((o, i) => {
        if (o.sep) { const s = document.createElement('div'); s.className = 'sep'; choicesEl.appendChild(s); }
        const b = document.createElement('button');
        b.className = 'choice';
        b.disabled = !!o.disabled;
        const n = document.createElement('span'); n.className = 'num'; n.textContent = i + 1;
        const l = document.createElement('span'); l.className = 'lbl'; l.textContent = fmt(o.label);
        b.append(n, l);
        if (o.hint) { const h = document.createElement('span'); h.className = 'hint'; h.textContent = '· ' + o.hint; b.append(h); }
        b.onclick = () => { if (performance.now() >= armAt) finish({ idx: i }); };
        choicesEl.appendChild(b);
      });
      choicesEl.classList.remove('in');
      void choicesEl.offsetWidth;
      choicesEl.classList.add('in');
      const onKey = (e) => {
        if (document.activeElement.tagName === 'INPUT') return;
        const i = e.key === '0' ? 9 : parseInt(e.key, 10) - 1;
        if (i >= 0 && i < options.length && !options[i].disabled) finish({ idx: i });
      };
      document.addEventListener('keydown', onKey);
      cancelChoice = finish;
      if (free) {
        freeRow.hidden = false;
        freeInput.value = '';
        freeRow.onsubmit = (e) => {
          e.preventDefault();
          const text = freeInput.value.trim();
          if (text) finish({ text });
        };
      }
    });
  }

  // 장면 안의 선택: 자유 입력도 받는다 (통합 명세 34절). 알아듣지 못한 입력은 다시 묻는다.
  async function sceneChoose(opts) {
    while (true) {
      const r = await choose(opts, { free: true });
      if (r.die) throw DIE;
      if (r.refresh) continue;
      if (r.idx != null) return { idx: r.idx, manner: null };
      const m = Intent.match(opts, r.text);
      if (m) return { idx: opts.indexOf(m.option), manner: m.manner };
      await say(['……어떻게 해야 할지 모르겠다.'], { cls: 'dim' });
    }
  }

  // 이름 입력
  function askName() {
    return new Promise((res) => {
      choicesEl.innerHTML = '';
      const form = document.createElement('form');
      form.className = 'nameRow';
      const input = document.createElement('input');
      input.maxLength = 8;
      input.placeholder = '이름';
      input.autocomplete = 'off';
      const btn = document.createElement('button');
      btn.className = 'choice go';
      btn.textContent = '이 이름이다';
      const err = document.createElement('p');
      err.className = 'err';
      form.append(input, btn, err);
      choicesEl.appendChild(form);
      choicesEl.classList.add('in');
      input.focus();
      form.onsubmit = (e) => {
        e.preventDefault();
        const v = input.value.replace(/\s+/g, ' ').trim();
        if (!/^[가-힣a-zA-Z0-9 ]{1,8}$/.test(v)) {
          err.textContent = '……이름이 흐릿하다. (한글·영문·숫자 1~8자)';
          return;
        }
        choicesEl.innerHTML = '';
        res(v);
      };
    });
  }

  // 위: 날과 시간대, 장소 / 아래: 몸 상태를 느낌으로 (통합 명세 37절)
  function setHud() {
    const t = S.W.time.t;
    const d = Time.day(t);
    hudEl.textContent = `${d > 1 ? Time.dayLabel(t) + ' ' : ''}${Time.KO[Time.band(t)]} · ${Places.name(me().loc)}`;
    barEl.textContent = Player.barWords(S.W).map(([k, v]) => `${k} ${v}`).join('　·　');
    document.body.dataset.band = Time.band(t); // 시간대 색 연출 (style.css)
  }
  function clearHud() { hudEl.textContent = ''; barEl.textContent = ''; delete document.body.dataset.band; }

  // ---------- 시작 연출 ----------
  async function blackout(lines, pace) {
    document.body.classList.add('black');
    clearHud();
    clearPage();
    await say(lines, { pace, cls: 'center' });
    await more();
    clearPage();
    await say(['눈을 뜬다.'], { cls: 'center' });
    await wait(1400);
    document.body.classList.remove('black');
    clearPage();
    await wait(1600);
  }

  async function intro() {
    // 개발용: 주소 끝에 ?dev 를 붙이면 연출과 이름 입력을 건너뛴다
    if (/[?&]dev\b/.test(location.search)) { S.P.name = '민준'; S.P.memory.name = true; return; }
    await blackout([
      '어둡다.', '', '춥다.', '', '몸이 젖어 있다.', '', '흙 냄새가 난다.', '',
      '그리고 어디선가 물 흐르는 소리가 들린다.',
    ], 1100);
    await say([
      '나무가 있다. 아주 높다.',
      '가지 사이로 조각난 하늘이 보인다.',
      '풀 사이로 작은 계곡의 물빛이 어른거린다.',
      '이끼 낀 바위. 이름을 모르는 식물들.',
      '',
      '……',
    ], { pace: 800 });
    await more();
    clearPage();
    await memoryScene();
  }

  async function memoryScene() {
    const P = S.P;
    await say(['……여기가 어디지?', '나는……', '누구지?'], { pace: 900 });
    const used = new Set();
    const menu = [
      { id: 'name', label: '내 이름을 떠올린다.' },
      { id: 'last', label: '마지막으로 기억나는 순간을 떠올린다.' },
      { id: 'family', label: '가족을 떠올린다.' },
      { id: 'place', label: '내가 있던 장소를 떠올린다.' },
      { id: 'none', label: '아무것도 생각하지 않는다.' },
    ];
    const fragments = {
      last: ['마지막으로 기억나는 순간을 더듬는다.', '……문이 닫히는 소리. 어딘가로 가고 있었다. 누군가에게 무언가를 말하려 했다.', '거기서, 뚝 끊겨 있다.'],
      family: ['가족을 떠올린다.', '……누군가의 얼굴이 스친다. 얼굴만. 이름은 나오지 않는다.', '그런데 이상하게, 가슴이 먹먹하다.'],
      place: ['내가 있던 곳을 떠올린다.', '……익숙한 방. 창으로 들어오는 아침빛. 멀리서 들리던 소음.', '하지만 어디였는지는 떠오르지 않는다.'],
    };
    while (true) {
      const opts = menu.filter((m) => !used.has(m.id));
      const { idx } = await choose(opts);
      const id = opts[idx].id;
      clearPage();
      if (id === 'name' || id === 'none') {
        if (id === 'none') {
          await say(['눈을 감고 머리를 비운다.', '바람 소리. 물소리. 내 숨소리.', '……조금 진정된다.', '그래도, 이름은 떠올려야 한다.']);
        } else {
          await say(['이름을 떠올려 본다.', '……그래.']);
        }
        await say(['내 이름은……'], { pace: 600 });
        P.name = await askName();
        P.memory.name = true;
        clearPage();
        await say([
          `……{이름}.`, '적어도 이것 하나는 기억난다.', '내 이름.', '',
          '주변에는 아무도 없다.', '혼자다.', '', '일단, 움직여야 한다.',
        ], { pace: 800 });
        await more();
        return;
      }
      used.add(id);
      if (id === 'last') P.memory.lastMoment = 'fragment';
      if (id === 'family') P.memory.family = 'fragment';
      if (id === 'place') P.memory.previousLocation = 'fragment';
      await say(fragments[id], { pace: 750 });
      await say(['', '……여기까지다. 더는 떠오르지 않는다.'], { pace: 700 });
    }
  }

  // 쓰러진다 (체력 0). 죽지 않는다: 구조되거나 깨어나고, 대가가 남는다 (play/collapse.js, RULES.collapse [임시])
  async function collapse() {
    clearPage();
    clearHud();
    await say(['다리에서 힘이 빠진다.', '눈앞이 어두워진다.'], { pace: 1000 });
    document.body.classList.add('black');
    await wait(1200);
    clearPage();
    const met = (n) => Memory.has(n, 'player', 'met');
    const r = Collapse.resolve(S, me().cause);
    await say([{ t: '……', cls: 'center' }], { pace: 900 });
    await more();
    document.body.classList.remove('black');
    clearPage();
    setHud();
    const lines = [];
    if (r.again) lines.push({ t: '……또 쓰러졌다. 몸이 버텨 주지 않는다.', cls: 'dim' }, '');
    if (r.rescuer) {
      const w = Narrative.who(S, r.rescuer, !met(r.rescuer));
      const hi = Dialogue.process(S, { speakerId: r.rescuer.id, listenerId: 'player', dialogueId: 'are_you_ok' });
      lines.push('누군가 나를 흔드는 느낌에 눈을 뜬다.', `${w}${Text.josa(w, '이가')} 곁에 앉아 있다.`, '상처에 무언가가 감겨 있다.', hi.displayText);
      if (hi.tone && !hi.fullyUnderstood) lines.push(hi.tone);
    } else {
      lines.push('눈을 뜬다.', '얼마나 누워 있었는지 모르겠다.', Time.dark(S.W.time.t) ? '주위가 캄캄하다.' : '빛의 기울기가 달라져 있다.');
      if (r.lost) { const l = Player.label(r.lost, S.P); lines.push(`주머니가 가볍다. ${l}${Text.josa(l, '이가')} 없다.`); }
    }
    const f = Player.hpFeeling(me());
    if (f) lines.push('', f);
    Save.write(S);
    await say(lines);
    await more();
  }

  // 첫날 밤 보호 중에 장면이 죽음으로 끝났다 (밤의 목소리 등) [결정 #6]: 쓰러지지 않는다.
  // 정신이 아득해졌다가 돌아오고, 탈진과 시간만 남는다. [임시] 문장 — 장면의 결말은 스토리가 다시 쓴다
  async function shaken() {
    const R = RULES.protection;
    clearPage();
    await say(['눈앞이 하얘진다.', '……'], { pace: 900 });
    World.tick(S, R.shakenMin, { unconscious: true });
    flags().feed.length = 0;
    const m = me();
    m.hp = Math.max(m.hp, R.minHp);
    m.surv.fatigue = Math.min(100, m.surv.fatigue + R.shakenFatigue);
    Save.write(S);
    await say(['', '정신을 차리니 차가운 흙바닥 위다.', '온몸이 떨린다. 무슨 일이 있었는지 제대로 떠오르지 않는다.'], { pace: 800 });
    await more();
  }

  // 예전 저장 파일에서 이름만 가져와 새로 시작할 때
  async function wakeAgain() {
    await blackout(['젖은 흙.', '', '물 흐르는 소리.'], 1100);
  }

  // ---------- 장면 도구 ----------
  const ui = {
    get S() { return S; },
    get P() { return S.P; },
    get W() { return S.W; },
    get me() { return S.W.player; },
    talker: null, // 지금 마주한 NPC (말을 하는 사람)
    async page(lines, opt) { clearPage(); setHud(); await say(lines, opt); },
    say: (lines, opt) => say(lines, opt),
    choose: (opts) => sceneChoose(opts),
    more: () => more(),
    pass: (min, opt) => passTime(min, opt),
    speak(str, by) { return Lang.speak(S, str, by || ui.talker); },
    // 새 단어의 뜻을 알아내면 이해도가 오른다. 이미 알던 단어면 false.
    learn: (word, o) => Lang.learn(S, word, o),
    guess: (word) => Lang.guess(S, word),
    knows: (word) => Lang.knows(S, word),
    know(id) { S.P.knowledge[id] = true; Explore.onFact(S, id); Clues.onFact(S, id); },
    use(k) { Player.use(S, k); },
    chance: (p) => Rng.chance(S.W, p),
    pick: (a) => Rng.pick(S.W, a),
    hurt: (n, cause, by) => Player.hurt(S, n, cause, by),
    npc: (id) => S.W.npcs[id],
    rel: (id) => Rel.get(S.W, id, 'player'),
    relate: (id, d, cause) => Rel.change(S, id, 'player', d, cause),
  };

  // ---------- 숲 탐색 ----------
  const ctx = () => {
    const W = S.W, t = W.time.t;
    return {
      W, P: S.P, me: W.player, period: Time.band(t), dark: Time.dark(t),
      first(key) { if (W.worldFlags.seen[key]) return false; W.worldFlags.seen[key] = true; return true; },
      give(item, cap) {
        const n = W.worldFlags.counts[item] || 0;
        if (n >= cap) return false;
        W.worldFlags.counts[item] = n + 1;
        Player.give(W.player, item);
        return true;
      },
      know(id) { ui.know(id); },
      use(k) { Player.use(S, k); },
    };
  };

  // 지금 있는 곳: 장소 묘사 + 날씨 + 보지 못한 사이 남은 흔적 + 곁에 있는 사람
  function placeLines() {
    const W = S.W;
    const loc = me().loc;
    const lines = LOCS[loc].desc(ctx());
    const extra = Weather.SKY_EXTRA[W.weather.kind];
    if (extra) lines.push(extra);
    const tr = Narrative.traceLines(S, loc);
    if (tr.length) lines.push('', ...tr);
    return lines;
  }

  // 시간이 흐른다: 세계 전체가 함께 움직인다 (월드 틱)
  function passTime(min, opt = {}) {
    if (min <= 0) return takeNotes();
    const W = S.W;
    const r = World.tick(S, min, opt);
    if (Time.day(W.time.t) >= 2 && Time.clock(W.time.t) >= 6 * 60) flags().day2Acts++;
    return [...(r.lines.length ? ['', ...r.lines] : []), ...(r.body.length ? ['', ...r.body] : []), ...takeNotes()];
  }

  function takeNotes() {
    const f = flags();
    const out = [];
    if (f.feed.length) out.push('', ...f.feed.splice(0));
    if (f.notes.length) out.push('', ...f.notes.splice(0));
    return out;
  }

  function doAction(a) {
    const lines = a.run(ctx());
    Explore.didAction(S, me().loc, a.id);
    return [...lines, ...passTime(a.min)];
  }

  // 자리를 옮긴다. 함께 다니는 사람도 따라온다 (따라오지 않으면 그 줄을 돌려준다)
  function moveTo(to) {
    const from = me().loc;
    me().loc = to;
    Bus.emit(S, 'PLAYER_MOVED', { from, to });
    return Companion.onMove(S, from, to);
  }

  function doMove(e) {
    const g = ctx();
    const blocked = e.block && e.block(g);
    if (blocked) return [...blocked.lines, ...passTime(blocked.min)];
    const lines = [...e.text];
    // 밤에 돌아다니면 어둠 속의 무언가와 마주칠 수 있다 (그것이 지나는 곳을 밟으면)
    if (Creatures.nightStrike(S, me().loc, e.to)) {
      Player.hurt(S, 2, '어둠 속의 무언가에게 당했다', 'shade');
      Player.injure(S, 'scratch', 25);
      Player.use(S, 'sen');
      lines.push('', '어둠 속에서 무언가가 발목을 스친다.', '날카로운 통증. 돌아봤을 때는 아무것도 없다.');
    }
    if (e.use) Player.use(S, e.use);
    lines.push(...moveTo(e.to));
    lines.push(...passTime(e.min, { move: true }));
    // 그녀보다 먼저 도착하면, 그녀가 올 때까지 기다린다
    const lia = S.W.npcs.lia;
    if (e.to === 'hollow' && lia.alive && lia.location.transit && lia.location.dest === 'hollow' && lia.location.nextAt > S.W.time.t) {
      lines.push('', '아직 아무도 없다.', '뿌리 사이에 몸을 낮추고 기다린다.', ...passTime(Math.ceil(lia.location.nextAt - S.W.time.t)),
        '', '……발소리. 누군가 비틀거리며 다가온다.');
      return lines;
    }
    lines.push('', ...placeLines());
    return lines;
  }

  function eatBerry() {
    const P = S.P, m = me();
    Player.take(m, 'berry');
    m.surv.hunger = Math.max(0, m.surv.hunger - 25);
    const knew = P.knowledge.berry_poison;
    m.ateBerry = true;
    ui.know('berry_poison');
    Player.hurt(S, 3, '붉은 열매의 독에 당했다', 'berry');
    Player.sicken(S, 'poison', 180);
    return [
      knew ? '먹으면 안 된다는 걸 알면서도, 허기를 이기지 못한다.' : '열매를 하나 입에 넣는다. 달다. 하나 더.',
      '……얼마 지나지 않아 배 속이 뒤틀린다.',
      '무릎을 꿇고 전부 게워 낸다. 식은땀이 흐른다.',
      '한참을 그렇게 웅크려 있었다.',
      ...(knew ? [] : [{ t: '……이건 먹으면 안 되는 거였다.', cls: 'know' }]),
      ...passTime(60),
    ];
  }

  function chewHerb() {
    const m = me();
    Player.take(m, 'herb');
    m.surv.hunger = Math.max(0, m.surv.hunger - 3);
    return ['쓴 풀을 씹어 본다.', '혀가 오그라들 만큼 쓰다. 삼키지 못하고 뱉는다.', ...passTime(5)];
  }

  // 아는 것을 쓴다: 피를 멎게 하는 풀 (지식이 새 선택지를 연다)
  function treatSelf() {
    Player.take(me(), 'herb');
    Player.treat(S);
    return ['쓴 풀을 두 손으로 비벼 짓이긴다.', '상처에 꾹 누른다. 눈앞이 하얘질 만큼 쓰라리다.', '……피가 멎는다.', ...passTime(10)];
  }

  function notebookLines() {
    const P = S.P;
    const known = Object.keys(KNOW).filter((k) => P.knowledge[k]);
    return ['알고 있는 것을 하나씩 되짚는다.', '', ...known.map((k) => ({ t: '· ' + KNOW[k], cls: 'note' })), ...Clues.lines(S)];
  }

  const liaWounded = () => S.W.events.scheduled.some((e) => e.type === 'lia_wounded' && e.done);
  const liaAtHollow = () => Npc.at(S.W, 'lia', 'hollow');

  // 둘째 날, 그녀가 있는 곳으로 가는 길
  function girlExit() {
    if (!liaWounded()) return null;
    if (!['clearing', 'stream', 'deep'].includes(me().loc)) return null;
    if (flags().seen.teaser) return { to: 'hollow', label: '피 냄새가 나던 쪽으로 간다', min: 20, kw: ['피', '냄새'], text: ['피 냄새를 기억하며 걷는다.'] };
    if (S.P.knowledge.girl_hollow) {
      return { to: 'hollow', label: '뿌리가 엉킨 움푹한 곳으로 간다', hint: '안다', min: 20, kw: ['움푹', '그녀', '여자'],
        text: ['이 숲에서 어디로 가야 하는지, 나는 안다.'] };
    }
    return null;
  }

  function buildOptions() {
    const P = S.P, m = me();
    const L = LOCS[m.loc];
    const g = ctx();
    const opts = [];
    L.actions.forEach((a) => opts.push({ label: a.label, kw: a.kw, run: () => doAction(a) }));
    opts.push(...Life.options(S, passTime)); // 일, 잠자리, 잠, 가게, 동행과 헤어지기
    // 이미 아는 사람이 곁에 있으면 내가 다가갈 수 있다
    Npc.here(S.W, m.loc).filter((n) => !n.location.hidden && Memory.has(n, 'player', 'met') && !(n.id === 'lia' && m.loc === 'hollow'))
      .forEach((n) => opts.push({ label: `${Narrative.who(S, n)}에게 다가간다`, kw: [Narrative.who(S, n)], scene: 'meet:' + n.id }));
    const exits = L.exits.filter((e) => !e.show || e.show(g));
    const ge = girlExit();
    if (ge) exits.push(ge);
    Explore.seeExits(S, exits);
    exits.forEach((e, i) => {
      const h = typeof e.hint === 'string' ? e.hint : e.hint && P.knowledge[e.hint[0]] ? e.hint[1] : null;
      opts.push({ label: e.label, hint: h, kw: e.kw, sep: i === 0, run: () => doMove(e) });
    });
    const G = GLOBAL_ACTIONS;
    opts.push({ label: G.listen.label, kw: G.listen.kw, sep: true,
      run: () => [...listenLines(ctx()), ...passTime(G.listen.min)] });
    opts.push({ label: G.bag.label, kw: G.bag.kw, run: () => bagLines(S) });
    if (m.inv.berry) opts.push({ label: '붉은 열매를 먹는다', kw: ['먹', '열매'], hint: P.knowledge.berry_poison ? '독이다' : null, run: eatBerry });
    if (m.inv.herb && Player.bleeding(S.W) && P.knowledge.herb_heals) opts.push({ label: '쓴 풀을 짓이겨 상처에 댄다', kw: ['상처', '풀'], hint: '안다', run: treatSelf });
    else if (m.inv.herb) opts.push({ label: '쓴 풀을 씹어 본다', kw: ['씹'], run: chewHerb });
    if (m.status.unlocked) opts.push({ label: '몸 상태를 확인한다', kw: ['상태', '몸'], scene: 'body' });
    if (LangUI.hasAny(S)) opts.push({ label: '들은 말을 되뇐다', kw: ['말', '단어', '언어'], run: () => LangUI.notebook(S) });
    if (Object.keys(KNOW).some((k) => P.knowledge[k]) || Object.keys(P.clues).length) {
      opts.push({ label: '기억을 되짚는다', kw: ['기억', '되짚', '수첩'], run: notebookLines });
    }
    if (g.dark) {
      opts.push({ label: '밤이 지나가기를 기다린다', kw: G.rest.kw, run: () => [
        '나무에 등을 기대고 웅크린다.',
        '잠은 오지 않는다. 눈을 감아도 숲의 소리가 들린다.',
        '몇 번이고 눈을 뜨고, 다시 감는다.',
        ...passTime(Time.untilDawn(S.W.time.t), { rest: true }),
      ] });
    } else {
      opts.push({ label: '잠시 쉰다', kw: G.rest.kw, run: () => [
        '나무에 등을 기대고 잠시 숨을 고른다.', '심장이 천천히 가라앉는다.', ...passTime(30, { rest: true }),
      ] });
    }
    return opts;
  }

  // 지금 벌어져야 할 장면이 있으면 그 이름을 돌려준다
  function nextScene() {
    const W = S.W, m = me();
    const pend = flags().pending;
    const i = pend.findIndex((p) => !p.startsWith('magic'));
    if (i >= 0) return pend.splice(i, 1)[0];
    if (m.loc === 'hollow' && liaAtHollow()) return 'girl';
    if (m.loc === 'edge' && !flags().seen.arrival) return 'arrival';
    // 누군가 곁에 와 있다: 처음 보는 사람, 누군가를 찾는 사람, 나를 적대하는 사람은 먼저 다가온다.
    // 이미 아는 사람에게는 내가 다가간다 (선택지)
    const other = Npc.here(W, m.loc).find((n) => !n.location.hidden && !(n.id === 'lia' && m.loc === 'hollow')
      && (!Memory.has(n, 'player', 'met') || Goals.get(n, 'search') || Rel.get(W, n.id, 'player').hostility >= 50)
      && !(n.flags.metAt != null && W.time.t - n.flags.metAt < 60));
    if (other) return 'meet:' + other.id;
    if (Creatures.engages(S)) return 'beast';
    if (!flags().seen.light && Time.band(W.time.t) === 'evening' && ['clearing', 'deep', 'stream', 'downstream'].includes(m.loc)) return 'light';
    return null;
  }

  async function runScene(sc) {
    if (sc.startsWith('meet:')) return Encounter.run(ui, sc.slice(5));
    return Scenes[sc](ui);
  }

  async function explore() {
    Knowledge.location(S, me().loc, 'visited'); // 눈을 뜬 곳
    let carry = placeLines();
    let lastHp = me().hp;
    while (true) {
      clearPage();
      setHud();
      if (me().hp < lastHp) { const f = Player.hpFeeling(me()); if (f) carry = [...carry, '', f]; }
      lastHp = me().hp;
      await say(carry);
      if (me().hp <= 0) {
        await say(['', '더는 몸을 가눌 수 없다.', '흙바닥이 뺨에 닿는다.'], { pace: 900 });
        await more();
        return 'die';
      }
      const sc = nextScene();
      if (sc) {
        if (carry.length) await more();
        let res;
        try {
          res = await runScene(sc);
          // 리아를 따라 마을까지 함께 걷는다
          if (res === 'travel') res = await Scenes.arriveWith(ui);
        } catch (e) { if (e === DIE) return 'die'; throw e; }
        ui.talker = null;
        if (res === 'die' || me().hp <= 0) return 'die';
        carry = res === 'leave'
          ? ['그녀를 두고 자리를 뜬다.', ...passTime(15), '', ...placeLines()]
          : placeLines();
        lastHp = me().hp;
        continue;
      }

      // 둘째 날 아침: 바람에 피 냄새가 실려 온다
      const lia = S.W.npcs.lia;
      if (liaAtHollow() && flags().day2Acts >= 3 && !flags().seen.teaser && !lia.flags.met) {
        flags().seen.teaser = true;
        await say(['', '바람에 실려 무언가가 코끝을 스친다.', '……피 냄새다.'], { pace: 1200 });
        const { idx } = await choose([{ label: '냄새를 따라간다' }, { label: '모른 척한다' }]);
        if (idx === 0) {
          moveTo('hollow');
          carry = ['냄새를 따라 걷는다. 비릿한 냄새가 점점 짙어진다.', ...passTime(20, { move: true })];
          continue;
        }
        carry = ['냄새가 나는 쪽에서 등을 돌린다.', '……신경 쓰이지 않는다면 거짓말이다.'];
        continue;
      }

      Save.write(S);
      const opts = buildOptions();
      const pick = await choose(opts, { free: true });
      if (pick.die) return 'die';
      if (pick.refresh) { carry = placeLines(); continue; }
      let o = pick.idx != null ? opts[pick.idx] : null;
      if (!o && pick.text) { const m = Intent.match(opts, pick.text); o = m && m.option; }
      if (!o) { carry = ['……어떻게 해야 할지 모르겠다.']; continue; }
      if (o.scene) {
        try {
          if (o.scene === 'body') await Scenes.checkBody(ui);
          else if (o.scene === 'shop') await Shop.run(ui);
          else { const r = await runScene(o.scene); ui.talker = null; if (r === 'die') return 'die'; }
        } catch (e) { if (e === DIE) return 'die'; throw e; }
        if (me().hp <= 0) return 'die';
        carry = placeLines();
        continue;
      }
      carry = o.run();
    }
  }

  // ---------- 흐름 ----------
  async function titleMenu() {
    const s = Save.read();
    if (!s) return false;
    document.body.classList.add('black');
    clearPage();
    await say([{ t: '……이전의 기억이 남아 있다.', cls: 'center' }]);
    const { idx } = await choose([{ label: '이어서 한다' }, { label: '처음부터 한다', hint: '모든 기억을 지운다' }]);
    document.body.classList.remove('black');
    if (idx === 1) { Save.clear(); return false; }
    S.P = s.P;
    S.W = s.W;
    // 예전 저장 파일은 세계를 이어 붙일 수 없어서, 이름과 기억만 가지고 숲에서 새로 시작한다
    return s.migrated ? 'fresh' : true;
  }

  // 되감기는 없다 (스토리_재설계.md 0절). 쓰러져도 세계는 이어진다.
  async function main() {
    const resume = await titleMenu();
    if (resume === 'fresh') await wakeAgain();
    else if (resume !== true) await intro();
    while (true) {
      const res = await explore();
      if (res === 'die') await (Player.sheltered(S) ? shaken() : collapse());
    }
  }

  // 개발용: 콘솔에서 __dev.die() 로 쓰러짐을 시험한다. 디버그 화면(debug.js)도 이것을 쓴다.
  window.__dev = {
    S,
    die() { me().cause = '(개발용) 강제로 쓰러졌다'; if (cancelChoice) cancelChoice({ die: true }); },
    state() { return S; },
    // 세계를 흘린다 (대본 사건 포함). 화면을 새로 그린다.
    skipTo(minutes) { World.tick(S, minutes); this.refresh(); },
    refresh() { setHud(); if (cancelChoice) cancelChoice({ refresh: true }); },
  };

  main();
})();
