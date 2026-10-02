// 삶의 기록(지시문 4의 23절) · 중요한 선택 [D5] · 평판 [D6] · 장면 우선순위 표(지시문 5의 20절)

// 장면을 흉내 내는 ui: 정해 둔 선택을 차례로 고른다 (id 또는 선택지 문구의 앞부분)
function fakeUi(S, script) {
  const ui = {
    S, get W() { return S.W; }, get P() { return S.P; }, get me() { return S.W.player; }, talker: null,
    async page() {}, async say() {}, async more() {},
    async choose(opts) {
      const want = script.shift();
      const idx = opts.findIndex((o) => o.id === want || (want && o.label && o.label.startsWith(want)));
      if (idx < 0) throw new Error(`선택지 없음: ${want} / ${opts.map((o) => o.id || o.label).join(',')}`);
      return { idx, manner: null };
    },
    pass: (m, o) => { World.tick(S, m, o); return []; },
    lose: () => Collapse.lose(S),
    speak: (str, by) => Lang.line(Dialogue.process(S, { speakerId: by || ui.talker, listenerId: 'player', text: str }), by || ui.talker),
    learn: (w, o) => Lang.learn(S, w, o), guess: (w) => Lang.guess(S, w), knows: (w) => Lang.knows(S, w),
    know(id) { if (!S.P.knowledge[id]) S.P.knowledge[id] = S.W.time.t; Explore.onFact(S, id); Clues.onFact(S, id); },
    use: (k) => Player.use(S, k), chance: (p) => Rng.chance(S.W, p), pick: (a) => Rng.pick(S.W, a),
    hurt: (n, c, b) => Player.hurt(S, n, c, b), npc: (id) => S.W.npcs[id], rel: (id) => Rel.get(S.W, id, 'player'),
    relate: (id, d, c) => Rel.change(S, id, 'player', d, c),
  };
  return ui;
}
const KEYS23 = ['life_style', 'occupation_history', 'favorite_activity', 'exploration_history', 'relationship_history',
  'economic_history', 'reputation', 'knowledge', 'major_choices', 'settlement', 'travel_history'];

// LL1 한곳에서 읽기: 23절의 열한 가지가 모두 나오고, 저장해도 그대로이며, 예전 저장 파일에도 칸이 생긴다
(() => {
  const S = newGame();
  atHollowWithLia(S);
  Player.teleport(S, 'stream');
  const L = LifeLog.read(S);
  const missing = KEYS23.filter((k) => !(k in L));
  Save.write(S);
  const back = Save.read();
  const same = JSON.stringify(back.W.player.life) === JSON.stringify(S.W.player.life);
  delete back.W.player.life;
  Save.load({ v: 2, P: back.P, W: back.W });
  check('LL1 삶 기록 → 23절의 열한 가지를 한곳에서 읽고, 저장·불러오기에도 남는다', !missing.length && same && !!back.W.player.life && L.exploration_history.some((x) => x.loc === 'stream' && x.visits >= 1),
    `빠진 것 ${missing.join(',') || '없음'}, 저장 뒤 같음 ${same}, 예전 파일에 칸 생김 ${!!back.W.player.life}, 계곡 방문 ${L.exploration_history.find((x) => x.loc === 'stream').visits}번`);
})();

// LL2 돈의 흐름: 품삯·가게·방값이 장부에 남고, 장부의 합이 실제로 늘고 준 돈과 같다
(() => {
  const S = newGame();
  inVillage(S, 'village_field', 2, 7); keepAlive(S);
  S.W.player.money = 10;
  const pass = (m, o) => { World.tick(S, m, o); return []; };
  Work.perform(S, 'field', pass);
  to(S, 2, 11); Player.teleport(S, 'village_square'); keepAlive(S);
  Shop.buy(S, 'bread');
  to(S, 2, 18, 30); Player.teleport(S, 'village_inn'); keepAlive(S);
  const canRoom = Lodging.offers(S).some((o) => o.id === 'room');
  if (canRoom) Lodging.take(S, 'room', pass);
  to(S, 2, 21); Player.teleport(S, 'village_inn'); keepAlive(S);
  Lodging.sleep(S, pass);
  const E = LifeLog.read(S).economic_history;
  const kinds = E.ledger.map((x) => `${x.kind}${x.amount > 0 ? '+' : ''}${x.amount}`);
  const sum = E.ledger.reduce((s, x) => s + x.amount, 0);
  check('LL2 돈의 흐름 → 품삯·가게·방값이 장부에 남고, 장부의 합 = 늘고 준 돈', canRoom && ['wage', 'buy', 'rent'].every((k) => E.sums[k]) && E.sums.rent.count === 1 && sum === S.W.player.money - 10,
    `장부 ${kinds.join(' ')} (합 ${sum}), 돈 10→${S.W.player.money}, 방값 낸 횟수 ${E.sums.rent && E.sums.rent.count}`);
})();

// LL3 즐겨 하는 일: 들인 시간과 횟수로 정하고, 활동이 적으면 아직 정하지 않는다. 길을 걷는 것은 세지 않는다
(() => {
  const A = newGame();
  inVillage(A, 'village_field', 2, 7); keepAlive(A);
  const pass = (m, o) => { World.tick(A, m, o); return []; };
  Work.perform(A, 'field', pass); keepAlive(A);
  Work.perform(A, 'field', pass);
  ['look', 'look', 'look'].forEach((id) => Explore.didAction(A, 'clearing', id));
  const early = LifeLog.favorite(A);
  Explore.didAction(A, 'clearing', 'look');
  const fa = LifeLog.favorite(A), sa = LifeLog.style(A);
  const B = newGame();
  for (let i = 0; i < 6; i++) Explore.didAction(B, 'clearing', 'look');
  ['stream', 'clearing', 'stream', 'clearing', 'stream', 'clearing', 'stream', 'clearing'].forEach((l) => Player.teleport(B, l));
  const fb = LifeLog.favorite(B), sb = LifeLog.style(B);
  check('LL3 즐겨 하는 일 → 밭일을 오래 한 삶은 "일"(생활인, 몸 쓰는 일), 둘러보기만 한 삶은 "탐험"', early === null && fa.main === 'work' && sa.main === 'settler' && sa.tendency === 'labor'
    && fb.main === 'explore' && sb.main === 'explorer',
    `활동 5번일 때 ${early}, A: ${fa.main}/${sa.main}(${sa.tendency}) 둘째 ${fa.second}, B: ${fb.main}/${sb.main} (B의 이동 ${B.W.player.life.activity.travel.count}번은 빼고 셈)`);
})();

// LL4 평판 [D6]: 지역(마을) 단위. 리아를 도운 세계와 위협한 세계에서 마을이 나를 보는 눈이 다르다
(() => {
  const world = (how) => {
    const S = newGame();
    atHollowWithLia(S);
    if (how === 'help') {
      Social.help(S, 'player', 'lia', 'water', { trust: 10, suspicion: -5 });
      Social.help(S, 'player', 'lia', 'herb', { trust: 20, respect: 10 });
      lia(S).physical.bleed = 0;
    } else {
      Social.threaten(S, 'player', 'lia', { hostility: 50, trust: -30, fear: 20 });
      lia(S).physical.bleed = 0;
    }
    Player.teleport(S, 'hill');
    to(S, 3, 12);
    return LifeLog.reputation(S);
  };
  const H = world('help'), T = world('threat');
  const v = (R) => `${R.word}(소문 ${JSON.stringify(R.rumors)}, 들은 사람 ${R.heard}/${R.people})`;
  check('LL4 평판 → 마을 단위로, 도운 세계는 "도왔다" 소문이 돌고 위협한 세계보다 좋게 본다', H.village && T.village && (H.village.rumors.helped || 0) >= 1
    && (T.village.rumors.threatened || 0) >= 1 && H.village.standing > T.village.standing && !('lumeris' in H),
    `도움: ${v(H.village)} / 위협: ${v(T.village)}`);
})();

// LL5 중요한 선택 [D5]: important로 표시된 것만, 처음 한 번만 남는다
(() => {
  const S = newGame();
  RULES.choices.__plain = { important: false, label: '시험', outcomes: { a: 'a' } };
  const a = LifeLog.choose(S, 'lia_first_meeting', 'helped');
  const b = LifeLog.choose(S, 'lia_first_meeting', 'attacked');
  const c = LifeLog.choose(S, '__plain', 'a');
  const d = LifeLog.choose(S, 'no_such_choice', 'x');
  delete RULES.choices.__plain;
  const list = LifeLog.read(S).major_choices;
  check('LL5 중요한 선택 → "중요" 표시가 붙은 것만, 처음 것만 기록한다', a && !b && !c && !d && list.length === 1 && list[0].outcome === 'helped',
    `기록 ${list.map((x) => `${x.id}=${x.outcome}`).join(', ')}`);
})();

// LL6 리아와의 첫 만남 [D5]: 첫 장면에서 한 일이 그대로 기록된다 (다시 만나도 바뀌지 않는다)
__pending.push((async () => {
  const meet = async (script, again) => {
    const S = newGame();
    to(S, 2, 7, 10); Player.teleport(S, 'hollow'); keepAlive(S);
    const r = await Scenes.girl(fakeUi(S, script.slice()));
    if (again) { Player.teleport(S, 'hollow'); Npc.place(S, lia(S), 'hollow'); keepAlive(S); await Scenes.girl(fakeUi(S, again.slice())); }
    const c = S.W.player.life.choices;
    return { r, out: c.map((x) => x.outcome).join(','), n: c.length };
  };
  try {
    const res = {
      passed_by: await meet(['leave']),
      kept_distance: await meet(['wait', 'leave']),
      talked: await meet(['talk', 'leave']),
      helped: await meet(['water', 'leave'], ['threat']),
      threatened: await meet(['threat']),
    };
    const ok = Object.entries(res).every(([k, v]) => v.out === k && v.n === 1);
    check('LL6 리아와의 첫 만남 → 지나침·거리 두기·말 나눔·도움·위협이 그대로 남고, 다시 만나도 바뀌지 않는다', ok,
      Object.entries(res).map(([k, v]) => `${k}→${v.out || '없음'}`).join(' / '));
  } catch (e) {
    check('LL6 리아와의 첫 만남 → 지나침·거리 두기·말 나눔·도움·위협이 그대로 남고, 다시 만나도 바뀌지 않는다', false, String(e && e.stack || e));
  }
})());

// LL7 장면 우선순위 표: 기존 순서 그대로이고, 예약된 이야기 장면이 먼저 다가오는 사람보다 앞선다
(() => {
  const S = newGame();
  to(S, 2, 10); Player.teleport(S, 'village_gate'); keepAlive(S);
  S.W.worldFlags.pending.push('call');
  const ids = SceneOrder.TABLE.map((r) => r.id).join(',');
  const cand = SceneOrder.candidates(S).map((c) => c.id).join(',');
  const first = SceneOrder.next(S), second = SceneOrder.next(S);
  check('LL7 장면 우선순위 표 → 예전 엔진 순서 그대로, 예약된 이야기 → 먼저 다가오는 사람', ids === 'scheduled,girl,arrival,approach,beast,light,teaser,incident'
    && cand === 'scheduled,approach' && first === 'call' && second === 'meet:gatekeeper',
    `표 ${ids} / 지금 맞는 줄 ${cand} / 차례로 ${first} → ${second}`);
})();
