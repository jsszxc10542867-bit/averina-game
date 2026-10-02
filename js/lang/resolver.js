// 번역 해석기 (언어 시스템 23~25절). NPC가 전하려는 뜻은 그대로다. 달라지는 것은 듣는 사람이 받아들이는 만큼이다.
// 단어마다: 이해도가 임계값 이상이거나 확신 0.6 이상 → 들린다 / 확신 0.3~0.6 → 어렴풋이 짐작 (오역이 있으면 틀리게) / 그 밖 → 낯선 소리
// 들리지 않는 부분(어미·조사)은 지운다. 짐작한 단어가 섞이면 끝에 "……?"가 붙는다.
const LangResolver = (() => {
  const r2 = (n) => Math.round(n * 100) / 100;
  // 낯선 소리의 앞뒤 표시 (화면이 따로 꾸밀 수 있게 parts로 나눈 뒤 지운다)
  const OPEN = '\u0001', CLOSE = '\u0002';
  // "「노칸르 사노테…… 온아?」" → [{ s: '「' }, { s: '노칸르', foreign: true }, ...]. 낯선 소리가 없으면 null
  function split(display) {
    if (!display.includes(OPEN)) return null;
    return display.split(/(\u0001[^\u0002]*\u0002)/).filter(Boolean)
      .map((s) => (s[0] === OPEN ? { s: s.slice(1, -1), foreign: true } : { s }));
  }

  // 관계가 말투를 바꾼다 (통합 명세 17절): 호의적이면 천천히, 쉬운 말로, 되풀이하며 / 적대적이면 빠르게, 비꼬아서
  function manner(S, speakerId, listenerId) {
    if (!speakerId || speakerId === 'player') return 0;
    const r = Rel.peek(S.W, speakerId, listenerId);
    if (!r) return 0;
    if (r.hostility >= 40) return -10;
    if (r.trust >= 40 || r.affection >= 30) return 10;
    return 0;
  }

  // o: { text, lang, listenerId, speakerId, fullAt, vars, reading }
  function resolve(S, o) {
    const lang = o.lang || 'common_aver';
    const listener = o.listenerId || 'player';
    const p = LangParser.parse(o.text, o.vars);
    const skill = LangKnowledge.get(S, listener, lang);
    const u = (o.reading ? skill.reading : skill.understanding) + manner(S, o.speakerId, listener);
    const base = { language: lang, misheard: [], tokens: [], recognizedWords: [], uncertainWords: [], unknownWords: [] };
    if (!p.tokens.length) return Object.assign(base, { understanding: 1, fullyUnderstood: true, displayText: p.plain });

    const res = p.tokens.map((tk) => {
      const conf = LangKnowledge.word(S, listener, lang, tk.wordId).confidence;
      const state = u >= tk.th || conf >= LangKnowledge.KNOWN ? 'known' : conf >= LangKnowledge.GUESS ? 'guess' : 'unknown';
      return Object.assign({}, tk, { conf, state });
    });
    // 문맥 보정: 대부분 알아들었다면, 조금 어려운 나머지 말도 어렴풋이 짐작한다
    const knownN = res.filter((x) => x.state === 'known').length;
    if (res.length >= 3 && knownN / res.length >= 2 / 3) {
      res.forEach((x) => { if (x.state === 'unknown' && x.th <= u + 15) { x.state = 'guess'; x.context = true; } });
    }
    const full = o.fullAt != null ? u >= o.fullAt : res.every((x) => x.state === 'known');
    let display;
    if (full) display = p.plain;
    else {
      let i = 0;
      display = p.text
        .replace(LangParser.RE, '\u0000')
        .replace(/[가-힣]+/g, '')
        .replace(/\u0000/g, () => {
          const x = res[i++];
          if (x.state === 'known') return x.surface;
          if (x.state === 'guess') return x.alt || x.surface;
          return OPEN + LangRegistry.sound(x.wordId, x.surface) + CLOSE;
        })
        .replace(/ {2,}/g, ' ')
        .replace(/「 /, '「')
        .replace(/ 」/, '」');
      if (res.some((x) => x.state === 'guess')) display = display.replace(/[.!?…]*」\s*$/, '……?」');
    }
    const parts = full ? null : split(display);
    if (parts) display = display.replace(/[\u0001\u0002]/g, '');
    const pick = (st) => res.filter((x) => x.state === st).map((x) => x.wordId);
    return Object.assign(base, {
      understanding: r2((knownN + pick('guess').length * 0.5) / res.length),
      fullyUnderstood: full,
      displayText: display,
      parts, // 화면용: 낯선 소리 조각 표시 (없으면 null). displayText와 글자는 같다
      recognizedWords: pick('known'),
      uncertainWords: pick('guess'),
      unknownWords: pick('unknown'),
      misheard: res.filter((x) => x.state === 'guess' && x.alt).map((x) => ({ wordId: x.wordId, heard: x.alt })),
      tokens: res,
    });
  }

  return { manner, resolve };
})();

if (typeof module !== 'undefined') module.exports = { LangResolver };
