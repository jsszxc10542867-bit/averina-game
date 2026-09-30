// 언어 지식 (언어 시스템 18~20절). 이해·말하기·읽기·쓰기를 따로 둔다. 단어마다 확신도가 있다.
// 플레이어: S.P.lang / NPC: n.languages (NPC는 단어 하나하나가 아니라 실력으로 본다)
const LangKnowledge = (() => {
  const KNOWN = 0.6; // 이만큼 확신하면 그 단어가 들린다
  const GUESS = 0.3; // 이만큼이면 어렴풋이 짐작한다 (틀릴 수 있다)
  const blank = { understanding: 0, speaking: 0, reading: 0, writing: 0 };

  function profile(S, id) {
    if (id === 'player') return S.P.lang.languageKnowledge;
    const n = S.W.npcs[id];
    return n ? n.languages : {};
  }
  const get = (S, id, lang) => profile(S, id)[lang] || blank;

  function word(S, id, lang, wordId) {
    if (id !== 'player') return { confidence: get(S, id, lang).understanding / 100, encounters: 0, lastEncounter: null };
    const w = S.P.lang.knownWords[lang];
    return (w && w[wordId]) || { confidence: 0, encounters: 0, lastEncounter: null };
  }

  const state = (conf) => (conf >= KNOWN ? 'known' : conf >= GUESS ? 'guess' : 'unknown');
  const canSpeak = (S, id, lang, min = 30) => get(S, id, lang).speaking >= min;
  const canRead = (S, id, lang, min = 30) => get(S, id, lang).reading >= min;

  // 플레이어가 들어 본 단어들 (확신 순)
  function heardWords(S, lang) {
    const w = S.P.lang.knownWords[lang] || {};
    return Object.entries(w).map(([id, r]) => ({ id, ...r, state: state(r.confidence) }))
      .sort((a, b) => b.confidence - a.confidence || b.encounters - a.encounters);
  }
  const encountered = (S, lang) => get(S, 'player', lang).understanding > 0 || heardWords(S, lang).length > 0;

  return { KNOWN, GUESS, profile, get, word, state, canSpeak, canRead, heardWords, encountered };
})();

if (typeof module !== 'undefined') module.exports = { LangKnowledge };
