// 언어 저장 데이터 (언어 시스템 35절). 플레이어의 언어 지식은 되감아도 남는다 (P.lang).
const LangStore = (() => {
  const blankSkill = () => ({ understanding: 0, speaking: 0, reading: 0, writing: 0 });

  function create() {
    return {
      languageKnowledge: Object.fromEntries(Object.keys(LANGUAGES).map((id) => [id, blankSkill()])),
      // { 언어: { 단어ID: { confidence 0~1, encounters, lastEncounter } } } (통합 명세 14절)
      knownWords: {},
      knownExpressions: [],
      knownDialects: [],
      translationAbilities: [],
      languageMilestones: [], // 이해도 구간을 넘은 순간 { language, band, t }
      understood: {},         // 처음으로 온전히 알아들은 대사
      named: {},              // 이름을 알게 된 언어
    };
  }

  // 빠진 칸을 채운다. 예전 저장 파일(P.language, P.words)은 새 구조로 옮긴다.
  function migrate(P) {
    const L = P.lang || create();
    const fresh = create();
    Object.keys(fresh).forEach((k) => { if (L[k] == null) L[k] = fresh[k]; });
    Object.keys(LANGUAGES).forEach((id) => { L.languageKnowledge[id] = Object.assign(blankSkill(), L.languageKnowledge[id]); });
    if (P.language) {
      Object.entries(P.language).forEach(([k, v]) => {
        const id = LangRegistry.normalize(k);
        if (L.languageKnowledge[id]) L.languageKnowledge[id].understanding = Math.max(L.languageKnowledge[id].understanding, v);
      });
      delete P.language;
    }
    if (P.words) {
      L.knownWords.common_aver = L.knownWords.common_aver || {};
      Object.keys(P.words).forEach((form) => {
        const w = LangRegistry.wordByForm(form);
        L.knownWords.common_aver[w ? w.id : form] = { confidence: 0.7, encounters: 1, lastEncounter: null };
      });
      delete P.words;
    }
    P.lang = L;
    return P;
  }

  return { create, migrate };
})();

if (typeof module !== 'undefined') module.exports = { LangStore };
