// 지식 (통합 명세 19·20절). 플레이어가 아는 것과 NPC가 아는 것을 나눈다.
// 플레이어가 보지 못한 일은 화면에 나오지 않는다. 플레이어의 지식(P.found)은 되감아도 남는다.
const Knowledge = (() => {
  // 장소를 아는 정도: 모름 → 멀리서 봄 → 가 봄 → 살펴봄 → 잘 앎
  const RANK = ['unknown', 'seen', 'visited', 'explored', 'known'];
  const KO = { seen: '멀리서 보았다', visited: '가 보았다', explored: '구석구석 살폈다', known: '잘 안다' };

  function create() { return { locations: {}, npcs: {}, events: {}, rumors: {} }; }

  const locState = (P, loc) => P.found.locations[loc] || 'unknown';

  // 한 단계라도 더 알게 되면 기록한다 (거꾸로 잊지는 않는다)
  function location(S, loc, state) {
    const f = S.P.found.locations;
    const before = f[loc] || 'unknown';
    if (RANK.indexOf(state) <= RANK.indexOf(before)) return false;
    f[loc] = state;
    Bus.emit(S, 'LOCATION_DISCOVERED', { loc, state, before });
    return true;
  }

  // 만난 사람. 이름은 알게 되었을 때만 채운다.
  function meet(S, id) {
    const f = S.P.found.npcs;
    f[id] = Object.assign(f[id] || { name: null, first: S.W.time.t }, { last: S.W.time.t });
  }
  function learnName(S, id) { meet(S, id); S.P.found.npcs[id].name = S.W.npcs[id].identity.name; }

  // 플레이어가 사건을 어떻게 알았는가: witnessed(직접 봄) | trace(흔적) | rumor(소문)
  function event(S, ev, how) {
    const f = S.P.found.events;
    if (f[ev.id] && f[ev.id].how === 'witnessed') return;
    f[ev.id] = { type: ev.type, how, t: S.W.time.t, loc: ev.loc };
  }
  function rumor(S, rumorId, level) {
    const f = S.P.found.rumors;
    f[rumorId] = { level, t: S.W.time.t };
  }

  // NPC의 지식
  const npcKnows = (n, fact) => !!n.knowledge.facts[fact];
  function npcLearn(n, fact, data = true) { n.knowledge.facts[fact] = data; }

  // 플레이어가 움직이면 그곳을 "가 봤다"
  Bus.on('PLAYER_MOVED', (S, e) => { location(S, e.to, 'visited'); });
  // 플레이어가 곁에서 본 사건은 직접 안다
  Bus.on('WORLD_EVENT_CREATED', (S, e) => {
    if (e.witnesses.includes('player')) {
      const ev = S.W.events.log.find((x) => x.id === e.eventId);
      if (ev) event(S, ev, 'witnessed');
    }
    // 곁에 있던 NPC도 안다
    e.witnesses.filter((w) => w !== 'player').forEach((w) => {
      const n = S.W.npcs[w];
      if (n) n.knowledge.events[e.eventId] = { how: 'witnessed', t: S.W.time.t };
    });
  });

  return { RANK, KO, create, locState, location, meet, learnName, event, rumor, npcKnows, npcLearn };
})();

if (typeof module !== 'undefined') module.exports = { Knowledge };
