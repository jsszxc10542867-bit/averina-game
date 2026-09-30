// 날씨. 한 시간마다 바뀔 수 있다. 날씨 씨앗은 사건 씨앗과 따로 돌아서, 플레이어가 무엇을 하든 회차마다 같은 하늘이다.
const Weather = (() => {
  const KO = { clear: '맑음', cloudy: '흐림', rain: '비', fog: '안개' };
  // 한 시간 뒤의 날씨 확률
  const NEXT = {
    clear: [['clear', 0.86], ['cloudy', 0.12], ['fog', 0.02]],
    cloudy: [['cloudy', 0.62], ['clear', 0.24], ['rain', 0.14]],
    rain: [['rain', 0.62], ['cloudy', 0.38]],
    fog: [['fog', 0.55], ['clear', 0.45]],
  };
  const CHANGE_LINE = {
    rain: '빗방울이 떨어지기 시작한다.',
    cloudy: '하늘이 낮게 흐려진다.',
    fog: '어느새 안개가 낮게 깔렸다.',
    clear: null,
  };
  const AFTER = { rain: '비가 그쳤다. 잎에서 물방울이 떨어진다.', fog: '안개가 걷힌다.' };
  // 장소 묘사 끝에 붙는 줄
  const SKY_EXTRA = { rain: '빗소리가 잎을 두드린다.', fog: '안개 때문에 몇 걸음 앞도 흐릿하다.', cloudy: null, clear: null };

  function create(seed) {
    return { seed: seed >>> 0, kind: 'clear', since: Time.START };
  }

  // 바깥 기온(도). 오후 3시에 가장 따뜻하고 새벽 3시에 가장 춥다.
  function temp(W) {
    const h = Time.hour(W.time.t);
    const base = 13 + 6 * Math.cos(((h - 15) / 24) * 2 * Math.PI);
    return base + ({ clear: 0, cloudy: -1, rain: -3, fog: -1 })[W.weather.kind];
  }

  function roll(w) {
    // 안개는 새벽과 밤에만 낀다
    const r = Rng.next(w, 'seed');
    let acc = 0;
    for (const [k, p] of NEXT[w.kind]) { acc += p; if (r < acc) return k; }
    return w.kind;
  }

  // 정시마다 날씨가 바뀔 수 있다. 바뀌면 바깥에 있는 플레이어에게 한 줄 보인다.
  function update(S, prevT) {
    const { W } = S;
    if (Math.floor(prevT / 60) === Math.floor(W.time.t / 60)) return;
    const w = W.weather;
    let k = roll(w);
    const b = Time.band(W.time.t);
    if (k === 'fog' && !(b === 'dawn' || b === 'late_night' || b === 'night')) k = 'clear';
    if (k === w.kind) return;
    const before = w.kind;
    set(S, k);
    const line = CHANGE_LINE[k] || AFTER[before];
    if (line && !W.worldFlags.end) W.worldFlags.feed.push(line);
  }

  function set(S, kind) {
    S.W.weather.kind = kind;
    S.W.weather.since = S.W.time.t;
  }

  const wet = (W) => W.weather.kind === 'rain';
  const hazy = (W) => W.weather.kind === 'fog';

  return { KO, SKY_EXTRA, create, temp, update, set, wet, hazy };
})();

if (typeof module !== 'undefined') module.exports = { Weather };
