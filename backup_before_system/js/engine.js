// 화면과 게임 흐름: 시작 연출 → 기억 → 이름 → 숲 자유 탐색
(() => {
  'use strict';
  const $ = (s) => document.querySelector(s);
  const app = $('#app'), story = $('#story'), choicesEl = $('#choices'), hudEl = $('#hud');
  const freeRow = $('#freeRow'), freeInput = $('#free');

  let P = newPersistent();
  let R = newRun();
  let skip = false, wake = null, cancelChoice = null;

  const fmt = (s) => Text.fmt(s, { 이름: P.name });

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

  // 선택지를 띄우고 고른 결과를 반환한다. { idx } | { text } | { die }
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
        const l = document.createElement('span'); l.className = 'lbl'; l.textContent = o.label;
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

  function setHud() {
    const d = dayOf(R.t);
    const loc = LOCS[R.loc].name;
    hudEl.textContent = `${d > 1 ? DAY_KO[d] + ' ' : ''}${PERIOD_KO[periodOf(R.t)]} · ${loc}`;
  }

  // ---------- 시작 연출 ----------
  async function blackout(lines, pace) {
    document.body.classList.add('black');
    hudEl.textContent = '';
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
    if (/[?&]dev\b/.test(location.search)) { P.name = '민준'; return; }
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

  // 죽은 뒤 다시 눈을 뜨는 장면. 처음 이세계에 왔던 시점으로 돌아온다.
  async function rewindIntro() {
    const first = (P.rewinds ?? P.deaths) === 1;
    await blackout(first
      ? ['차가운 것이 뺨에 닿는다.', '젖은 흙이다.', '', '……이 감촉을 안다.']
      : ['젖은 흙.', '', '……또.'], 1100);
    await say(first
      ? ['같은 나무. 같은 하늘. 같은 물소리.', '', '이번에는, 안다.']
      : ['같은 숲이다.'], { pace: 800 });
    await more();
    clearPage();
  }

  // ---------- 장면 도구 ----------
  const ui = {
    get P() { return P; },
    get R() { return R; },
    async page(lines, opt) { clearPage(); setHud(); await say(lines, opt); },
    say: (lines, opt) => say(lines, opt),
    choose: (opts) => choose(opts),
    more: () => more(),
    pass: (min, opt) => passTime(min, opt),
    speak: (str) => Text.mask(str, P.language.avere, null, P.words),
    // 새 단어의 뜻을 알아내면 이해도가 오른다. 이미 알던 단어면 false.
    learn(word) {
      if (P.words[word]) return false;
      P.words[word] = true;
      P.language.avere = Math.min(100, P.language.avere + 5);
      return true;
    },
    know(id) { P.knowledge[id] = true; },
    use(k) { useStat(R, k); },
  };

  // ---------- 숲 탐색 ----------
  const ctx = () => ({
    R, P, period: periodOf(R.t),
    first(key) { if (R.seen[key]) return false; R.seen[key] = true; return true; },
    give(item, cap) {
      const n = R.counts[item] || 0;
      if (n >= cap) return false;
      R.counts[item] = n + 1;
      R.inv[item] = (R.inv[item] || 0) + 1;
      return true;
    },
    know(id) { P.knowledge[id] = true; },
    use(k) { useStat(R, k); },
  });

  // 시간이 흐른다: 하루의 사건, 몸의 변화, 그녀의 행동이 함께 진행된다.
  function passTime(min, { rest = false } = {}) {
    if (min <= 0) return takeNotes();
    const before = R.t;
    const ev = advance(R, P, min);
    const spent = R.t - before; // 목소리가 끼어들면 덜 흐른다
    if (dayOf(R.t) >= 2 && clockOf(R.t) >= 6 * 60) R.day2Acts++;
    const body = bodyTick(R, spent, rest);
    if (R.girl) {
      const o = girlTick(R, spent, R.loc === 'hollow');
      if (o.magic) R.pending.push('magic');
    }
    const out = [...(ev.length ? ['', ...ev] : []), ...(body.length ? ['', ...body] : [])];
    return [...out, ...takeNotes()];
  }

  function takeNotes() {
    if (!R.notes.length) return [];
    return ['', ...R.notes.splice(0)];
  }

  function doAction(a) {
    const lines = a.run(ctx());
    return [...lines, ...passTime(a.min)];
  }

  function doMove(e) {
    const g = ctx();
    const blocked = e.block && e.block(g);
    if (blocked) return [...blocked.lines, ...passTime(blocked.min)];
    const lines = [...e.text];
    // 밤에 돌아다니면 어둠 속의 무언가와 마주칠 수 있다
    if (g.period === 'night' && R.seen.night && Math.random() < 0.3) {
      hurt(R, 2, '어둠 속의 무언가에게 당했다');
      useStat(R, 'sen');
      lines.push('', '어둠 속에서 무언가가 발목을 스친다.', '날카로운 통증. 돌아봤을 때는 아무것도 없다.');
    }
    if (e.use) useStat(R, e.use);
    R.loc = e.to;
    if (e.to === 'edge') { R.end = 'alone'; lines.push(...passTime(e.min)); return lines; }
    lines.push(...passTime(e.min));
    // 그녀보다 먼저 도착하면, 그녀가 올 때까지 기다린다
    if (e.to === 'hollow' && R.girl && R.t < R.girl.since) {
      lines.push('', '아직 아무도 없다.', '뿌리 사이에 몸을 낮추고 기다린다.', ...passTime(R.girl.since - R.t),
        '', '……발소리. 누군가 비틀거리며 다가온다.');
      return lines;
    }
    lines.push('', ...LOCS[e.to].desc(ctx()));
    return lines;
  }

  function eatBerry() {
    R.inv.berry--; if (!R.inv.berry) delete R.inv.berry;
    R.hunger = Math.max(0, R.hunger - 25);
    const knew = P.knowledge.berry_poison;
    R.ateBerry = true;
    P.knowledge.berry_poison = true;
    hurt(R, 3, '붉은 열매의 독에 당했다');
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
    R.inv.herb--; if (!R.inv.herb) delete R.inv.herb;
    R.hunger = Math.max(0, R.hunger - 3);
    return ['쓴 풀을 씹어 본다.', '혀가 오그라들 만큼 쓰다. 삼키지 못하고 뱉는다.', ...passTime(5)];
  }

  function notebookLines() {
    const known = Object.keys(KNOW).filter((k) => P.knowledge[k]);
    return ['알고 있는 것을 하나씩 되짚는다.', '', ...known.map((k) => ({ t: '· ' + KNOW[k], cls: 'note' }))];
  }

  function wordLines() {
    return ['그녀에게서 들은 말을 입속으로 되뇐다.', '',
      ...Object.keys(P.words).map((x) => ({ t: `· 「${x}」`, cls: 'note' })), '',
      { t: `낯선 말  ${P.language.avere}%`, cls: 'stat' }];
  }

  // 둘째 날, 그녀가 있는 곳으로 가는 길
  function girlExit() {
    if (!R.girl || dayOf(R.t) < 2) return null;
    if (!['clearing', 'stream', 'deep'].includes(R.loc)) return null;
    if (R.seen.teaser) return { to: 'hollow', label: '피 냄새가 나던 쪽으로 간다', min: 20, kw: ['피', '냄새'], text: ['피 냄새를 기억하며 걷는다.'] };
    if (P.knowledge.girl_hollow) {
      return { to: 'hollow', label: '뿌리가 엉킨 움푹한 곳으로 간다', hint: '안다', min: 20, kw: ['움푹', '그녀', '여자'],
        text: ['이 숲에서 어디로 가야 하는지, 나는 안다.'] };
    }
    return null;
  }

  function buildOptions() {
    const L = LOCS[R.loc];
    const period = periodOf(R.t);
    const g = ctx();
    const opts = [];
    L.actions.forEach((a) => opts.push({ label: a.label, kw: a.kw, run: () => doAction(a) }));
    const exits = L.exits.filter((e) => !e.show || e.show(g));
    const ge = girlExit();
    if (ge) exits.push(ge);
    exits.forEach((e, i) => {
      const h = typeof e.hint === 'string' ? e.hint : e.hint && P.knowledge[e.hint[0]] ? e.hint[1] : null;
      opts.push({ label: e.label, hint: h, kw: e.kw, sep: i === 0, run: () => doMove(e) });
    });
    const G = GLOBAL_ACTIONS;
    opts.push({ label: G.listen.label, kw: G.listen.kw, sep: true,
      run: () => [...listenLines(ctx()), ...passTime(G.listen.min)] });
    opts.push({ label: G.bag.label, kw: G.bag.kw, run: () => bagLines(R) });
    if (R.inv.berry) opts.push({ label: '붉은 열매를 먹는다', kw: ['먹', '열매'], hint: P.knowledge.berry_poison ? '독이다' : null, run: eatBerry });
    if (R.inv.herb) opts.push({ label: '쓴 풀을 씹어 본다', kw: ['씹'], run: chewHerb });
    if (R.status.unlocked) opts.push({ label: '몸 상태를 확인한다', kw: ['상태', '몸'], scene: 'body' });
    if (Object.keys(P.words).length) opts.push({ label: '들은 말을 되뇐다', kw: ['말', '단어', '언어'], run: wordLines });
    if (P.deaths > 0 && Object.keys(KNOW).some((k) => P.knowledge[k])) {
      opts.push({ label: '기억을 되짚는다', kw: ['기억', '되짚', '수첩'], run: notebookLines });
    }
    if (period === 'night') {
      opts.push({ label: '밤이 지나가기를 기다린다', kw: G.rest.kw, run: () => [
        '나무에 등을 기대고 웅크린다.',
        '잠은 오지 않는다. 눈을 감아도 숲의 소리가 들린다.',
        '몇 번이고 눈을 뜨고, 다시 감는다.',
        ...passTime(minutesUntilDawn(R), { rest: true }),
      ] });
    } else {
      opts.push({ label: '잠시 쉰다', kw: G.rest.kw, run: () => [
        '나무에 등을 기대고 잠시 숨을 고른다.', '심장이 천천히 가라앉는다.', ...passTime(30, { rest: true }),
      ] });
    }
    return opts;
  }

  // 자유 입력을 가장 잘 맞는 선택지에 연결한다 (키워드가 겹칠수록 점수가 높다)
  function matchOption(opts, text) {
    let best = null, bestScore = 0;
    opts.forEach((o) => {
      const score = (o.kw || []).reduce((s, k) => s + (text.includes(k) ? k.length : 0), 0);
      if (score > bestScore) { best = o; bestScore = score; }
    });
    return best;
  }

  // 지금 벌어져야 할 장면이 있으면 그 이름을 돌려준다
  function nextScene() {
    const i = R.pending.findIndex((p) => p !== 'magic');
    if (i >= 0) return R.pending.splice(i, 1)[0];
    const c = clockOf(R.t), period = periodOf(R.t);
    if (R.loc === 'hollow' && girlHere(R)) return 'girl';
    if (!R.seen.beast && period !== 'night' && R.loc !== 'hill' && R.loc !== 'hollow'
      && (R.loc === 'downstream' || R.loc === 'deep' || (dayOf(R.t) === 1 && c >= 16 * 60 + 30))) return 'beast';
    if (!R.seen.light && period === 'evening' && ['clearing', 'deep', 'stream', 'downstream'].includes(R.loc)) return 'light';
    return null;
  }

  async function explore() {
    let carry = LOCS[R.loc].desc(ctx());
    let lastHp = R.hp;
    while (true) {
      clearPage();
      setHud();
      if (R.hp < lastHp) { const f = hpFeeling(R); if (f) carry = [...carry, '', f]; }
      lastHp = R.hp;
      await say(carry);
      if (R.hp <= 0) {
        await say(['', '더는 몸을 가눌 수 없다.', '흙바닥이 뺨에 닿는다.'], { pace: 900 });
        await more();
        return 'die';
      }
      if (R.end) { await more(); return 'end'; }

      const sc = nextScene();
      if (sc) {
        if (carry.length) await more();
        const res = await Scenes[sc](ui);
        if (res === 'die') return 'die';
        if (res === 'end:with') { R.end = 'with'; return 'end'; }
        carry = res === 'leave'
          ? ['그녀를 두고 자리를 뜬다.', ...passTime(15), '', ...LOCS[R.loc].desc(ctx())]
          : LOCS[R.loc].desc(ctx());
        lastHp = R.hp;
        continue;
      }

      // 둘째 날 아침: 바람에 피 냄새가 실려 온다
      if (girlHere(R) && R.day2Acts >= 3 && !R.seen.teaser && !R.girl.met) {
        R.seen.teaser = true;
        await say(['', '바람에 실려 무언가가 코끝을 스친다.', '……피 냄새다.'], { pace: 1200 });
        const { idx } = await choose([{ label: '냄새를 따라간다' }, { label: '모른 척한다' }]);
        if (idx === 0) {
          R.loc = 'hollow';
          carry = ['냄새를 따라 걷는다. 비릿한 냄새가 점점 짙어진다.', ...passTime(20)];
          continue;
        }
        carry = ['냄새가 나는 쪽에서 등을 돌린다.', '……신경 쓰이지 않는다면 거짓말이다.'];
        continue;
      }

      Save.write(P, R);
      const opts = buildOptions();
      const pick = await choose(opts, { free: true });
      if (pick.die) return 'die';
      const o = pick.text ? matchOption(opts, pick.text) : opts[pick.idx];
      if (!o) { carry = ['……어떻게 해야 할지 모르겠다.']; continue; }
      if (o.scene === 'body') { await Scenes.checkBody(ui); carry = LOCS[R.loc].desc(ctx()); continue; }
      carry = o.run();
    }
  }

  // ---------- 끝 ----------
  // 죽음: 검은 화면에 「죽었다」와 그 까닭, 몇 번째 죽음인지 보여 주고 처음 눈을 뜬 순간으로 되감는다
  async function die() {
    clearPage();
    hudEl.textContent = '';
    await say(['숨이 멎는다.', '눈앞이 어두워진다.'], { pace: 1000 });
    document.body.classList.add('black');
    await wait(1200);
    clearPage();
    P.deaths++;
    await say([
      { t: '죽었다', cls: 'death' },
      ...(R.cause ? [{ t: R.cause + '.', cls: 'dim center' }] : []),
      { t: `${P.deaths}번째 죽음`, cls: 'dim center' },
    ], { pace: 900 });
    await more();
    await rewind();
  }

  // 처음 눈을 뜬 순간으로 되감는다 (이름, 지식, 배운 말은 남는다)
  async function rewind() {
    P.rewinds = (P.rewinds ?? P.deaths - 1) + 1;
    R = newRun();
    Save.write(P, R);
  }

  async function endCard() {
    clearPage();
    hudEl.textContent = '';
    const G = R.girl;
    const story = R.end === 'with'
      ? ['그녀를 따라 걷는다.', '그녀는 몇 걸음마다 뒤를 돌아본다. 내가 따라오는지 확인하는 것처럼.', '',
        '해가 기울 무렵, 나무 사이가 성겨진다.', '숲이 끝나는 곳에 낮은 울타리와 지붕들이 보인다.', '굴뚝에서 연기가 오른다.', '',
        '리아가 걸음을 멈추고 나를 돌아본다.', ui.speak('「[[어서:40]] [[와:40]]. [[여기가:60]] [[마을:20]]이야.」'), '',
        '그녀가 무슨 말을 했는지, 전부는 모른다.', '하지만 언젠가는 알게 될 것이다.']
      : ['몇 시간을 걸었다.', '다리가 후들거리고, 목이 탄다.', '', '나무 사이가 성겨진다.', '숲이 끝나는 곳에 낮은 울타리와 지붕들이 보인다.',
        '사람이 있다.', '', ...(G && G.met ? ['……그녀는 어디로 갔을까.', ''] : []),
        '울타리 앞의 남자가 나를 보고 무언가 외친다.', '「……!」', '', '알아들을 수 없다.', '……대체, 이 세계는 뭐지?'];
    await say(story, { pace: 800 });
    await more();
    clearPage();
    const known = Object.keys(KNOW).filter((k) => P.knowledge[k]).length;
    await say([
      { t: '— 1장 · 이름 없는 숲 —', cls: 'center' }, '',
      { t: `죽음 ${P.deaths}번 · 알아낸 것 ${known}/${Object.keys(KNOW).length} · 배운 말 ${Object.keys(P.words).length}개`, cls: 'dim center' }, '',
      { t: '다음 단계: 마을과 사람들, 모험가 길드.', cls: 'dim center' },
    ], { pace: 700 });
    const { idx } = await choose([
      { label: '처음부터 다시', hint: '모든 기억을 지운다' },
      { label: '되감는다', hint: '이름과 지식, 배운 말이 남는다' },
    ]);
    return idx === 0 ? 'restart' : 'rewind';
  }

  async function titleMenu() {
    const s = Save.read();
    if (!s) return false;
    document.body.classList.add('black');
    clearPage();
    await say([{ t: '……이전의 기억이 남아 있다.', cls: 'center' }]);
    const { idx } = await choose([{ label: '이어서 한다' }, { label: '처음부터 한다', hint: '모든 기억을 지운다' }]);
    document.body.classList.remove('black');
    if (idx === 1) { Save.clear(); return false; }
    P = s.P;
    R = s.R;
    return true;
  }

  async function main() {
    let resume = await titleMenu();
    while (true) {
      if (!resume) {
        if (!P.name) await intro(); else await rewindIntro();
      }
      resume = false;
      const res = await explore();
      if (res === 'die') { await die(); continue; }
      const c = await endCard();
      if (c === 'restart') { Save.clear(); location.reload(); return; }
      await rewind();
    }
  }

  // 개발용: 콘솔에서 __dev.die() 로 죽음/되감기를 시험한다
  window.__dev = {
    die() { R.cause = '(개발용) 강제로 죽었다'; if (cancelChoice) cancelChoice({ die: true }); },
    state() { return { P, R }; },
    skipTo(minutes) { R.t += minutes; setHud(); },
  };

  main();
})();
