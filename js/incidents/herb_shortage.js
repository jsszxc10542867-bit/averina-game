// 첫 지역 사건 「약재 부족」 (herb_shortage) — 시작마을.md 8절. 공통 사건 상태(sim/incidents.js)의 첫 사례.
// 결정: D8 첫 지역 사건 · D9 노파의 상처 · D13 노파는 managed → unsteady → bedridden, 병상이 끝이고 죽음 없음, 회복 가능
//       D14 방치하면 리아가 위험한 곳까지 원정 채집 — 다칠 수 있어도 죽지 않는다 (파생 사건의 내용은 [미확정], 범위와 일정까지만)
//       D15 해결 방식 7가지. 수치·일수는 RULES.herbShortage [임시], 화면 문장은 [임시]
// 세계 값: herb_supply = 약초집 비축(노파 + 리아) + 시장의 약초 / forest_danger = W.regions.forest.threat
//          tutor_state = 노파의 상처 단계(npc/condition.js) / lia_range = W.npcs.lia.flags.range (near · edge · inner → 일정)
const HerbShortage = (() => {
  const ID = 'herb_shortage';
  const R = () => RULES.herbShortage;
  const J = (w, t) => w + Text.josa(w, t);
  const K = (t) => ({ t, cls: 'know' });
  const day = (W) => Time.day(W.time.t);
  const tutor = (W) => W.npcs.herbalist;
  const lia = (W) => W.npcs.lia;
  const alive = (n) => !!(n && n.alive);
  const sum = (o) => Object.values(o || {}).reduce((a, b) => a + b, 0);
  const STARTABLE = ['DISCOVERED', 'IGNORED', 'FAILED', 'ESCALATED'];

  // ---------- 세계 값 ----------
  function supply(W) {
    const m = W.economy.markets.village_square;
    const stock = (alive(tutor(W)) ? tutor(W).inventory.herb || 0 : 0) + (alive(lia(W)) ? lia(W).inventory.herb || 0 : 0);
    return Math.min(100, stock * R().perHerb + ((m && m.stock.herb) || 0) * R().perMarketHerb);
  }
  const danger = (W) => W.regions.forest.threat;

  // 리아의 채집 범위 → 일정. 안쪽(원정)에서는 다칠 수 있어도 죽지 않는다 [D14]
  function applyRange(l) {
    const range = l.flags.range || 'edge';
    l.schedule = JSON.parse(JSON.stringify(SCHEDULES[R().liaSchedule[range]]));
    if (range === 'inner') l.flags.noDeath = true;
    else delete l.flags.noDeath;
  }
  function setRange(S, range) {
    const l = lia(S.W);
    if (!alive(l) || (l.flags.range || 'edge') === range) return;
    l.flags.range = range;
    applyRange(l);
    Behavior.interrupt(l);
  }

  // 리아와의 첫 만남에서 위협하거나 공격했다면 리아를 거치는 길은 닫힌다 (8-10절)
  const liaClosed = (W) => (W.player.life.choices || []).some((c) => c.id === 'lia_first_meeting' && ['threatened', 'attacked'].includes(c.outcome));

  // ---------- 상태가 바뀔 때 ----------
  const RESPONSE = { by_gather: 'gather', by_lia: 'with_lia', by_buy: 'buy', by_ask: 'ask', by_order: 'request', by_guild: 'request', by_learn: 'learn' };

  function open(S, st) {
    Object.assign(st.data, { deadline: day(S.W) + R().deadlineDays, needed: R().needed, contrib: {}, held: {}, asked: {}, orders: [], guild: null, failures: [], learned: false, after: 0 });
    Incidents.set(S, ID, 'AVAILABLE', 'supply');
    setRange(S, 'near');
    // 노파가 약초가 모자라다고 말하기 시작한다 (플레이어에게는 알리지 않는다. 마을에 소문으로 퍼진다)
    if (alive(tutor(S.W))) Rumor.create(S, ['herbalist'], { type: 'herb_scarce', place: 'village_herbhouse', importance: 35 });
  }

  // 해결 방식을 시작한다 → IN_PROGRESS. 처음 대한 방식은 중요한 선택으로 남는다 [D5]
  function start(S, st, method) {
    const W = S.W;
    if (st.state === 'IN_PROGRESS') { LifeLog.choose(S, 'herb_shortage_response', RESPONSE[method]); return true; }
    if (!STARTABLE.includes(st.state) || !Incidents.known(st)) return false;
    const from = st.state;
    // 악화된 뒤에 시작하면 더 많이 필요하다 (8-4절)
    if (from === 'ESCALATED') st.data.needed = Math.ceil(st.data.needed * (1 + (R().escalatedExtra[Condition.stageOf(tutor(W))] || 0)));
    // 외면했다가 다시 도우면 관계가 조금 돌아온다. 악화 단계는 그대로 둔다
    if (from === 'IGNORED') ['lia', 'herbalist'].forEach((id) => { if (alive(W.npcs[id])) Rel.change(S, id, 'player', { trust: 3 }, 'came_back', true); });
    st.data.contrib = {};
    Incidents.set(S, ID, 'IN_PROGRESS', method);
    LifeLog.choose(S, 'herb_shortage_response', RESPONSE[method]);
    return true;
  }

  // 시도했지만 아무것도 얻지 못했다 (짐승에 쫓김 / 돈이 모자람 / 부탁이 거절됨)
  function attemptFailed(S, st, reason) {
    st.data.failures.push(reason);
    if (STARTABLE.includes(st.state) && Incidents.known(st)) {
      Incidents.set(S, ID, 'IN_PROGRESS', 'tried:' + reason);
      st.data.contrib = st.data.contrib || {};
    }
    LifeLog.choose(S, 'herb_shortage_response', 'failed');
  }

  // 약재를 보탠다. 사건이 끝난 뒤(EXPIRED)에는 마을의 상시 상태를 조금씩 고친다
  function contribute(S, st, method, n) {
    if (n <= 0) return;
    const W = S.W;
    if (st.state === 'EXPIRED') {
      st.data.after += n;
      if (st.data.after >= st.data.needed) { st.data.after = 0; Condition.shift(S, tutor(W), -1); }
      return;
    }
    if (st.state === 'RESOLVED' || st.state === 'LOCKED') return;
    if (st.state !== 'IN_PROGRESS' && !start(S, st, method)) return;
    st.data.contrib[method] = (st.data.contrib[method] || 0) + n;
    if (sum(st.data.contrib) >= st.data.needed && day(W) <= st.data.deadline) resolve(S, st);
  }

  function resolve(S, st) {
    const W = S.W;
    const by = Object.entries(st.data.contrib).filter(([, n]) => n > 0).sort((a, b) => b[1] - a[1]).map(([m]) => m);
    st.resolvedBy = by;
    Incidents.set(S, ID, 'RESOLVED', by.join('+'));
    Condition.shift(S, tutor(W), -1); // 한 단계 돌아온다. 병상이었다면 다음 날 또 한 단계 (daily)
    st.data.recoveredAt = W.time.t;
    setRange(S, danger(W) >= R().dangerNear ? 'near' : 'edge');
    W.worldFlags.herbScarce = false;
    traces(S, by[0]);
    if (R().helpedRumor.includes(by[0])) {
      const holders = ['herbalist', 'lia'].filter((id) => alive(W.npcs[id]));
      if (holders.length) Rumor.create(S, holders, { type: 'herb_helped', subject: 'player', target: 'herbalist', importance: 55 });
    }
    W.worldFlags.feed.push('', '약초집의 약초 통이 다시 채워져 간다.', K('……노파의 숨이 조금 편해진 것 같다.'));
  }

  // 해결 방식별 흔적 (8-9절)
  function traces(S, method) {
    const W = S.W;
    const rel = (id, d) => { if (alive(W.npcs[id])) Rel.change(S, id, 'player', d, 'herb:' + method); };
    if (method === 'by_gather') { rel('herbalist', { trust: 10, respect: 6 }); rel('lia', { trust: 6, respect: 4 }); }
    else if (method === 'by_lia') { rel('lia', { trust: 12, affection: 6, familiarity: 8 }); rel('herbalist', { trust: 6 }); }
    else if (method === 'by_buy') { rel('herbalist', { trust: 4 }); rel('lia', { trust: 2 }); rel('merchant', { trust: 5, familiarity: 4 }); }
    else if (method === 'by_ask') Object.keys(W.events.states[ID].data.asked).forEach((id) => rel(id, { trust: 4, familiarity: 4 }));
    else if (method === 'by_order') rel('peddler', { trust: 8, familiarity: 6 });
    else if (method === 'by_learn') { rel('herbalist', { trust: 14, respect: 10, affection: 4 }); rel('lia', { respect: 6 }); }
  }

  function fail(S, st, reason) {
    const W = S.W;
    st.data.failedBy = reason;
    // 기한 안에 오지 못한 주문: 치른 돈의 절반을 돌려받는다
    st.data.orders.filter((o) => !o.done).forEach((o) => { o.done = true; W.player.money += Math.floor(o.paid / 2); LifeLog.money(S, Math.floor(o.paid / 2), 'refund', { with: 'peddler' }); });
    Incidents.set(S, ID, 'FAILED', reason);
    LifeLog.choose(S, 'herb_shortage_response', 'failed');
  }

  function ignore(S, st, why, byId) {
    const W = S.W;
    Incidents.set(S, ID, 'IGNORED', why);
    if (byId && alive(W.npcs[byId])) Rel.change(S, byId, 'player', { trust: -4, affection: -2 }, 'let_down');
    setRange(S, 'inner'); // 리아가 혼자 더 먼 곳으로 채집을 나간다
    LifeLog.choose(S, 'herb_shortage_response', 'ignored');
  }

  function escalate(S, st) {
    const W = S.W;
    Incidents.set(S, ID, 'ESCALATED', 'supply');
    Condition.shift(S, tutor(W), 1);
    st.data.worsenedAt = W.time.t;
    setRange(S, 'inner');
    W.worldFlags.herbScarce = true;
    const holders = ['herbalist', 'lia', 'merchant'].filter((id) => alive(W.npcs[id]));
    if (holders.length) Rumor.create(S, holders, { type: 'herb_scarce', place: 'village_herbhouse', importance: 50 });
  }

  function expire(S, st) {
    const W = S.W;
    Incidents.set(S, ID, 'EXPIRED', 'deadline');
    // 그때까지 모자랐다면 약재 부족이 마을의 상시 상태로 굳는다: 값은 높고, 노파는 지금 단계에 머문다.
    // 리아는 가장자리 이하에서만 캔다 (원정은 끝난다)
    W.worldFlags.herbScarce = supply(W) <= R().supplyOpen;
    setRange(S, danger(W) >= R().dangerNear ? 'near' : 'edge');
  }

  // ---------- 하루마다 (새벽 6시) ----------
  function daily(S, st) {
    const W = S.W;
    st.data.supply = supply(W);
    // 사건과 상관없이 세계는 흐른다: 숲이 위험해지면 리아는 가까운 곳에서만 캔다 (공급이 줄어든다)
    if (['LOCKED', 'RESOLVED', 'EXPIRED'].includes(st.state)) setRange(S, danger(W) >= R().dangerNear ? 'near' : 'edge');
    if (st.state === 'LOCKED') {
      const arr = Incidents.arrivalDay(W);
      if (arr != null && day(W) >= arr + R().openAfter && danger(W) >= R().dangerOpen && st.data.supply <= R().supplyOpen && Incidents.canOpen(S, ID)) open(S, st);
      return;
    }
    if (st.state === 'RESOLVED') {
      if (Condition.stageOf(tutor(W)) !== 'managed' && day(W) > Time.day(st.data.recoveredAt)) { Condition.shift(S, tutor(W), -1); st.data.recoveredAt = W.time.t; }
      return;
    }
    if (st.state === 'EXPIRED') return;
    if (day(W) > st.data.deadline) {
      if (st.state === 'IN_PROGRESS') fail(S, st, st.data.failures.slice(-1)[0] || 'deadline');
      else expire(S, st);
      return;
    }
    if (st.state === 'DISCOVERED' && Incidents.daysIn(W, st) >= R().ignoreAfter) ignore(S, st, 'silence');
    if (['IGNORED', 'AVAILABLE', 'DISCOVERED'].includes(st.state) && st.data.supply <= R().supplyEscalate && Incidents.daysIn(W, st) >= R().escalateAfter) escalate(S, st);
    // 악화된 뒤에도 약재가 모자란 채면 사흘마다 한 단계씩 나빠진다 (병상에서 멈춘다 [D13]).
    // 리아의 원정으로 공급이 돌아와 있으면 더 나빠지지 않는다 [임시 판단]
    else if (st.state === 'ESCALATED' && day(W) - Time.day(st.data.worsenedAt) >= R().worsenEvery && st.data.supply <= R().supplyOpen
      && Condition.shift(S, tutor(W), 1)) st.data.worsenedAt = W.time.t;
  }

  // ---------- 매시간: 도착하는 약재, 플레이어가 알게 되는 길 ----------
  function hourly(S, st) {
    const W = S.W;
    if (st.state === 'LOCKED') return;
    arrivals(S, st);
    if (Incidents.known(st) || Incidents.done(st)) return;
    const me = W.player, here = me.loc, h = Time.hour(W.time.t);
    const T = tutor(W), L = lia(W);
    const atHerb = here === 'village_herbhouse';
    if (atHerb && Npc.present(W, T) && (Player.bleeding(W) || me.surv.injuries.length)) return discover(S, 'via_injury');
    if (atHerb && Npc.present(W, T) && Rel.get(W, 'herbalist', 'player').trust >= 30) return discover(S, 'via_tutor');
    if ((atHerb || here === 'edge') && Npc.present(W, L) && Rel.get(W, 'lia', 'player').trust >= 40 && !liaClosed(W)) return discover(S, 'via_lia');
    const gathering = (here === 'village_square' && h >= 18 && h < 20) || here === 'village_inn';
    if (gathering && heardScarce(W) >= 2) return discover(S, 'via_rumor');
    return null;
  }
  // 약재가 모자라다는 소문을 아는 마을 사람 수
  const heardScarce = (W) => Object.values(W.npcs).filter((n) => n.alive && n.role !== 'visitor'
    && Object.keys(n.knowledge.rumors).some((id) => W.rumors[id] && W.rumors[id].type === 'herb_scarce')).length;

  const FOUND = {
    via_lia: ['리아가 바구니 속 약초를 세고 또 센다. 한 줄기도 허투루 쓰지 않으려는 손길이다.'],
    via_tutor: ['노파가 약초 통 뚜껑을 열었다가 닫는다. 통 바닥이 보인다.'],
    via_rumor: ['사람들 사이에서 같은 이야기가 오가는 것 같다. 다들 약초집 쪽을 흘끔거린다.'],
    via_witness: ['늘 풀이 우거졌을 자리가 듬성듬성 비어 있다.', '흙 위에 큰 짐승의 발자국이 찍혀 있다.'],
    via_market: ['천막 가게의 약초 칸이 거의 비어 있다. 상인이 빈 칸을 가리키며 고개를 젓는다.'],
    via_work: ['일하는 내내, 다들 약초를 아끼는 손길이 눈에 들어온다.'],
    via_injury: ['노파가 내 상처를 보더니 약초 통을 뒤적인다. 남은 것이 거의 없다.'],
  };
  function discover(S, via) {
    const ok = Incidents.discover(S, ID, via, ['', ...FOUND[via], K('……이 마을은 약초가 모자란다.')]);
    if (ok) {
      if (!S.P.knowledge.herb_short) S.P.knowledge.herb_short = S.W.time.t;
      Clues.gain(S, 'herb_short', 'incident:' + ID);
    }
    return ok;
  }

  // 부탁한 사람·행상·길드가 가져온 약재가 약초집에 닿는다
  function arrivals(S, st) {
    const W = S.W;
    const T = tutor(W);
    const bring = (method, n) => { if (alive(T)) T.inventory.herb = (T.inventory.herb || 0) + n; contribute(S, st, method, n); };
    Object.entries(st.data.asked || {}).forEach(([id, a]) => {
      if (a.done || W.time.t < a.at) return;
      a.done = true;
      if (alive(W.npcs[id])) bring('by_ask', a.herbs);
    });
    if (st.data.guild && !st.data.guild.done && W.time.t >= st.data.guild.at) { st.data.guild.done = true; bring('by_guild', st.data.guild.herbs); }
  }
  // 행상이 다음에 마을에 올 때 주문한 약재를 가져온다
  Bus.on('NPC_MOVED', (S, e) => {
    if (e.npcId !== 'peddler' || e.to !== 'village_square') return;
    const st = S.W.events.states && S.W.events.states[ID];
    if (!st || !st.data.orders) return;
    st.data.orders.filter((o) => !o.done && S.W.time.t - o.t >= 360).forEach((o) => {
      o.done = true;
      const T = tutor(S.W);
      if (alive(T)) T.inventory.herb = (T.inventory.herb || 0) + o.herbs;
      contribute(S, st, 'by_order', o.herbs);
    });
  });

  // ---------- 다른 시스템에서 알려 오는 것 ----------
  function notice(S, st, kind, data) {
    if (st.state === 'LOCKED' || Incidents.done(st)) return;
    if (kind === 'market') {
      // 알고서 약초를 사면 "사서 구하기"를 시작한 것이다 (약초집에 건넬 때 쌓인다)
      if (data.item === 'herb' && data.bought) { st.data.held.by_buy = (st.data.held.by_buy || 0) + 1; if (Incidents.known(st)) start(S, st, 'by_buy'); }
      if (data.item === 'herb' && data.noMoney && Incidents.known(st)) attemptFailed(S, st, 'no_money');
      if (!Incidents.known(st)) discover(S, 'via_market');
    }
    if (kind === 'work' && ['village_herbhouse', 'village_field', 'village_inn'].includes(data.at) && !Incidents.known(st)) discover(S, 'via_work');
    if (kind === 'rumor' && data.type === 'herb_scarce' && data.understanding >= 0.5 && !Incidents.known(st)) discover(S, 'via_rumor');
  }
  Bus.on('PLAYER_WORKED', (S, e) => Incidents.notice(S, 'work', { job: e.job, at: RULES.jobs[e.job] ? RULES.jobs[e.job].at : null }));

  // 채집지·밭 가장자리를 살펴본다 (장소 행동, village.js) — 약재가 모자란 흔적을 직접 본다
  function look(S, where) {
    const st = Incidents.get(S.W, ID);
    const base = where === 'edge'
      ? ['풀숲을 헤치며 채집지를 살펴본다.']
      : ['밭 가장자리 풀숲을 살펴본다.'];
    if (st.state === 'LOCKED' || Incidents.done(st)) return [...base, where === 'edge' ? '쓴 냄새가 나는 풀이 군데군데 자라 있다.' : '이랑 사이에 잡초가 듬성하다.'];
    if (!Incidents.known(st)) { discover(S, 'via_witness'); return base; }
    return [...base, '풀이 뜯겨 나간 자리가 여전하다.'];
  }

  // ---------- 선택지 (해결 방식) ----------
  function options(S, st, pass) {
    const W = S.W;
    const me = W.player;
    if (!Incidents.known(st) || st.state === 'RESOLVED') return [];
    const opts = [];
    const T = tutor(W), L = lia(W);
    const here = me.loc;
    const live = !Incidents.done(st);
    const add = (label, run, hint) => opts.push({ label, hint: hint || null, life: true, run });

    // 직접 채집 (혼자, 숲 가장자리)
    if (live && here === 'edge' && !Time.dark(W.time.t) && !Player.bleeding(W) && me.surv.fatigue < 85) add('약초를 찾아 풀숲을 뒤진다', () => gather(S, st, pass));
    // 리아와 함께 채집
    if (live && Npc.present(W, L) && L.currentAction && L.currentAction.type === 'gather' && !liaClosed(W)
      && Rel.get(W, 'lia', 'player').trust >= R().withLia.minTrust) add('리아의 채집을 거든다', () => withLia(S, st, pass));
    // 약초를 약초집에 건넨다 (산 것·캔 것)
    if (here === 'village_herbhouse' && (me.inv.herb || 0) > 0 && (Npc.present(W, T) || Npc.present(W, L))) add('약초를 약초집에 건넨다', () => deliver(S, st, pass));
    // 다른 사람에게 부탁한다
    if (live) R().ask.targets.forEach((id) => {
      const n = W.npcs[id];
      if (!Npc.present(W, n) || st.data.asked[id] || !Memory.has(n, 'player', 'met')) return;
      add(`${Narrative.who(S, n)}에게 약초를 구해 달라고 부탁한다`, () => ask(S, st, n, pass));
    });
    // 행상에게 주문한다
    const P_ = W.npcs.peddler;
    if (live && Npc.present(W, P_) && Places.regionOf(here) === 'village') add('행상에게 약초를 주문한다', () => order(S, st, pass), `동전 ${R().order.price}닢`);
    // 길드 연락소에 의뢰한다 (연락소가 열린 뒤)
    if (live && here === 'village_guild' && W.worldFlags.guildOpen && !st.data.guild) add('약초 채집 의뢰를 맡긴다', () => guild(S, st, pass), `동전 ${R().guild.fee}닢`);
    // 약재를 덜 쓰는 법을 배운다
    if (live && here === 'village_herbhouse' && Npc.present(W, T) && !st.data.learned && S.P.knowledge.herb_heals
      && Rel.get(W, 'herbalist', 'player').trust >= R().learn.minTrust) add('약초를 아껴 쓰는 법을 배운다', () => learn(S, st, pass));
    // 도와 달라는 눈치를 모른 척한다 (명시적으로 외면)
    if (st.state === 'DISCOVERED' && here === 'village_herbhouse' && (Npc.present(W, T) || Npc.present(W, L))) {
      add('도와 달라는 눈치를 모른 척한다', () => {
        ignore(S, st, 'refused', Npc.present(W, L) ? 'lia' : 'herbalist');
        return ['눈을 피한다. 약초 통 쪽은 보지 않는다.', '방 안에 짧은 침묵이 흐른다.', ...pass(5)];
      });
    }
    return opts;
  }

  function gather(S, st, pass) {
    const W = S.W;
    LifeLog.act(S, 'explore', { min: R().gather.min });
    const lines = ['허리를 굽혀 풀숲을 헤친다. 쓴 냄새를 따라간다.', ...pass(R().gather.min, { work: 0.3 })];
    // 숲이 위험할수록 짐승과 마주칠 수 있다
    if (Rng.chance(W, danger(W) * R().gather.chase)) {
      Player.hurt(S, 2, '채집하다 짐승에게 쫓겼다', 'beast');
      if (!S.P.knowledge.edge_beasts) S.P.knowledge.edge_beasts = W.time.t;
      attemptFailed(S, st, 'chased');
      return [...lines, '', '덤불 너머에서 낮은 숨소리가 들린다.', '돌아볼 새도 없이 뛴다. 가시덤불에 팔이 긁힌다.', '', '……빈손이다.'];
    }
    const n = R().gather.base + (S.P.knowledge.herb_heals ? R().gather.knowBonus : 0) + (Rng.chance(W, 0.5) ? 1 : 0);
    for (let i = 0; i < n; i++) Player.give(W.player, 'herb');
    st.data.held.by_gather = (st.data.held.by_gather || 0) + n;
    start(S, st, 'by_gather');
    return [...lines, '', `쓴 냄새가 나는 풀을 ${n}줌 모았다.`];
  }

  function withLia(S, st, pass) {
    const W = S.W;
    const L = lia(W);
    const n = R().withLia.herbs + (S.P.knowledge.herb_heals ? 1 : 0);
    LifeLog.act(S, 'help', { min: R().withLia.min });
    const lines = ['리아 곁에 쪼그려 앉는다. 그녀가 어떤 풀을 뜯는지 보고 따라 한다.', '그녀가 가끔 손을 뻗어 내 손의 풀을 골라낸다.',
      ...pass(R().withLia.min, { work: 0.3 })];
    L.inventory.herb = (L.inventory.herb || 0) + n;
    Memory.add(S, L, { type: 'worked_with', subject: 'player', detail: 'gather' });
    Rel.change(S, 'lia', 'player', { trust: 3, familiarity: 4 }, 'gathered_together', true);
    contribute(S, st, 'by_lia', n);
    return [...lines, '', '바구니가 제법 무거워졌다. 리아가 짧게 고개를 끄덕인다.'];
  }

  function deliver(S, st, pass) {
    const W = S.W;
    const me = W.player;
    const T = tutor(W), L = lia(W);
    const to = Npc.present(W, T) ? T : L;
    const n = me.inv.herb || 0;
    for (let i = 0; i < n; i++) Player.take(me, 'herb');
    to.inventory.herb = (to.inventory.herb || 0) + n;
    LifeLog.act(S, 'help');
    // 어디서 온 약초인가: 산 것, 캔 것 (나머지는 내가 숲에서 가져온 것)
    let left = n;
    ['by_buy', 'by_gather'].forEach((m) => {
      const k = Math.min(left, st.data.held && st.data.held[m] || 0);
      if (!k) return;
      st.data.held[m] -= k;
      left -= k;
      contribute(S, st, m, k);
    });
    if (left) contribute(S, st, 'by_gather', left);
    Rel.change(S, to.id, 'player', { trust: 2, gratitude: 4 }, 'brought_herbs', true);
    const who = Narrative.who(S, to);
    return [`가져온 풀을 ${who}에게 내민다.`, `${J(who, '이가')} 한 줌씩 들어 냄새를 맡아 보고, 약초 통에 옮겨 담는다.`, ...pass(10)];
  }

  function ask(S, st, n, pass) {
    const W = S.W;
    const who = Narrative.who(S, n);
    const lines = ['쓴 풀을 흉내 내어 보이고, 약초집 쪽을 가리킨다.'];
    if (Rel.get(W, n.id, 'player').trust < R().ask.minTrust) {
      Rel.change(S, n.id, 'player', { trust: -1 }, 'asked_too_much', true);
      attemptFailed(S, st, 'refused');
      st.data.asked[n.id] = { refused: true, done: true };
      return [...lines, `${J(who, '은는')} 난처한 얼굴로 고개를 젓는다.`, ...pass(5)];
    }
    st.data.asked[n.id] = { at: W.time.t + R().ask.delayMin, herbs: R().ask.herbs, done: false };
    W.player.debts.push({ npc: n.id, kind: 'herbs', t: W.time.t });
    Memory.add(S, n, { type: 'asked_favor', subject: 'player', detail: 'herbs' });
    start(S, st, 'by_ask');
    return [...lines, `${J(who, '이가')} 잠시 생각하더니, 숲 쪽을 가리키며 고개를 끄덕인다.`, ...pass(10)];
  }

  function order(S, st, pass) {
    const W = S.W;
    const me = W.player;
    const price = R().order.price;
    if (me.money < price) { attemptFailed(S, st, 'no_money'); return ['주머니를 뒤져 본다. 모자라다.', ...pass(5)]; }
    me.money -= price;
    W.npcs.peddler.money += price;
    LifeLog.money(S, -price, 'order', { with: 'peddler', item: 'herb' });
    st.data.orders.push({ t: W.time.t, paid: price, herbs: R().order.herbs, done: false });
    start(S, st, 'by_order');
    return [`동전 ${price}닢을 내밀고, 쓴 풀을 흉내 내어 보인다.`, '행상이 손가락으로 날짜를 세어 보이고, 고개를 끄덕인다.', ...pass(10)];
  }

  function guild(S, st, pass) {
    const W = S.W;
    const me = W.player;
    if (me.money < R().guild.fee) { attemptFailed(S, st, 'no_money'); return ['의뢰비가 모자라다.', ...pass(5)]; }
    me.money -= R().guild.fee;
    LifeLog.money(S, -R().guild.fee, 'order', { with: 'guild', item: 'herb' });
    st.data.guild = { at: W.time.t + R().guild.delayMin, herbs: R().guild.herbs, done: false };
    start(S, st, 'by_guild');
    return ['게시판에 약초 채집 의뢰를 꽂는다.', ...pass(15)];
  }

  function learn(S, st, pass) {
    const W = S.W;
    const before = st.data.needed;
    st.data.needed = Math.ceil(before * R().learn.factor);
    st.data.learned = true;
    if (!S.P.knowledge.herb_thrift) S.P.knowledge.herb_thrift = W.time.t;
    const lines = ['노파 곁에 앉아 손을 지켜본다.', '같은 풀을 반으로 갈라 쓰고, 찌꺼기를 다시 우려낸다.', ...pass(R().learn.min)];
    // 필요량을 낮춘 만큼이 이 방식의 몫이다 (분량 대신 필요량을 줄인다)
    if (!start(S, st, 'by_learn')) return lines;
    st.data.contrib.by_learn = (st.data.contrib.by_learn || 0) + (before - st.data.needed);
    if (sum(st.data.contrib) >= st.data.needed) resolve(S, st);
    return [...lines, K('……약초를 아껴 쓰는 법을 하나 배웠다.')];
  }

  // 저장 파일을 불러온 뒤: 리아의 채집 범위에 맞춰 일정을 다시 둔다
  function restore(W) { if (W.npcs.lia && W.npcs.lia.flags.range) applyRange(W.npcs.lia); }

  Incidents.register(ID, { order: 8, daily, hourly, notice, options, restore });
  return { ID, supply, danger, setRange, look, discover: (S, via) => discover(S, via), contribute: (S, m, n) => contribute(S, Incidents.get(S.W, ID), m, n) };
})();

if (typeof module !== 'undefined') module.exports = { HerbShortage };
