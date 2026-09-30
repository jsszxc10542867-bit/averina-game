// 소문 (통합 명세 18절). 사건은 사람의 입을 거쳐 퍼지고, 거칠수록 변한다.
// W.rumors[id] = { id, type, subject, target, place, event, origin, t, importance, detail }
// 들은 사람: n.knowledge.rumors[id] = { level, from, t }
//   level 0 = 직접 겪은 사람의 이야기, 1 = 전해 들은 이야기(흐려짐), 2 = 부풀려진 이야기
const Rumor = (() => {
  const clamp = (n) => Math.max(0, Math.min(100, n));
  const IMPORTANCE = {
    died: 95, attacked: 90, missing: 75, threatened: 70, helped: 60, beast_seen: 55, theft: 50,
    stranger_seen: 40, war_tension: 45, beasts_rising: 50, anomaly: 40, trade_boom: 35,
  };

  // 사건 종류 → 소문 종류
  const FROM_EVENT = {
    helped: 'helped', threatened: 'threatened', attacked: 'attacked', stranger_seen: 'stranger_seen',
    beast_attack: 'beast_seen', missing: 'missing', found_dead: 'died', death_witnessed: 'died', theft: 'theft',
  };

  function create(S, holderIds, o) {
    const { W } = S;
    const id = `r${W.run}-${++W.seq}`;
    const r = {
      id, type: o.type, subject: o.subject || null, target: o.target || null, place: o.place || null,
      event: o.event || null, origin: holderIds[0] || null, t: W.time.t,
      importance: o.importance != null ? o.importance : (IMPORTANCE[o.type] || 30), detail: o.detail || {},
    };
    W.rumors[id] = r;
    holderIds.forEach((h) => {
      const n = W.npcs[h];
      if (n) n.knowledge.rumors[id] = { level: 0, from: null, t: W.time.t };
    });
    Bus.emit(S, 'RUMOR_CREATED', { rumorId: id, kind: o.type, holders: holderIds });
    return r;
  }

  const held = (n, id) => !!n.knowledge.rumors[id];
  // a가 b에게 들려줄 새 이야기가 있는가
  const hasNews = (W, a, b) => Object.keys(a.knowledge.rumors).some((id) => !b.knowledge.rumors[id] && W.rumors[id] && W.rumors[id].importance >= 20);

  // teller가 listener에게 가장 중요한 새 이야기를 하나 들려준다. 전해질 때마다 흐려지고, 가끔 부풀려진다.
  function exchange(S, teller, listener) {
    const { W } = S;
    const news = Object.entries(teller.knowledge.rumors)
      .filter(([id]) => !listener.knowledge.rumors[id] && W.rumors[id])
      .map(([id, h]) => ({ r: W.rumors[id], h }))
      .sort((a, b) => b.r.importance - a.r.importance);
    if (!news.length) return null;
    const trust = (Rel.peek(W, teller.id, listener.id) || {}).trust || 0;
    if (!Rng.chance(W, teller.personality.sociability / 100 * (0.6 + trust / 250))) return null;
    const { r, h } = news[0];
    let level = h.level === 0 ? 1 : h.level;
    const distort = 0.3 + (100 - teller.personality.honesty) / 250 + teller.personality.impulsiveness / 400;
    if (h.level >= 1 && Rng.chance(W, distort)) level++;
    level = Math.min(2, level);
    listener.knowledge.rumors[r.id] = { level, from: teller.id, t: W.time.t };
    apply(S, listener, r, level);
    Bus.emit(S, 'RUMOR_SPREAD', { rumorId: r.id, from: teller.id, to: listener.id, level });
    return { rumor: r, level };
  }

  // 소문을 들은 사람이 달라진다: 이방인에 대한 인상, 누군가를 잃은 슬픔, 숲이 위험하다는 두려움
  function apply(S, n, r, level) {
    const { W } = S;
    const strong = level >= 2 ? 1.5 : 1;
    if (r.subject === 'player') {
      const aff = r.target ? ((Rel.peek(W, n.id, r.target) || {}).affection || 0) : 0;
      const d = {
        helped: level >= 2 ? { trust: 4, suspicion: -6, respect: 6, fear: 4 } : { trust: 6, suspicion: -8 },
        threatened: { suspicion: 15 * strong, fear: 8 * strong, hostility: 8 * strong + aff * 0.3 },
        attacked: { suspicion: 20 * strong, fear: 15 * strong, hostility: 20 * strong + aff * 0.5, resentment: aff * 0.4 },
        stranger_seen: { suspicion: level >= 2 ? 10 : 5 },
      }[r.type];
      if (d) Rel.change(S, n.id, 'player', d, 'rumor:' + r.type, true);
    }
    if (r.type === 'died' && r.target) {
      const aff = (Rel.peek(W, n.id, r.target) || {}).affection || 0;
      if (aff >= 30 && !Memory.has(n, r.target, 'lost')) {
        Memory.add(S, n, { type: 'lost', subject: r.target, detail: r.detail.cause || null });
        n.mental.mood = clamp(n.mental.mood - aff * 0.6);
        n.mental.stress = clamp(n.mental.stress + 30);
      }
      if (r.detail.by === 'player' && level <= 1) Rel.change(S, n.id, 'player', { hostility: 30 + aff * 0.5, fear: 20, resentment: aff * 0.6 }, 'rumor:died', true);
      if (Places.regionOf(n.location.loc) === 'village') Regions.raiseThreat(S, 'village', 10);
      Knowledge.npcLearn(n, 'dead:' + r.target);
    }
    if (r.type === 'missing' && r.target) {
      const aff = (Rel.peek(W, n.id, r.target) || {}).affection || 0;
      n.mental.stress = clamp(n.mental.stress + 5 + aff * 0.1);
    }
    if ((r.type === 'beast_seen' || r.type === 'beasts_rising') && Places.regionOf(n.location.loc) === 'village') {
      Regions.raiseThreat(S, 'village', r.type === 'beast_seen' ? 8 * strong : 5);
    }
    if (r.type === 'war_tension') n.mental.stress = clamp(n.mental.stress + 3);
  }

  // 말로 옮긴다 (대사 표기 그대로. 듣는 사람의 이해도에 따라 가려진다)
  function speech(W, r, level) {
    const tpl = RUMOR_SPEECH[r.type];
    if (!tpl) return null;
    const who = (id) => {
      if (!id) return '그 사람';
      if (id === 'player') return (level === 0 && r.detail.actorName) || '이방인';
      const n = W.npcs[id];
      return n ? (n.identity.name || n.identity.desc) : id;
    };
    return tpl[Math.min(level, tpl.length - 1)].replace(/\{actor\}/g, who(r.subject)).replace(/\{target\}/g, who(r.target));
  }
  // 표기를 걷어 낸 한국어 (디버그 화면과 NPC 사이의 기록용)
  const plain = (W, r, level) => { const s = speech(W, r, level); return s ? s.replace(/\[\[([^:\]|]+)(?::\d+)?(?:\|[^\]]+)?\]\]/g, '$1') : r.type; };

  // 하루마다: 오래되고 사소한 소문은 잊힌다
  function daily(S) {
    const { W } = S;
    Object.values(W.npcs).forEach((n) => {
      Object.entries(n.knowledge.rumors).forEach(([id, h]) => {
        const r = W.rumors[id];
        if (!r || (W.time.t - h.t > 10 * Time.DAY && r.importance < 50)) delete n.knowledge.rumors[id];
      });
    });
  }

  // ---------- 사건이 소문이 된다 ----------
  // 곁에서 겪거나 본 NPC가 첫 번째 이야기꾼이 된다
  Bus.on('WORLD_EVENT_CREATED', (S, e) => {
    const type = FROM_EVENT[e.kind];
    if (!type) return;
    const ev = S.W.events.log.find((x) => x.id === e.eventId);
    if (!ev) return;
    const holders = e.witnesses.filter((w) => w !== 'player' && S.W.npcs[w] && S.W.npcs[w].alive);
    if (!holders.length) return;
    // 같은 사람을 두고 "낯선 이를 봤다"는 이야기는 한 번만
    if (type === 'stranger_seen' && holders.every((h) => Object.keys(S.W.npcs[h].knowledge.rumors)
      .some((id) => S.W.rumors[id] && S.W.rumors[id].type === 'stranger_seen' && S.W.rumors[id].subject === 'player'))) return;
    const d = ev.data || {};
    const detail = { cause: d.cause || null, by: d.by || null, kind: d.kind || null };
    // 이름을 주고받았다면, 직접 겪은 사람의 이야기에는 이름이 들어간다
    const knower = holders.map((h) => S.W.npcs[h]).find((n) => n.knowledge.facts.playerName);
    if (knower) detail.actorName = S.P.name;
    create(S, holders, {
      type, subject: d.subject || (ev.actors.includes('player') ? 'player' : null), target: d.target || null,
      place: ev.loc, event: ev.id, detail,
    });
  });

  return { IMPORTANCE, create, held, hasNews, exchange, apply, speech, plain, daily };
})();

if (typeof module !== 'undefined') module.exports = { Rumor };
