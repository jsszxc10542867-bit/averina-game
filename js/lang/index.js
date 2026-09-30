// 언어 시스템 입구 (언어 시스템 16·37·38절). 다른 시스템과 장면은 여기만 부른다.
//   LanguageRegistry     → LangRegistry (lang/registry.js)
//   LanguageKnowledge    → LangKnowledge (lang/knowledge.js)
//   LanguageLearning     → LangLearning (lang/learning.js)
//   LanguageParser       → LangParser (lang/parser.js)
//   TranslationResolver  → LangResolver (lang/resolver.js)
//   DialogueSystem       → Dialogue (lang/dialogue.js)
//   InterpretationSystem → Dialogue.interpret / WritingSystem → Dialogue.read
//   LanguageUI           → LangUI (lang/ui.js) / LanguagePersistence → LangStore (lang/persistence.js)
// 37절의 API는 모두 첫 인자로 게임 상태 S를 받는다.
const Lang = (() => {
  const AVER = 'common_aver';
  const idOf = (surface) => { const w = LangRegistry.wordByForm(surface); return w ? w.id : surface; };

  // ---------- 37절 API ----------
  const getLanguageKnowledge = (S, entityId, languageId) => LangKnowledge.get(S, entityId, languageId);
  const getWordKnowledge = (S, entityId, languageId, wordId) => LangKnowledge.word(S, entityId, languageId, wordId);
  const processDialogue = (S, o) => Dialogue.process(S, o);
  // 부작용 없이 얼마나 알아들을지만 계산한다
  function calculateUnderstanding(S, dialogueId, listenerId = 'player', vars) {
    const d = DIALOGUES[dialogueId];
    return LangResolver.resolve(S, { text: d.text, lang: d.lang, listenerId, vars }).understanding;
  }
  const learnWord = (S, entityId, languageId, wordId, amount) =>
    LangLearning.learn(S, { type: 'contextual_guess', language: languageId, wordId, amount, source: 'learnWord' });
  // context: { wordId | surface, source, confidence }
  const learnFromContext = (S, entityId, languageId, context) =>
    LangLearning.learn(S, { type: 'contextual_guess', language: languageId, wordId: context.wordId || idOf(context.surface),
      confidence: context.confidence, source: context.source || 'context' });
  const canSpeak = (S, entityId, languageId) => LangKnowledge.canSpeak(S, entityId, languageId);
  const canRead = (S, entityId, languageId) => LangKnowledge.canRead(S, entityId, languageId);
  const translateForPlayer = (S, dialogueId, vars) => {
    const d = DIALOGUES[dialogueId];
    return LangResolver.resolve(S, { text: d.text, lang: d.lang, listenerId: 'player', vars }).displayText;
  };

  // ---------- 장면에서 쓰는 것 ----------
  // NPC가 플레이어에게 말한다. 화면에 보일 문장을 돌려준다.
  const speak = (S, text, speakerId) => Dialogue.process(S, { speakerId, listenerId: 'player', text }).displayText;
  // 뜻을 알아냈다 (상황으로 분명히 짐작했다). 새로 알게 되었으면 true
  function learn(S, surface, o = {}) {
    const before = LangKnowledge.word(S, 'player', AVER, idOf(surface)).confidence;
    LangLearning.learn(S, { type: 'contextual_guess', language: AVER, wordId: idOf(surface),
      set: o.set != null ? o.set : 0.7, amount: o.amount != null ? o.amount : 5, source: o.source || 'scene' });
    return before < LangKnowledge.KNOWN;
  }
  // 뜻을 어렴풋이 짐작했다 (틀릴 수도 있다)
  const guess = (S, surface, source) => LangLearning.learn(S, { type: 'contextual_guess', language: AVER, wordId: idOf(surface), source: source || 'scene' });
  const knows = (S, surface) => LangKnowledge.word(S, 'player', AVER, idOf(surface)).confidence >= LangKnowledge.KNOWN;
  const canTeach = (S, n) => Dialogue.canTeach(S, n);
  const teach = (S, n) => Dialogue.teach(S, n);
  // 정령의 말처럼 단어가 아닌 무언가를 스치듯 느꼈다
  const sense = (S, languageId, amount) => LangLearning.learn(S, { type: 'exposure', language: languageId, amount, source: 'sense' });

  return {
    AVER, idOf,
    getLanguageKnowledge, getWordKnowledge, processDialogue, calculateUnderstanding, learnWord, learnFromContext,
    canSpeak, canRead, translateForPlayer,
    speak, learn, guess, knows, canTeach, teach, sense,
  };
})();

if (typeof module !== 'undefined') module.exports = { Lang };
