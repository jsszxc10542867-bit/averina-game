// 단서 — 스토리_재설계.md 7절. 어떤 활동에서든 단서 조각이 쌓인다 (알아낸 사실, 엿들은 소문).
// 같은 갈래(thread)의 단서가 정해진 수만큼 모이면 그 갈래가 "열린다". 열린 뒤 무슨 사건이 이어지는지는 스토리가 정한다
// (지금은 수첩에 기록하고 W.worldFlags.threads에 표시만 한다). 단서 목록과 갈래는 RULES.clues / RULES.threads [임시].
const Clues = (() => {
  function gain(S, id, from) {
    const { P, W } = S;
    const c = RULES.clues[id];
    if (!c || P.clues[id]) return false;
    P.clues[id] = { t: W.time.t, from };
    Bus.emit(S, 'CLUE_FOUND', { clueId: id, thread: c.thread, from });
    check(S, c.thread);
    return true;
  }

  function check(S, thread) {
    const { P, W } = S;
    const T = RULES.threads[thread];
    if (!T || P.threads[thread]) return;
    const n = Object.keys(P.clues).filter((id) => RULES.clues[id] && RULES.clues[id].thread === thread).length;
    if (n < T.need) return;
    P.threads[thread] = W.time.t;
    W.worldFlags.threads = W.worldFlags.threads || {};
    W.worldFlags.threads[thread] = W.time.t;
    W.worldFlags.notes.push({ t: `……${T.ko}.`, cls: 'know' });
    Bus.emit(S, 'THREAD_OPENED', { thread });
  }

  // 알아낸 사실에서
  function onFact(S, fact) {
    Object.entries(RULES.clues).forEach(([id, c]) => { if (c.from.fact && c.from.fact.includes(fact)) gain(S, id, 'fact:' + fact); });
  }
  // 엿들은 소문에서
  function onRumor(S, type) {
    Object.entries(RULES.clues).forEach(([id, c]) => { if (c.from.rumor && c.from.rumor.includes(type)) gain(S, id, 'rumor:' + type); });
  }

  // 수첩: 마음에 걸리는 것
  function lines(S) {
    const { P } = S;
    const ids = Object.keys(P.clues).filter((id) => RULES.clues[id]);
    if (!ids.length) return [];
    return ['', '마음에 걸리는 것', ...ids.map((id) => ({ t: '· ' + RULES.clues[id].text, cls: 'note' })),
      ...Object.keys(P.threads).map((t) => ({ t: `— ${RULES.threads[t].ko}`, cls: 'know' }))];
  }

  return { gain, check, onFact, onRumor, lines };
})();

if (typeof module !== 'undefined') module.exports = { Clues };
