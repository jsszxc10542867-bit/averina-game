// 서술 (통합 명세 12·35절). 시스템의 수치를 문장으로 바꾼다. 숫자는 절대 보여 주지 않는다.
// feed: 플레이어 곁에서 벌어진 일. 행동이 끝난 뒤 화면에 덧붙는다 (W.worldFlags.feed).
const Narrative = (() => {
  const J = (w, t) => w + Text.josa(w, t);
  const feed = (S, line) => { if (!S.W.worldFlags.end) S.W.worldFlags.feed.push(line); };

  // 플레이어가 그 사람을 부르는 말. 이름을 알면 이름, 모르면 겉모습. 리아는 장면과 같이 '그녀'로 부른다.
  function who(S, n, first) {
    if (n.id === 'lia') return '그녀';
    const known = S.P.found.npcs[n.id];
    if (known && known.name) return known.name;
    const d = n.identity.desc;
    return first ? d : d.split(' ').pop();
  }

  function feedArrive(S, n) {
    const { W } = S;
    const seen = !!S.P.found.npcs[n.id];
    if (Time.dark(W.time.t)) feed(S, '어둠 속에서 발소리가 다가온다.');
    else feed(S, `${J(who(S, n, !seen), '이가')} 나무 사이에서 모습을 드러낸다.`);
  }

  function feedLeave(S, n) {
    feed(S, Time.dark(S.W.time.t) ? '발소리가 멀어진다.' : `${J(who(S, n), '이가')} 자리를 뜬다.`);
  }

  // NPC가 스스로 하는 일 가운데 눈에 띄는 것만 (같은 일을 한 시간 안에 되풀이해서 적지 않는다)
  const ACT_LINE = {
    eat: (w) => `${J(w, '이가')} 품에서 무언가를 꺼내 씹는다.`,
    drink: (w) => `${J(w, '이가')} 몸을 숙여 물을 마신다.`,
    sleep: (w) => `${J(w, '이가')} 눈을 감는다. 숨소리가 길어진다.`,
    pray: (w) => `${J(w, '이가')} 무릎을 꿇고 무언가를 낮게 중얼거린다.`,
    gather: (w) => `${J(w, '이가')} 허리를 굽혀 풀을 뜯는다.`,
    hide: (w) => `${J(w, '이가')} 몸을 한껏 낮춘다.`,
    flee: (w) => `${J(w, '이가')} 뒷걸음질 치더니, 몸을 돌려 달아난다.`,
    fight: (w) => `${J(w, '이가')} 무기를 고쳐 쥔다.`,
  };
  function feedAction(S, n, type) {
    const { W } = S;
    if (type === 'search') { searchCall(S, n); return; }
    const f = ACT_LINE[type];
    if (!f) return;
    const last = n.flags.narr;
    if (last && last.type === type && W.time.t - last.t < 60) return;
    n.flags.narr = { type, t: W.time.t };
    feed(S, f(who(S, n)));
  }

  // 수색하는 사람은 이름을 부른다
  function searchCall(S, n) {
    const g = Goals.get(n, 'search');
    const tgt = g && S.W.npcs[g.target];
    if (!tgt) return;
    const last = n.flags.narr;
    if (last && last.type === 'search' && S.W.time.t - last.t < 60) return;
    n.flags.narr = { type: 'search', t: S.W.time.t };
    const r = Dialogue.process(S, { speakerId: n.id, listenerId: 'player', dialogueId: 'call_name', vars: { target: tgt.identity.name } });
    feed(S, r.displayText);
    if (r.tone && !r.fullyUnderstood) feed(S, r.tone);
  }

  // 두 사람이 이야기를 나눈다. 곁에 있으면 들린다 (알아듣는 만큼만).
  function feedTalk(S, a, b, told) {
    if (!Npc.present(S.W, a)) return;
    feed(S, `${J(who(S, a), '과와')} ${J(who(S, b), '이가')} 낮은 목소리로 이야기를 나눈다.`);
    if (!told) return;
    const text = Rumor.speech(S.W, told.rumor, told.level);
    if (!text) return;
    const r = Dialogue.process(S, { speakerId: a.id, listenerId: 'player', text });
    feed(S, r.displayText);
    Knowledge.rumor(S, told.rumor.id, told.level);
  }

  function feedHelpPlayer(S, n, item) {
    feed(S, `${J(who(S, n), '이가')} ${item ? '천 조각을 꺼내' : '손을 얹어'} 내 상처를 감싸 준다.`);
  }

  // 관계가 행동으로 드러난다 (12절). 가장 강한 감정 두 가지만.
  function describe(S, n) {
    const r = Rel.peek(S.W, n.id, 'player');
    if (!r) return [];
    const w = who(S, n);
    const armed = Object.keys(n.inventory).some((k) => ITEM_DEFS[k] && ITEM_DEFS[k].category === 'weapon');
    const pool = [
      [r.hostility, 50, `${w}의 눈에 적의가 서려 있다.`],
      [r.fear, 50, `${J(w, '은는')} 거리를 둔 채, 언제든 달아날 수 있게 몸을 비스듬히 하고 있다.`],
      [r.suspicion, 60, armed ? `${J(w, '은는')} 나에게서 눈을 떼지 않는다. 무기를 쥔 손에 힘이 들어가 있다.` : `${J(w, '은는')} 나에게서 눈을 떼지 않는다.`],
      [r.trust, 60, `${J(w, '은는')} 경계를 풀고 가까이 와 있다.`],
      [r.trust, 40, `${J(w, '이가')} 먼저 눈을 맞춘다.`],
      [r.gratitude, 20, `나를 보는 ${w}의 눈이 조금 부드럽다.`],
    ].filter(([v, th]) => v >= th).sort((x, y) => (y[0] - y[1]) - (x[0] - x[1]));
    const out = [];
    const used = new Set();
    for (const [, , line] of pool) { if (!used.has(line.slice(0, 6))) { out.push(line); used.add(line.slice(0, 6)); } if (out.length >= 2) break; }
    return out;
  }

  // 플레이어가 보지 못한 사이에 남은 흔적 (장면 글이 이미 다루는 흔적은 quiet)
  const TRACE_LINE = {
    footprints: '여러 사람의 발자국이 어지럽게 찍혀 있다. 내 것이 아니다.',
    blood: '풀잎에 검붉은 얼룩이 튀어 있다.',
    struggle: '풀이 넓게 짓이겨져 있다. 무언가 뒤엉켜 싸운 자리다.',
    body: '풀숲 사이에 사람의 형체가 쓰러져 있다. ……움직이지 않는다.',
  };
  function traceLines(S, loc) {
    const seen = new Set();
    const out = [];
    Places.traces(S.W, loc).forEach((x) => {
      if (x.quiet || seen.has(x.kind) || !TRACE_LINE[x.kind]) return;
      seen.add(x.kind);
      out.push(TRACE_LINE[x.kind]);
    });
    return out;
  }

  return { who, feedArrive, feedLeave, feedAction, feedTalk, feedHelpPlayer, describe, traceLines };
})();

if (typeof module !== 'undefined') module.exports = { Narrative };
