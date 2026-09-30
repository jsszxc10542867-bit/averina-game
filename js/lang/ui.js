// 언어 화면 (언어 시스템 13절). 들어 본 말만, 알게 된 만큼만 보여 준다. 언어의 이름도 알기 전에는 "낯선 말"이다.
const LangUI = (() => {
  function wordLines(S, lang = 'common_aver') {
    const out = [];
    LangKnowledge.heardWords(S, lang).forEach((r) => {
      const w = LangRegistry.word(r.id);
      const snd = LangRegistry.sound(r.id, r.id);
      const meaning = w ? w.meaning : r.id;
      if (r.state === 'known') out.push({ t: `· 「${snd}」 ${meaning}`, cls: 'note' });
      else if (r.state === 'guess') out.push({ t: `· 「${snd}」 ${meaning}……?`, cls: 'note' });
      else if (r.encounters >= 3) out.push({ t: `· 「${snd}」 ……자주 들린다. 뜻은 모른다.`, cls: 'note dim' });
    });
    return out;
  }

  const langName = (S, id) => (S.P.lang.named[id] ? LANGUAGES[id].name : (LANG_UNNAMED[id] || '낯선 말'));

  function languageLines(S) {
    return Object.keys(LANGUAGES).filter((id) => LangKnowledge.encountered(S, id)).map((id) => {
      const u = Math.floor(LangKnowledge.get(S, 'player', id).understanding);
      return { t: `${langName(S, id).padEnd(6, '　')}  ${String(u).padStart(3, ' ')}%`, cls: 'stat' };
    });
  }

  // 들은 말을 되뇐다
  function notebook(S) {
    const words = wordLines(S);
    return ['들은 말을 입속으로 되뇐다.', '', ...(words.length ? words : ['……아직 뜻을 짐작할 수 있는 말이 없다.']), '', ...languageLines(S)];
  }

  const hasAny = (S) => wordLines(S).length > 0;

  return { wordLines, languageLines, notebook, langName, hasAny };
})();

if (typeof module !== 'undefined') module.exports = { LangUI };
