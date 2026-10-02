// 공통 사건 상태 (지시문 5의 19·20절, 시작마을.md 8-12) — 마을의 사건들이 같은 틀을 쓴다.
// W.events.states[id] = { id, state, since, history: [{ from, state, t, why }], data: {}, discoveredVia, resolvedBy: [] }
//   state: LOCKED → AVAILABLE → DISCOVERED → IN_PROGRESS → RESOLVED, 그리고 FAILED · IGNORED · EXPIRED · ESCALATED
//   AVAILABLE 이후에는 플레이어가 몰라도 세계가 진행된다. DISCOVERED는 "플레이어가 알게 된 것"이다 (발견과 해결의 분리).
// 사건마다의 조건과 결과는 각 사건 파일(js/incidents/)이 register로 넣는다:
//   { order, daily(S, st), hourly(S, st), notice(S, st, kind, data), options(S, st, pass), restore(W, st) }
// order는 시작마을.md의 절 번호다. 같은 날 두 사건이 AVAILABLE이 되지 않고, 겹치면 번호가 큰 쪽이 하루 양보한다 (13절)
const Incidents = (() => {
  const STATES = ['LOCKED', 'AVAILABLE', 'DISCOVERED', 'IN_PROGRESS', 'RESOLVED', 'FAILED', 'IGNORED', 'EXPIRED', 'ESCALATED'];
  const DONE = ['RESOLVED', 'EXPIRED'];
  const DEFS = {};
  const day = (W) => Time.day(W.time.t);

  function register(id, def) { DEFS[id] = def; }
  const sorted = () => Object.entries(DEFS).sort((a, b) => a[1].order - b[1].order);

  function get(W, id) {
    const all = W.events.states || (W.events.states = {});
    return all[id] || (all[id] = { id, state: 'LOCKED', since: W.time.t, history: [], data: {}, discoveredVia: null, resolvedBy: [] });
  }

  // 상태를 바꾼다. 바뀐 때(since)와 이력을 남긴다
  function set(S, id, state, why) {
    if (!STATES.includes(state)) throw new Error('알 수 없는 사건 상태: ' + state);
    const st = get(S.W, id);
    if (st.state === state) return false;
    st.history.push({ from: st.state, state, t: S.W.time.t, why: why || null });
    if (st.history.length > 60) st.history.shift();
    st.state = state;
    st.since = S.W.time.t;
    if (state === 'AVAILABLE') S.W.events.openedOn = { day: day(S.W), id };
    Bus.emit(S, 'INCIDENT_CHANGED', { id, state, why: why || null });
    return true;
  }

  // 열 수 있는가 (시작마을.md 13절 공통 규칙)
  //  (a) 오늘 다른 사건이 이미 열렸으면 하루 양보한다 (작은 번호부터 판단하므로 큰 번호가 양보한다)
  //  (d) 진행 중인 마을 사건(열린 뒤 끝나지 않은 것)은 RULES.incidents.maxOpen개까지. 넘치면 기다린다 [임시]
  const isOpen = (st) => st.state !== 'LOCKED' && !DONE.includes(st.state);
  function canOpen(S, id) {
    const o = S.W.events.openedOn;
    if (o && o.day === day(S.W) && o.id !== id) return false;
    const open = Object.values(S.W.events.states || {}).filter((st) => st.id !== id && isOpen(st)).length;
    return open < RULES.incidents.maxOpen;
  }

  // 플레이어가 마을(하르넨)에 처음 닿은 날
  const arrivalDay = (W) => (W.worldFlags.arrivedVillage != null ? Time.day(W.worldFlags.arrivedVillage) : null);
  Bus.on('PLAYER_MOVED', (S, e) => {
    if (S.W.worldFlags.arrivedVillage == null && Places.regionOf(e.to) === 'village') S.W.worldFlags.arrivedVillage = S.W.time.t;
  });

  const known = (st) => !!st.discoveredVia;
  const done = (st) => DONE.includes(st.state);
  const daysIn = (W, st) => day(W) - Time.day(st.since);

  // 플레이어가 알게 되었다 (발견 경로 via). AVAILABLE이면 DISCOVERED로, 이미 더 나아간 상태(ESCALATED 등)면 경로만 남긴다.
  // lines: 화면 아래 덧붙는 줄. 처음 알게 되었으면 true
  function discover(S, id, via, lines) {
    const st = get(S.W, id);
    if (st.state === 'LOCKED' || known(st)) return false;
    st.discoveredVia = via;
    st.data.discoveredAt = S.W.time.t;
    S.P.found.incidents = S.P.found.incidents || {};
    S.P.found.incidents[id] = { t: S.W.time.t, via };
    if (st.state === 'AVAILABLE') set(S, id, 'DISCOVERED', via);
    (lines || []).forEach((l) => S.W.worldFlags.feed.push(l));
    Bus.emit(S, 'INCIDENT_DISCOVERED', { id, via });
    return true;
  }

  // 사건이 장면을 띄우고 싶을 때 (예: 아이가 먼저 다가온다). 장면 우선순위 표(play/order.js)의 '지역 사건' 줄이 꺼낸다
  function queueScene(S, id, scene) {
    const q = S.W.events.sceneQueue || (S.W.events.sceneQueue = []);
    if (!q.some((x) => x.id === id && x.scene === scene)) q.push({ id, scene, t: S.W.time.t });
  }
  // 지금 띄울 사건 장면 'incident:<사건>:<장면>' (사건이 그 장면을 아직 원할 때만). peek이면 꺼내지 않는다
  function nextScene(S, peek) {
    const q = S.W.events.sceneQueue || [];
    for (let i = 0; i < q.length; i++) {
      const { id, scene } = q[i];
      const d = DEFS[id];
      const want = d && d.scenes && d.scenes[scene] && (!d.wantsScene || d.wantsScene(S, get(S.W, id), scene));
      if (!want) { q.splice(i--, 1); continue; }
      if (!peek) q.splice(i, 1);
      return `incident:${id}:${scene}`;
    }
    return null;
  }
  function runScene(ui, name) {
    const [, id, scene] = name.split(':');
    return DEFS[id].scenes[scene](ui, get(ui.W, id));
  }

  function daily(S) { sorted().forEach(([id, d]) => { if (d.daily) d.daily(S, get(S.W, id)); }); }
  function hourly(S) { sorted().forEach(([id, d]) => { if (d.hourly) d.hourly(S, get(S.W, id)); }); }
  function notice(S, kind, data) { sorted().forEach(([id, d]) => { if (d.notice) d.notice(S, get(S.W, id), kind, data || {}); }); }
  function options(S, pass) { return sorted().flatMap(([id, d]) => (d.options ? d.options(S, get(S.W, id), pass) : [])); }
  // 저장 파일을 불러온 뒤: 사건이 바꿔 둔 것(일정 등)을 다시 맞춘다
  function restore(W) { sorted().forEach(([id, d]) => { if (d.restore) d.restore(W, get(W, id)); }); }

  return { STATES, DEFS, register, get, set, canOpen, arrivalDay, known, done, daysIn, discover, daily, hourly, notice, options, restore, day,
    queueScene, nextScene, runScene };
})();

if (typeof module !== 'undefined') module.exports = { Incidents };
