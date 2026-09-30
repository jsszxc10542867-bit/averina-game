// 텍스트 도구: 한국어 조사 자동 처리, {이름} 치환, 언어 이해도에 따른 키워드 가리기
const Text = (() => {
  const isHangul = (c) => c >= 0xac00 && c <= 0xd7a3;

  // 마지막 글자의 받침 정보. 한글이 아니면 받침 없음으로 취급한다.
  function tail(word) {
    const ch = [...String(word)].reverse().find((c) => /[가-힣a-zA-Z0-9]/.test(c));
    if (!ch) return { batchim: false, rieul: false };
    const c = ch.charCodeAt(0);
    if (!isHangul(c)) return { batchim: false, rieul: false };
    const jong = (c - 0xac00) % 28;
    return { batchim: jong !== 0, rieul: jong === 8 };
  }

  const JOSA = {
    '은는': ['은', '는'],
    '이가': ['이', '가'],
    '을를': ['을', '를'],
    '과와': ['과', '와'],
    '이야야': ['이야', '야'],
  };

  function josa(word, type) {
    const t = tail(word);
    if (type === '으로') return t.batchim && !t.rieul ? '으로' : '로';
    const pair = JOSA[type];
    if (!pair) throw new Error('알 수 없는 조사: ' + type);
    return t.batchim ? pair[0] : pair[1];
  }

  // {이름} → 이름, {이름:은는} → 이름 + 알맞은 조사
  function fmt(str, vars) {
    return String(str).replace(/\{([^{}:]+)(?::([^{}]+))?\}/g, (m, key, j) => {
      if (!(key in vars) || vars[key] == null) return m;
      const v = vars[key];
      return j ? v + josa(v, j) : v;
    });
  }

  // [[단어:임계값]] 표기. 이해도(u, 0~100)가 임계값 이상인 단어만 들린다.
  // 모든 키워드가 들리면(또는 fullAt 이상이면) 문장 전체가 그대로 보인다.
  // known: 뜻을 알아낸 단어 목록. 이해도가 모자라도 그 단어는 들린다.
  function mask(str, u, fullAt, known) {
    const re = /\[\[([^:\]]+):(\d+)\]\]/g;
    const words = [];
    let m;
    while ((m = re.exec(str))) words.push({ w: m[1], th: +m[2] });
    const plain = str.replace(re, '$1');
    if (!words.length) return plain;
    const full = fullAt != null ? fullAt : Math.max(...words.map((x) => x.th));
    if (u >= full) return plain;
    const hears = (x) => u >= x.th || (known && known[x.w]);
    if (words.every(hears) && fullAt == null) return plain;
    // 들리지 않는 단어는 낯선 소리로, 키워드가 아닌 부분(어미·조사)은 지운다.
    // 같은 단어는 언제나 같은 소리로 들리므로, 반복되는 말을 플레이어가 알아챌 수 있다.
    let i = 0;
    return str
      .replace(re, '\u0000')
      .replace(/[가-힣]+/g, '')
      .replace(/\u0000/g, () => { const x = words[i++]; return hears(x) ? x.w : foreign(x.w); })
      .replace(/ {2,}/g, ' ')
      .replace(/「 /, '「');
  }

  // 아베르어처럼 들리는 소리. 단어마다 항상 같은 소리가 나온다.
  const SYL = ['아', '베', '르', '칸', '이', '엘', '도', '사', '린', '테', '우', '메', '라', '시', '카', '노', '벨', '온', '타', '레'];
  function foreign(w) {
    let h = 7;
    for (const c of w) h = (h * 131 + c.charCodeAt(0)) >>> 0;
    const n = Math.min(3, [...w].length + 1);
    let s = '';
    for (let k = 0; k < n; k++) { s += SYL[h % SYL.length]; h = Math.floor(h / SYL.length) + (k + 1) * 977; }
    return s;
  }

  return { josa, fmt, mask, tail };
})();

if (typeof module !== 'undefined') module.exports = { Text };
