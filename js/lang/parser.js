// 대사 표기 해석 (lexicon.js 머리말의 표기 규칙). [[단어:임계값|오역]] → 단어 ID와 임계값
const LangParser = (() => {
  const RE = /\[\[([^:\]|]+)(?::(\d+))?(?:\|([^\]]+))?\]\]/g;

  // {target} 같은 자리표시자를 채운다
  const fill = (str, vars) => (vars ? String(str).replace(/\{(\w+)\}/g, (m, k) => (vars[k] != null ? vars[k] : m)) : String(str));

  function parse(str, vars) {
    const text = fill(str, vars);
    const tokens = [];
    text.replace(RE, (m, surface, th, alt) => {
      const w = LangRegistry.wordByForm(surface);
      tokens.push({ surface, wordId: w ? w.id : surface, th: th != null ? +th : (w ? w.difficulty * 10 : 30), alt: alt || null });
      return m;
    });
    return { text, tokens, plain: text.replace(RE, '$1') };
  }

  return { RE, fill, parse };
})();

if (typeof module !== 'undefined') module.exports = { LangParser };
