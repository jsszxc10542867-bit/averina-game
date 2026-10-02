// 삶의 기록 — 지시문 4의 23절 "플레이어의 삶을 하나의 스토리 변수로". 흩어진 기록을 한곳에서 읽는다: LifeLog.read(S).
// 새로 쌓는 것 (W.player.life): 돈의 흐름, 활동, 장소 방문, 일, 거처 이력, 지역 이동, 중요한 선택.
// 이미 있는 곳에서 읽어 오는 것: 지식(P), 관계(Rel·NPC 기억), 평판(플레이어에 관한 소문), 지금 거처, 직업 경향.
// 수치는 사건 조건과 엔딩 판정용이다. 플레이어에게 숫자로 보여 주지 않는다.
const LifeLog = (() => {
  const LEDGER_MAX = 300;
  const create = () => ({ activity: {}, work: {}, ledger: [], sums: {}, places: {}, lodgings: [], nights: {}, trips: [], choices: [] });
  const life = (S) => S.W.player.life || (S.W.player.life = create());

  // ---------- 쌓기 ----------
  // 활동. kind: explore(살펴보기·듣기) | work | trade | talk | help | fight | rest | travel
  function act(S, kind, o = {}) {
    const a = life(S).activity;
    const x = a[kind] || (a[kind] = { count: 0, min: 0, first: S.W.time.t, last: null });
    x.count++;
    x.min += o.min || 0;
    x.last = S.W.time.t;
  }

  // 돈의 흐름. amount: 들어오면 +, 나가면 -. kind: wage | buy | sell | rent
  function money(S, amount, kind, o = {}) {
    if (!amount) return;
    const L = life(S);
    L.ledger.push({ t: S.W.time.t, amount, kind, with: o.with || null, item: o.item || null });
    if (L.ledger.length > LEDGER_MAX) L.ledger.shift();
    const s = L.sums[kind] || (L.sums[kind] = { in: 0, out: 0, count: 0 });
    if (amount > 0) s.in += amount; else s.out -= amount;
    s.count++;
  }

  // 한 일 (품삯 일, 잠자리 값으로 한 일)
  function worked(S, job, giver, min) {
    const w = life(S).work;
    const x = w[job] || (w[job] = { count: 0, min: 0, giver, first: S.W.time.t, last: null });
    x.count++;
    x.min += min;
    x.last = S.W.time.t;
    act(S, 'work', { min });
  }

  // 중요한 선택 [결정 D5]: RULES.choices에서 important로 표시된 것만 기록한다. 같은 선택은 처음 것만 남는다
  function choose(S, id, outcome, detail) {
    const d = RULES.choices[id];
    if (!d || !d.important || !d.outcomes[outcome]) return false;
    const L = life(S);
    if (L.choices.some((c) => c.id === id)) return false;
    L.choices.push({ id, outcome, t: S.W.time.t, detail: detail || null });
    return true;
  }

  // ---------- 이벤트에서 쌓이는 것 ----------
  Bus.on('PLAYER_MOVED', (S, e) => {
    const L = life(S);
    const p = L.places[e.to] || (L.places[e.to] = { visits: 0, first: S.W.time.t, last: null });
    p.visits++;
    p.last = S.W.time.t;
    act(S, 'travel');
    const a = e.from ? Places.regionOf(e.from) : null, b = Places.regionOf(e.to);
    if (a && b && a !== b) {
      L.trips.push({ from: a, to: b, t: S.W.time.t, with: (S.W.player.companions || []).slice() });
      if (L.trips.length > 200) L.trips.shift();
    }
  });
  Bus.on('PLAYER_WORKED', (S, e) => {
    worked(S, e.job, e.giver, RULES.jobs[e.job] ? RULES.jobs[e.job].min : 0);
    money(S, e.paid, 'wage', { with: e.giver });
  });
  Bus.on('PLAYER_HELPED_NPC', (S) => act(S, 'help'));
  Bus.on('LODGING_CHANGED', (S, e) => {
    const L = life(S);
    L.lodgings.push({ id: e.lodging, via: e.via, t: S.W.time.t });
    if (L.lodgings.length > 100) L.lodgings.shift();
  });
  Bus.on('PLAYER_SLEPT', (S, e) => { const n = life(S).nights; n[e.lodging] = (n[e.lodging] || 0) + 1; });

  // ---------- 읽기 ----------
  // 즐겨 하는 일: 길을 걷는 것(수단)은 빼고, 들인 시간과 횟수로 [임시 규칙 RULES.life]
  function favorite(S) {
    const a = life(S).activity;
    const score = (k) => a[k].min + a[k].count * RULES.life.countWeight;
    const ks = Object.keys(a).filter((k) => k !== 'travel' && a[k].count > 0).sort((x, y) => score(y) - score(x));
    const total = ks.reduce((s, k) => s + a[k].count, 0);
    if (!ks.length || total < RULES.life.minActs) return null;
    return { main: ks[0], second: ks[1] && score(ks[1]) >= score(ks[0]) * RULES.life.mixedRatio ? ks[1] : null };
  }

  // 삶의 방식: 즐겨 하는 일 → 지시문 4의 7~16절 갈래 [임시 규칙]. 일이면 가장 오래 한 경향을 덧붙인다
  function style(S) {
    const f = favorite(S);
    if (!f) return null;
    const T = S.W.player.tendency || {};
    const top = Object.keys(T).sort((a, b) => T[b] - T[a])[0] || null;
    const of = (k) => RULES.life.styles[k] || null;
    return { main: of(f.main), second: f.second ? of(f.second) : null, mixed: !!(f.second && of(f.second) !== of(f.main)), tendency: top };
  }

  // 평판 [결정 D6]: 지역(마을) 단위만. 그 지역에 사는 사람이 나에 대해 들은 소문과 나를 대하는 마음
  function reputation(S) {
    const { W } = S;
    const out = {};
    Object.values(W.npcs).forEach((n) => {
      if (!n.alive || n.role === 'visitor') return; // 방문하는 사람(행상)은 그 지역의 평판에 세지 않는다
      const reg = Places.regionOf(n.location.home);
      const R = out[reg] || (out[reg] = { people: 0, heard: 0, met: 0, rumors: {}, standing: 0 });
      R.people++;
      const about = Object.keys(n.knowledge.rumors).map((id) => W.rumors[id]).filter((r) => r && (r.subject === 'player' || r.target === 'player'));
      about.forEach((r) => { R.rumors[r.type] = (R.rumors[r.type] || 0) + 1; });
      if (about.length) R.heard++;
      if (Memory.has(n, 'player', 'met')) R.met++;
      const rel = Rel.peek(W, n.id, 'player');
      if (rel && (about.length || Memory.has(n, 'player', 'met'))) R.standing += (rel.trust + rel.affection + rel.respect - rel.hostility - rel.suspicion - rel.fear) / 3;
    });
    Object.values(out).forEach((R) => {
      const known = Math.max(R.heard, R.met);
      R.standing = known ? Math.round(R.standing / known) : 0;
      R.word = !known ? 'unknown' : R.standing >= RULES.life.goodStanding ? 'good' : R.standing <= RULES.life.badStanding ? 'bad' : 'mixed';
    });
    return out;
  }

  function read(S) {
    const { P, W } = S;
    const me = W.player;
    const L = life(S);
    const met = Object.values(W.npcs).filter((n) => Memory.has(n, 'player', 'met') || P.found.npcs[n.id]);
    return {
      life_style: style(S),
      occupation_history: { jobs: L.work, tendency: Object.assign({}, me.tendency) },
      favorite_activity: favorite(S),
      activity: L.activity,
      exploration_history: Object.entries(P.found.locations).map(([loc, state]) => Object.assign({ loc, state }, L.places[loc] || { visits: 0 })),
      relationship_history: met.map((n) => ({
        id: n.id, alive: n.alive,
        first: P.found.npcs[n.id] ? P.found.npcs[n.id].first : null,
        memories: n.memories.filter((m) => m.subject === 'player').map((m) => ({ type: m.type, t: m.timestamp })),
        now: Object.assign({}, Rel.peek(W, n.id, 'player') || {}),
      })),
      economic_history: { money: me.money, debts: (me.debts || []).slice(), sums: L.sums, ledger: L.ledger },
      reputation: reputation(S),
      knowledge: {
        facts: Object.assign({}, P.knowledge), clues: Object.assign({}, P.clues), threads: Object.assign({}, P.threads),
        words: LangKnowledge.heardWords(S, Lang.AVER).filter((x) => x.confidence >= LangKnowledge.KNOWN).length,
        places: Object.keys(P.found.locations).length,
      },
      major_choices: L.choices.slice(),
      settlement: { now: me.lodging ? me.lodging.id : null, since: me.lodging ? me.lodging.since : null, history: L.lodgings, nights: L.nights },
      travel_history: { trips: L.trips, companions: met.filter((n) => n.memories.some((m) => m.type === 'travelled_with' && m.subject === 'player')).map((n) => n.id) },
    };
  }

  return { create, act, money, worked, choose, favorite, style, reputation, read };
})();

if (typeof module !== 'undefined') module.exports = { LifeLog };
