// 텍스트 도구: 한국어 조사 자동 처리, {이름} 치환
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

  // 언어 이해도에 따라 대사를 가리는 일은 언어 시스템(js/lang/)이 맡는다.
  return { josa, fmt, tail };
})();

if (typeof module !== 'undefined') module.exports = { Text };
