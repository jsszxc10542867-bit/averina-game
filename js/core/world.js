// 세계 상태 (통합 명세 3절)와 월드 틱 (5절). 세계 상태가 곧 진실이다: 모든 시스템은 여기를 바꾼다.
const World = (() => {
  // 씨앗이 늘 같다: 되감으면 같은 세계, 같은 하늘에서 다시 시작한다. 달라지는 것은 플레이어의 선택뿐이다.
  const SEED = 20260929;

  function create(run = 0) {
    const W = {
      v: 2, run, seq: 0, rng: SEED,
      time: { t: Time.START },
      weather: Weather.create(SEED ^ 0x5bd1e995),
      player: Player.create(),
      npcs: Npc.createAll(),
      creatures: Creatures.createAll(),
      locations: Places.createState(),
      regions: Regions.create(),
      factions: Factions.create(),
      politics: Factions.createPolitics(),
      relationships: {},
      events: { log: [], active: {}, scheduled: WorldEvents.initialSchedule() },
      rumors: {},
      economy: Economy.create(),
      // 장면 진행 표시: seen(한 번만 나오는 장면), counts(반복 행동 횟수), done(장소에서 해 본 일),
      // pending(곧 벌어질 장면), notes(몸의 알림), feed(곁에서 벌어진 일), end(1장의 끝)
      worldFlags: { seen: {}, counts: {}, done: {}, pending: [], notes: [], feed: [], end: null, day2Acts: 0 },
      history: [],
    };
    Rel.seed(W);
    return W;
  }

  // min분 동안 세계를 흘린다. opt: { rest, sleep, move, fight, story }
  // 결과: { spent, lines(대본 사건), body(몸의 느낌) }. 밤의 목소리처럼 대본 사건이 시간을 멈추면 spent < min
  function tick(S, min, opt = {}) {
    const { W } = S;
    const from = W.time.t;
    let to = from + Math.max(0, min);
    const story = opt.story === false ? { lines: [], stopAt: null } : Story.clock(S, from, to);
    if (story.stopAt != null) to = story.stopAt;
    Regions.updateLevels(S);
    const body = [];
    let t = from;
    while (t < to) {
      const prev = t;
      t = Math.min(to, t + Regions.STEP.active);
      W.time.t = t;
      Weather.update(S, prev);                       // updateWeather
      body.push(...Player.update(S, t - prev, opt)); // updatePlayer
      Regions.simulate(S, t);                        // updateNPCs, updateCreatures (지역마다 정밀도가 다르다)
      WorldEvents.process(S, prev);                  // processEvents
      if (Math.floor(prev / 60) !== Math.floor(t / 60)) hourly(S);
      if (Time.crossed(prev, t, 6)) daily(S);
    }
    W.time.t = to;
    return { spent: to - from, lines: story.lines, body };
  }

  // 한 시간마다: 관계의 감정이 가라앉고(processRelationships), 흔적이 사라지고(updateLocations), 마력이 돌아온다
  function hourly(S) {
    Rel.process(S);
    Places.update(S);
    Magic.regen(S);
  }

  // 하루마다 (새벽 6시): 지역의 위협, 세력(updateFactions), 경제(updateEconomy), 기억과 소문의 망각, 기록(recordHistory)
  function daily(S) {
    Regions.daily(S);
    Factions.daily(S);
    Economy.daily(S);
    Memory.decay(S);
    Rumor.daily(S);
    recordHistory(S);
  }

  function recordHistory(S) {
    const { W } = S;
    const v = W.economy.markets.village_square;
    W.history.push({
      day: Time.day(W.time.t),
      dead: Object.values(W.npcs).filter((n) => !n.alive).map((n) => n.id),
      events: W.events.log.length,
      rumors: Object.keys(W.rumors).length,
      villageThreat: Math.round(W.regions.village.threat),
      bread: v.price.bread,
      tension: Math.round(W.politics.tension),
    });
    if (W.history.length > 60) W.history.shift();
  }

  return { SEED, create, tick, hourly, daily };
})();

if (typeof module !== 'undefined') module.exports = { World };
