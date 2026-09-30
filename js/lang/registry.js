// 언어 등록부 (언어 시스템 17·21절): 언어와 단어를 ID로 찾는다. 들리는 소리를 만든다.
const LangRegistry = (() => {
  const byId = {}, byForm = {};
  WORDS.forEach((w) => { byId[w.id] = w; w.forms.forEach((f) => { byForm[f] = w; }); });

  const language = (id) => LANGUAGES[id] || null;
  const ids = () => Object.keys(LANGUAGES);
  const word = (id) => byId[id] || null;
  const wordByForm = (form) => byForm[form] || null;
  const normalize = (id) => LEGACY_LANG_IDS[id] || id;

  // 아베르어처럼 들리는 소리. 같은 뜻은 언제나 같은 소리라서, 반복되는 말을 플레이어가 알아챌 수 있다.
  const SYL = ['아', '베', '르', '칸', '이', '엘', '도', '사', '린', '테', '우', '메', '라', '시', '카', '노', '벨', '온', '타', '레'];
  function foreign(key) {
    let h = 7;
    for (const c of key) h = (h * 131 + c.charCodeAt(0)) >>> 0;
    const n = Math.min(3, [...key].length + 1);
    let s = '';
    for (let k = 0; k < n; k++) { s += SYL[h % SYL.length]; h = Math.floor(h / SYL.length) + (k + 1) * 977; }
    return s;
  }
  // 단어가 실제로 들리는 소리
  function sound(wordId, surface) {
    const w = byId[wordId];
    if (w && w.text) return w.text;
    return foreign(w ? w.meaning : (surface || wordId));
  }

  return { language, ids, word, wordByForm, normalize, foreign, sound };
})();

if (typeof module !== 'undefined') module.exports = { LangRegistry };
