// 장면 우선순위 (지시문 5의 20절). 매 턴 이 표의 위에서부터 조건이 맞는 장면 하나만 띄운다.
// 순서는 표로 빼기 전 엔진(engine.js nextScene)의 순서 그대로다 — 지시문: "기존 시스템에 다른 우선순위가 있으면 기존 우선".
// kind는 지시문의 분류에 맞춘 이름이다:
//   story  = 1. 강제 스토리 이벤트       npc = 3. NPC 핵심 이벤트 (먼저 다가오는 사람)
//   danger = 기존 시스템의 위험(생존 우선). 지시문의 분류에는 없고, 짐승이 빛 장면보다 앞선다
//   2. 플레이어가 직접 발생시킨 이벤트는 표를 거치지 않는다: 고른 행동은 그 자리에서 처리된다.
//   region = 4. 지역 사건(sim/incidents.js)이 띄우는 장면. 대부분의 지역 사건은 장면 없이 화면 아래 덧붙는 줄(feed)과
//            소문으로 흘러들고, 장면이 필요할 때만 이 줄로 온다. 정해진 시각의 이야기보다 앞서지 않도록 맨 끝에 둔다.
//   5·6. 일상·반복 이벤트는 장면이 아니라 화면 아래 덧붙는 줄과 소문이다.
// 새 사건 종류(첫 지역 사건 등)는 이 표에 줄을 끼운다. pick(S, peek): 장면 이름 또는 null. peek이면 대기열을 건드리지 않는다.
const SceneOrder = (() => {
  const liaAtHollow = (W) => Npc.at(W, 'lia', 'hollow');
  const TWILIGHT_PLACES = ['clearing', 'deep', 'stream', 'downstream'];

  const TABLE = [
    { id: 'scheduled', kind: 'story', note: '정해진 시각의 이야기가 예약한 장면 (밤의 목소리, 상태창). 마법 장면은 리아 장면 안에서 열린다',
      pick(S, peek) {
        const pend = S.W.worldFlags.pending;
        const i = pend.findIndex((p) => !p.startsWith('magic'));
        if (i < 0) return null;
        return peek ? pend[i] : pend.splice(i, 1)[0];
      } },
    { id: 'girl', kind: 'story', note: '움푹한 곳의 리아',
      pick: (S) => (S.W.player.loc === 'hollow' && liaAtHollow(S.W) ? 'girl' : null) },
    { id: 'arrival', kind: 'story', note: '숲 가장자리에 처음 닿음',
      pick: (S) => (S.W.player.loc === 'edge' && !S.W.worldFlags.seen.arrival ? 'arrival' : null) },
    // 처음 보는 사람, 누군가를 찾는 사람, 나를 적대하는 사람은 먼저 다가온다 (만난 지 60분 안이면 다시 오지 않는다).
    // 이미 아는 사람에게는 내가 다가간다 (선택지)
    { id: 'approach', kind: 'npc', note: '먼저 다가오는 사람',
      pick(S) {
        const { W } = S;
        const loc = W.player.loc;
        const n = Npc.here(W, loc).find((x) => !x.location.hidden && !(x.id === 'lia' && loc === 'hollow')
          && (!Memory.has(x, 'player', 'met') || Goals.get(x, 'search') || Rel.get(W, x.id, 'player').hostility >= 50)
          && !(x.flags.metAt != null && W.time.t - x.flags.metAt < 60));
        return n ? 'meet:' + n.id : null;
      } },
    { id: 'beast', kind: 'danger', note: '짐승이 덤벼듦',
      pick: (S) => (Creatures.engages(S) ? 'beast' : null) },
    { id: 'light', kind: 'story', note: '해 질 녘의 빛 (한 번)',
      pick: (S) => (!S.W.worldFlags.seen.light && Time.band(S.W.time.t) === 'evening' && TWILIGHT_PLACES.includes(S.W.player.loc) ? 'light' : null) },
    { id: 'teaser', kind: 'story', note: '둘째 날 아침, 바람에 실린 피 냄새 (리아를 아직 만나지 않았을 때)',
      pick: (S) => (liaAtHollow(S.W) && S.W.worldFlags.day2Acts >= 3 && !S.W.worldFlags.seen.teaser && !S.W.npcs.lia.flags.met ? 'teaser' : null) },
    { id: 'incident', kind: 'region', note: '지역 사건이 띄우는 장면 (시작마을.md 8~12절)',
      pick: (S, peek) => Incidents.nextScene(S, peek) },
  ];

  // 지금 띄울 장면 하나 (예약된 장면은 꺼낸다)
  function next(S) {
    for (const row of TABLE) {
      const sc = row.pick(S, false);
      if (sc) return sc;
    }
    return null;
  }

  // 지금 조건이 맞는 줄 전부, 표의 순서대로 (디버그·테스트용. 아무것도 바꾸지 않는다)
  const candidates = (S) => TABLE.map((row) => ({ id: row.id, kind: row.kind, scene: row.pick(S, true) })).filter((x) => x.scene);

  return { TABLE, next, candidates };
})();

if (typeof module !== 'undefined') module.exports = { SceneOrder };
