// 자연어 행동 (통합 명세 34절). 생성형 AI 없이 규칙으로 해석한다.
// 입력 → 의도(동사·대상·방식) → 지금 고를 수 있는 선택지 중 가장 가까운 것.
// 선택지의 문구도 같은 규칙으로 해석하므로, 장면을 쓰는 사람이 따로 키워드를 달지 않아도 된다.
const Intent = (() => {
  // [의도, 어간...] 긴 어간을 먼저 본다
  const VERBS = [
    ['repeat_word', '따라 말', '다시 말', '되뇌', '되뇐', '되풀이', '따라 해'],
    ['follow', '따라가', '따라간', '뒤를 따', '따라나'],
    ['drink', '마시', '마셔', '들이켜'],
    ['eat', '먹'],
    ['give', '건네', '건넨', '주어', '줘', '준다', '주고', '주자', '줄래', '내민', '내밀', '나눠'],
    ['examine', '살펴', '살핀', '조사', '관찰', '둘러', '들여다', '본다', '보자', '볼래', '확인', '지켜'],
    ['approach', '다가'],
    ['attack', '공격', '때리', '때린', '찌르', '찌른', '덤비', '덤빈', '내리친', '내리쳐', '죽이', '죽인', '베어', '벤다'],
    ['flee', '도망', '달아나', '달아난', '뛰어가'],
    ['hide', '숨는', '숨어', '숨을래', '숨자', '숨긴', '몸을 숨'],
    ['rest', '쉬', '쉰', '앉', '눕', '잔다', '자자', '잠을'],
    ['wait', '기다'],
    ['listen', '듣', '귀 기울', '귀를'],
    ['speak', '말을 걸', '말 걸', '말해', '말한', '부르', '불러', '외치', '묻', '물어'],
    ['move', '간다', '가자', '갈래', '가 본', '이동', '올라', '내려', '돌아가', '돌아간', '향한', '들어간', '나간', '들어선'],
    ['take', '줍', '꺾', '딴다', '따자', '뜯', '챙기', '챙긴', '집어', '집는'],
    ['threaten', '위협', '겁주', '협박', '노려'],
    ['leave', '떠나', '떠난', '지나간', '지나가', '두고'],
    ['draw', '뽑', '꺼내', '쥐', '움켜'],
    ['treat', '치료', '대어', '감싸', '싸매', '짓이겨'],
    ['show', '보여', '펴 보'],
    ['stop', '멈춰', '멈춘', '멈추'],
    ['climb', '올라가', '기어오'],
    ['throw', '던지', '던진', '던져'],
  ];
  const TARGETS = {
    lia: ['그녀', '리아', '여자'], water: ['물', '개울'], tree: ['나무', '고목', '가지'], rock: ['바위', '돌'],
    herb: ['풀', '약초', '잎'], berry: ['열매'], sound: ['소리'], hands: ['손'], wound: ['상처', '다친'],
    light: ['빛'], word: ['말', '단어'], name: ['이름'], body: ['몸'],
  };
  const MANNERS = { careful: ['조심', '천천히', '살금', '살며시', '살살'], quick: ['빨리', '급히', '재빨리', '힘껏'] };
  const NEGATE = /(지 ?않|지 ?말|안 |말고|못 )/;

  // 받침 없는 어간은 활용하면 끝 글자에 ㄴ·ㄹ·ㅂ 받침이 붙는다: 마시 → 마신다, 마실래, 마십니다
  function variants(stem) {
    const last = stem.charCodeAt(stem.length - 1);
    if (last < 0xac00 || last > 0xd7a3 || (last - 0xac00) % 28 !== 0) return [stem];
    const head = stem.slice(0, -1);
    return [stem, ...[4, 8, 17].map((j) => head + String.fromCharCode(last + j))];
  }
  const STEMS = VERBS.map(([v, ...stems]) => [v, [...new Set(stems.flatMap(variants))]]);

  function parse(text) {
    const s = String(text).replace(/[.!?,]/g, ' ');
    const verbs = new Set(), negated = new Set(), targets = new Set();
    // "뽑지만 공격하지 않는다" → 절마다 따로 본다
    s.split(/지만|는데|면서|하고 |고 /).forEach((clause) => {
      const neg = NEGATE.test(clause);
      STEMS.forEach(([v, stems]) => { if (stems.some((x) => clause.includes(x))) (neg ? negated : verbs).add(v); });
    });
    if (verbs.has('repeat_word')) verbs.delete('speak');
    if (verbs.has('follow')) verbs.delete('move');
    if (verbs.has('climb')) verbs.delete('move');
    Object.entries(TARGETS).forEach(([t, words]) => { if (words.some((w) => s.includes(w))) targets.add(t); });
    const manner = Object.keys(MANNERS).find((m) => MANNERS[m].some((w) => s.includes(w))) || null;
    return { verbs, negated, targets, manner };
  }

  const cache = new Map();
  function parseLabel(label) {
    if (!cache.has(label)) cache.set(label, parse(label));
    return cache.get(label);
  }

  // 가장 가까운 선택지. { option, manner, score } 또는 null
  function match(opts, text) {
    const I = parse(text);
    let best = null;
    opts.forEach((o) => {
      if (o.disabled) return;
      const L = parseLabel(o.label);
      let score = 0;
      I.verbs.forEach((v) => { if (L.verbs.has(v)) score += 4; });
      I.negated.forEach((v) => { if (L.verbs.has(v)) score -= 6; });
      I.targets.forEach((t) => { if (L.targets.has(t)) score += 2; });
      // 장면이 달아 둔 키워드도 그대로 쓴다 (예전 방식)
      (o.kw || []).forEach((k) => { if (text.includes(k)) score += k.length * 2; });
      if (o.label.includes(text.trim()) || text.includes(o.label)) score += 3;
      if (!best || score > best.score) best = { option: o, score, manner: I.manner };
    });
    return best && best.score >= 2 ? best : null;
  }

  return { parse, match };
})();

if (typeof module !== 'undefined') module.exports = { Intent };
