// 사람과 사람 사이에서 벌어지는 일: 돕기, 위협, 공격, 첫 만남, 배신.
// 여기서는 "무슨 일이 있었다"만 알린다. 관계·기억·소문·세계 사건은 이벤트 버스를 듣고 각자 바뀐다 (통합 명세 33절).
const Social = (() => {
  const locOf = (S, id) => (id === 'player' ? S.W.player.loc : S.W.npcs[id].location.loc);

  // kind: water | herb | treat | heal | food ...  delta: 장면이 정한 관계 변화 (없으면 기본값)
  function help(S, helperId, npcId, kind, delta) {
    Bus.emit(S, 'NPC_HELPED', { npcId, helperId, kind, delta: delta || null });
    if (helperId === 'player') Bus.emit(S, 'PLAYER_HELPED_NPC', { npcId, kind });
    WorldEvents.record(S, 'helped', { loc: locOf(S, npcId), actors: [helperId, npcId],
      data: { subject: helperId, target: npcId, kind } });
  }

  function threaten(S, byId, npcId, delta) {
    const n = S.W.npcs[npcId];
    Bus.emit(S, 'NPC_THREATENED', { npcId, by: byId, delta: delta || null });
    WorldEvents.record(S, 'threatened', { loc: n.location.loc, actors: [byId, npcId], data: { subject: byId, target: npcId } });
    Behavior.interrupt(n);
  }

  function attack(S, byId, npcId, o = {}) {
    const n = S.W.npcs[npcId];
    const loc = n.location.loc;
    if (byId === 'player') Bus.emit(S, 'PLAYER_ATTACKED', { targetId: npcId, weapon: o.weapon || null });
    Bus.emit(S, 'NPC_ATTACKED', { npcId, by: byId, weapon: o.weapon || null, damage: o.damage || 0, loc });
    WorldEvents.record(S, 'attacked', { loc, actors: [byId, npcId], data: { subject: byId, target: npcId, weapon: o.weapon || null } });
    Behavior.interrupt(n);
  }

  // 처음 마주친다. 소문으로 들은 것이 있으면 첫인상에 이미 들어가 있다.
  function meet(S, npcId) {
    const n = S.W.npcs[npcId];
    Knowledge.meet(S, npcId);
    n.flags.lastSawPlayer = S.W.time.t;
    if (Memory.has(n, 'player', 'met')) return false;
    Rel.get(S.W, npcId, 'player');
    Bus.emit(S, 'NPC_MET_PLAYER', { npcId, loc: n.location.loc });
    WorldEvents.record(S, 'stranger_seen', { loc: n.location.loc, actors: ['player', npcId], witnesses: [npcId, 'player'],
      data: { subject: 'player', target: npcId } });
    Behavior.interrupt(n);
    return true;
  }

  // 함께 가던 사람이 등을 돌린다: 가진 것을 챙겨 떠난다
  function betray(S, n, targetId) {
    const { W } = S;
    let took = null;
    if (targetId === 'player') {
      const me = W.player;
      took = Object.keys(me.inv).sort((a, b) => (ITEM_DEFS[b] ? ITEM_DEFS[b].value : 0) - (ITEM_DEFS[a] ? ITEM_DEFS[a].value : 0))[0] || null;
      if (took) { Player.take(me, took); n.inventory[took] = (n.inventory[took] || 0) + 1; }
      W.worldFlags.feed.push(`${Narrative.who(S, n)}${Text.josa(Narrative.who(S, n), '이가')} 갑자기 등을 돌린다. 주머니가 가볍다.`);
    } else {
      const t = W.npcs[targetId];
      const m = Math.floor(t.money / 2);
      t.money -= m; n.money += m; took = 'money';
      Memory.add(S, t, { type: 'betrayed_by', subject: n.id });
      Rel.change(S, targetId, n.id, { trust: -60, resentment: 60, hostility: 40 }, 'betrayed');
    }
    n.flags.follow = null;
    WorldEvents.record(S, 'betrayal', { loc: n.location.loc, actors: [n.id, targetId], data: { subject: n.id, target: targetId, took } });
    Npc.startMove(S, n, n.location.home);
  }

  return { help, threaten, attack, meet, betray };
})();

if (typeof module !== 'undefined') module.exports = { Social };
