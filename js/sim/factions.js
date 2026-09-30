// 국가와 세력, 정치 (통합 명세 26절). 먼 곳의 일이라 하루 단위로 추상 계산한다.
// 먼 곳에서 벌어진 큰 사건은 먼 도시에 "소식"으로 쌓이고, 그곳을 오가는 사람(행상)이 소문으로 실어 온다.
const Factions = (() => {
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const clone = (o) => JSON.parse(JSON.stringify(o));

  function create() {
    return Object.fromEntries(Object.entries(FACTION_DEFS).map(([id, d]) => [id, Object.assign({ id }, clone(d))]));
  }
  function createPolitics() {
    return { relations: clone(FACTION_RELATIONS), base: clone(FACTION_RELATIONS), tension: 20, news: [] };
  }

  function rel(W, a, b) {
    const R = W.politics.relations;
    return R[`${a}|${b}`] || R[`${b}|${a}`];
  }

  // 그날 먼 곳에서 벌어질 수 있는 일의 가능성
  function odds(W) {
    const day = Time.day(W.time.t);
    return {
      war_tension: rel(W, 'lumeris', 'caelvar').hostility / 700 + W.politics.tension / 1000,
      trade_boom: rel(W, 'lumeris', 'southern_confederation').trade / 1400,
      anomaly: 0.03 + day * 0.004, // 세계관 19절: 이상현상이 늘고 있다
      beasts_rising: 0.03 + W.politics.tension / 1500,
    };
  }

  // 하루에 한 번
  function daily(S) {
    const { W } = S;
    const P = W.politics;
    // 관계는 사건이 없으면 원래 자리로 조금씩 돌아간다
    Object.entries(P.relations).forEach(([k, r]) => {
      Object.keys(r).forEach((ax) => { r[ax] = clamp(r[ax] + (P.base[k][ax] - r[ax]) * 0.05); });
    });
    P.tension = clamp(P.tension + (Rng.next(W) - 0.5) * 2);
    Object.entries(odds(W)).forEach(([type, p]) => { if (Rng.chance(W, p)) trigger(S, type); });
    // 먼 도시에 있는 사람은 그곳의 소식을 듣는다
    Object.values(W.npcs).filter((n) => n.alive && !n.location.transit && n.location.loc === 'far_town').forEach((n) => pickUpNews(S, n));
  }

  // 먼 곳의 큰 사건이 벌어진다 (디버그 화면에서도 부른다)
  function trigger(S, type) {
    const { W } = S;
    const P = W.politics;
    const def = WORLD_EVENT_TYPES[type];
    if (!def) throw new Error('알 수 없는 세계 사건: ' + type);
    const ev = WorldEvents.record(S, type, { loc: 'far_town', witnesses: [], distant: true, data: { place: def.place } });
    if (type === 'war_tension') {
      const r = rel(W, 'lumeris', 'caelvar');
      r.hostility = clamp(r.hostility + 6); r.trade = clamp(r.trade - 4); r.diplomacy = clamp(r.diplomacy - 3);
      P.tension = clamp(P.tension + 5);
    } else if (type === 'trade_boom') {
      const r = rel(W, 'lumeris', 'southern_confederation');
      r.trade = clamp(r.trade + 5);
    } else if (type === 'beasts_rising') {
      Regions.raiseThreat(S, 'road', 10);
    }
    P.news.push({ type, event: ev.id, t: W.time.t, rumor: def.rumor });
    if (P.news.length > 20) P.news.shift();
    return ev;
  }

  function pickUpNews(S, n) {
    const { W } = S;
    W.politics.news.forEach((x) => {
      if (x.rumorId && n.knowledge.rumors[x.rumorId]) return;
      if (!x.rumorId) x.rumorId = Rumor.create(S, [n.id], { type: x.rumor, place: 'far_town', event: x.event }).id;
      else n.knowledge.rumors[x.rumorId] = { level: 1, from: 'far_town', t: W.time.t };
    });
  }

  return { create, createPolitics, rel, odds, daily, trigger, pickUpNews };
})();

if (typeof module !== 'undefined') module.exports = { Factions };
