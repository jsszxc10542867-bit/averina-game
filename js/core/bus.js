// 이벤트 버스: 시스템끼리 서로를 직접 부르지 않고 "무슨 일이 있었다"를 알린다.
// 처리기는 (S, e)를 받는다. S = { P, W } (P: 플레이어가 아는 것, W: 세계 상태)
const Bus = (() => {
  // 쓸 수 있는 이벤트 이름. 목록에 없는 이름은 오타로 보고 멈춘다.
  // PLAYER_ATTACKED = 플레이어가 누군가를 공격했다 / NPC_ATTACKED = NPC가 공격을 받았다
  const EVENTS = [
    'PLAYER_MOVED', 'PLAYER_ATTACKED', 'PLAYER_HELPED_NPC', 'PLAYER_HURT', 'PLAYER_DIED',
    'NPC_MOVED', 'NPC_ATTACKED', 'NPC_HELPED', 'NPC_THREATENED', 'NPC_DIED', 'NPC_MET_PLAYER',
    'DIALOGUE_STARTED', 'DIALOGUE_COMPLETED',
    'LANGUAGE_WORD_LEARNED', 'LANGUAGE_LEVEL_CHANGED', 'LANGUAGE_MISUNDERSTOOD', 'LANGUAGE_FULLY_UNDERSTOOD',
    'TRANSLATION_PERFORMED',
    'RELATIONSHIP_CHANGED',
    'RUMOR_CREATED', 'RUMOR_SPREAD',
    'LOCATION_DISCOVERED', 'WORLD_EVENT_CREATED',
    // 생활 (스토리 재설계): 쓰러짐, 일, 거처, 동행, 단서
    'PLAYER_COLLAPSED', 'PLAYER_RESCUED', 'PLAYER_WORKED', 'PLAYER_SLEPT', 'LODGING_CHANGED',
    'COMPANION_JOINED', 'COMPANION_LEFT', 'CLUE_FOUND', 'THREAD_OPENED',
    // 공통 사건 상태 (sim/incidents.js)
    'INCIDENT_CHANGED', 'INCIDENT_DISCOVERED',
  ];
  const handlers = {};
  const recent = []; // 디버그 화면용 최근 이벤트. 저장하지 않는다.
  let depth = 0;

  function on(type, fn) {
    if (type !== '*' && !EVENTS.includes(type)) throw new Error('알 수 없는 이벤트: ' + type);
    (handlers[type] = handlers[type] || []).push(fn);
  }

  function emit(S, type, data) {
    if (!EVENTS.includes(type)) throw new Error('알 수 없는 이벤트: ' + type);
    if (depth >= 16) throw new Error('이벤트가 끝없이 이어진다: ' + type);
    const e = Object.assign({ type, t: S.W.time.t }, data);
    depth++;
    try {
      recent.push(e);
      if (recent.length > 120) recent.shift();
      (handlers[type] || []).forEach((fn) => fn(S, e));
      (handlers['*'] || []).forEach((fn) => fn(S, e));
    } finally {
      depth--;
    }
    return e;
  }

  return { EVENTS, on, emit, recent };
})();

if (typeof module !== 'undefined') module.exports = { Bus };
