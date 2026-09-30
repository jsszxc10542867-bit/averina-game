// 장소: 지역, 지형 특징, NPC가 걷는 길 찾기, 장소에 남는 흔적.
// 흔적(trace)은 플레이어가 보지 못한 곳에서 일어난 일이 남기는 것이다. 다음에 그곳에 가면 흔적만 보인다.
const Places = (() => {
  const adj = {};
  PATHS.forEach(([a, b, m]) => {
    (adj[a] = adj[a] || {})[b] = m;
    (adj[b] = adj[b] || {})[a] = m;
  });

  const info = (loc) => PLACE_DATA[loc] || null;
  const name = (loc) => (typeof LOCS !== 'undefined' && LOCS[loc] && LOCS[loc].name) || (PLACE_DATA[loc] && PLACE_DATA[loc].name) || loc;
  const regionOf = (loc) => (PLACE_DATA[loc] ? PLACE_DATA[loc].region : 'far');
  const has = (loc, f) => !!(PLACE_DATA[loc] && PLACE_DATA[loc].features.includes(f));
  const neighbors = (loc) => Object.keys(adj[loc] || {});
  const distance = (a, b) => (adj[a] && adj[a][b]) || null;

  // 가장 빠른 길 (다익스트라). { path: [from, ..., to], min } 또는 null
  function route(from, to) {
    if (from === to) return { path: [from], min: 0 };
    const dist = { [from]: 0 }, prev = {}, done = new Set();
    while (true) {
      let cur = null;
      for (const k in dist) if (!done.has(k) && (cur === null || dist[k] < dist[cur])) cur = k;
      if (cur === null) return null;
      if (cur === to) break;
      done.add(cur);
      for (const [n, m] of Object.entries(adj[cur] || {})) {
        if (dist[n] == null || dist[cur] + m < dist[n]) { dist[n] = dist[cur] + m; prev[n] = cur; }
      }
    }
    const path = [to];
    while (path[0] !== from) path.unshift(prev[path[0]]);
    return { path, min: dist[to] };
  }

  function createState() {
    const s = {};
    Object.keys(PLACE_DATA).forEach((k) => { s[k] = { traces: [] }; });
    return s;
  }

  // 흔적을 남긴다. kind: blood | drag | body | camp | footprints | crushed_herb | struggle
  function addTrace(W, loc, kind, data = {}) {
    const st = W.locations[loc];
    if (!st) return null;
    const tr = Object.assign({ kind, t: W.time.t, until: W.time.t + (data.ttl || 3 * Time.DAY) }, data);
    delete tr.ttl;
    st.traces.push(tr);
    return tr;
  }
  const traces = (W, loc) => (W.locations[loc] ? W.locations[loc].traces.filter((x) => x.until > W.time.t) : []);

  // 시간이 지나 사라진 흔적을 지운다 (한 시간마다)
  function update(S) {
    const { W } = S;
    Object.values(W.locations).forEach((st) => { st.traces = st.traces.filter((x) => x.until > W.time.t); });
  }

  return { info, name, regionOf, has, neighbors, distance, route, createState, addTrace, traces, update };
})();

if (typeof module !== 'undefined') module.exports = { Places };
