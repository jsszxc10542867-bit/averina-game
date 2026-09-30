// 언어 학습 (언어 시스템 26·27절, 통합 명세 14절). 경험치가 아니라, 무엇을 겪었는지에 따라 단어의 확신이 바뀐다.
// 듣기만 해서는 뜻을 알 수 없다 (확신 0.45에서 멈춘다). 상황과 연결하거나, 배우거나, 써 봐야 한다.
const LangLearning = (() => {
  const round1 = (n) => Math.round(n * 10) / 10;
  // conf: 단어 확신 변화 / cap: 이 방식만으로 오를 수 있는 한계 / und: 이해도(%) / speaking·reading: 말하기·읽기
  const TYPES = {
    heard_word: { conf: 0.05, cap: 0.45, und: 0.05 },
    repeated_word: { conf: 0.1, cap: 0.55, und: 0.3 },
    contextual_guess: { conf: 0.4, cap: 0.7, und: 3 },
    successful_conversation: { conf: 0.15, cap: 1, und: 1, speaking: 2 },
    failed_conversation: { conf: -0.05, cap: 1, und: 0.2, speaking: 0.5 },
    teacher_lesson: { conf: 0.35, cap: 0.8, und: 2 },
    reading: { conf: 0.2, cap: 0.8, und: 1, reading: 2 },
    translation: { conf: 0.3, cap: 0.8, und: 1 },
    magic_translation: { conf: 0, cap: 0, und: 0 },
    exposure: { conf: 0, cap: 0, und: 1 }, // 단어가 아닌 무언가를 느꼈을 때 (정령의 속삭임 등)
  };
  // 이해도 구간 (언어 시스템 4절)
  const BANDS = [0, 10, 30, 50, 70, 90];
  const band = (u) => BANDS.filter((b) => u >= b).pop();

  // ev: { type, language, wordId?, amount?(이해도), confidence?(확신 변화), set?(확신을 적어도 이만큼), source }
  function learn(S, ev) {
    const T = TYPES[ev.type];
    if (!T) throw new Error('알 수 없는 학습 방식: ' + ev.type);
    const L = LANGUAGES[ev.language];
    if (!L) throw new Error('알 수 없는 언어: ' + ev.language);
    const PL = S.P.lang;
    const lk = PL.languageKnowledge[ev.language];
    let newlyKnown = false, rec = null;
    if (ev.wordId) {
      const words = PL.knownWords[ev.language] = PL.knownWords[ev.language] || {};
      rec = words[ev.wordId] = words[ev.wordId] || { confidence: 0, encounters: 0, lastEncounter: null };
      const before = rec.confidence;
      rec.encounters++;
      rec.lastEncounter = S.W.time.t;
      let c = before;
      if (ev.set != null) c = Math.max(c, ev.set);
      else {
        const gain = ev.confidence != null ? ev.confidence : T.conf;
        c = gain >= 0 ? Math.max(c, Math.min(T.cap, c + gain)) : c + gain;
      }
      rec.confidence = Math.round(Math.max(0, Math.min(1, c)) * 100) / 100;
      if (before < LangKnowledge.KNOWN && rec.confidence >= LangKnowledge.KNOWN) {
        newlyKnown = true;
        Bus.emit(S, 'LANGUAGE_WORD_LEARNED', { entityId: 'player', languageId: ev.language, wordId: ev.wordId, confidence: rec.confidence, source: ev.source || null });
      }
    }
    const from = band(lk.understanding);
    let und = (ev.amount != null ? ev.amount : T.und) / L.difficulty;
    if (ev.type === 'heard_word') und *= 1 - lk.understanding / 100;
    lk.understanding = Math.min(100, round1(lk.understanding + und));
    if (T.speaking) lk.speaking = Math.min(100, round1(lk.speaking + T.speaking / L.difficulty));
    if (T.reading) lk.reading = Math.min(100, round1(lk.reading + T.reading / L.difficulty));
    const to = band(lk.understanding);
    if (to !== from) {
      PL.languageMilestones.push({ language: ev.language, band: to, t: S.W.time.t });
      Bus.emit(S, 'LANGUAGE_LEVEL_CHANGED', { entityId: 'player', languageId: ev.language, from, to, understanding: lk.understanding });
    }
    return { newlyKnown, confidence: rec ? rec.confidence : null };
  }

  return { TYPES, BANDS, band, learn };
})();

if (typeof module !== 'undefined') module.exports = { LangLearning };
