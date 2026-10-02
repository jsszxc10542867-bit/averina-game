// 지식 (통합 명세 19·20절). 플레이어가 아는 것과 NPC가 아는 것을 나눈다.
// 플레이어가 보지 못한 일은 화면에 나오지 않는다. 플레이어의 지식은 P.found에 쌓인다.
const Knowledge = (() => {
  // 장소를 아는 정도: 모름 → 멀리서 봄 → 가 봄 → 살펴봄 → 잘 앎
  const RANK = ['unknown', 'seen', 'visited', 'explored', 'known'];
  const KO = { seen: '멀리서 보았다', visited: '가 보았다', explored: '구석구석 살폈다', known: '잘 안다' };

  function create() { return { locations: {}, npcs: {}, events: {}, rumors: {}, incidents: {} }; }

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
    f[ev.id] = { type: ev.type, how, t: S.W.time.t, loc: ev.loc, subject: ev.data.subject || null, target: ev.data.target || null };
  }

  // 본 사건을 기록 화면의 문장으로 [임시: 스토리 담당이 다시 쓴다]. 플레이어가 아는 이름·겉모습으로만 부른다.
  // (s, t): 사건의 주체·대상을 부르는 말. 'player'이면 null. 문장이 없는 사건은 기록에 넣지 않는다.
  const J = (w, t) => w + Text.josa(w, t);
  const EVENT_NOTES = {
    helped: (s, t) => (!s ? `${J(t, '을를')} 도왔다.` : !t ? `${J(s, '이가')} 나를 도와주었다.` : `${J(s, '이가')} ${J(t, '을를')} 돕는 것을 보았다.`),
    threatened: (s, t) => (!s ? `${J(t, '을를')} 위협했다.` : !t ? `${J(s, '이가')} 나를 위협했다.` : `${J(s, '이가')} ${J(t, '을를')} 위협하는 것을 보았다.`),
    attacked: (s, t) => (!s ? `${J(t, '을를')} 공격했다.` : !t ? `${J(s, '이가')} 나를 공격했다.` : `${J(s, '이가')} ${J(t, '을를')} 공격하는 것을 보았다.`),
    beast_attack: (s, t) => (t ? `${J(s, '이가')} ${J(t, '을를')} 덮치는 것을 보았다.` : `${J(s, '이가')} 나를 덮쳤다.`),
    beast_encounter: (s) => `${J(s, '과와')} 마주쳤다.`,
    magic: (s) => s && `${J(s, '이가')} 손끝에서 빛을 내는 것을 보았다.`,
    theft: (s) => s && `${J(s, '이가')} 무언가를 몰래 챙기는 것을 보았다.`,
    rescued_player: (s, t) => t && `쓰러져 있던 나를 ${J(t, '이가')} 돌봐 주었다.`,
    player_worked: (s, t) => t && `${t}의 일을 거들었다.`,
    betrayal: (s, t) => (!t ? `${J(s, '이가')} 등을 돌리고 떠났다.` : `${J(s, '이가')} ${J(t, '을를')} 배신하는 것을 보았다.`),
    merchant_left: (s) => `${J(s, '이가')} 마을을 떠났다.`,
    found_dead: (s, t) => t && `${J(t, '이가')} 죽은 채 발견되었다.`,
    death_witnessed: (s, t) => t && `${J(t, '이가')} 숨을 거두는 것을 보았다.`,
  };
  // 플레이어가 그 존재를 부르는 말
  function called(S, id) {
    if (!id || id === 'player') return null;
    const n = S.W.npcs[id];
    if (n) { const f = S.P.found.npcs[id]; return f && f.name ? f.name : n.identity.desc; }
    if (S.W.creatures[id]) return S.P.knowledge.beast_seen ? '눈이 셋인 짐승' : '무언가';
    return '누군가';
  }
  // [{ id, t, how, text }] 시각 순. how: witnessed | trace | rumor
  function eventLines(S) {
    return Object.entries(S.P.found.events).map(([id, f]) => {
      const note = EVENT_NOTES[f.type];
      if (!note) return null;
      let { subject, target } = f;
      if (subject === undefined) { const ev = S.W.events.log.find((e) => e.id === id); if (!ev) return null; subject = ev.data.subject; target = ev.data.target; }
      const text = note(called(S, subject), called(S, target));
      return text ? { id, t: f.t, how: f.how, text } : null;
    }).filter(Boolean).sort((a, b) => a.t - b.t);
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

  return { RANK, KO, create, locState, location, meet, learnName, event, eventLines, rumor, npcKnows, npcLearn };
})();

if (typeof module !== 'undefined') module.exports = { Knowledge };
