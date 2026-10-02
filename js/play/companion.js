// 동행 — 스토리_재설계.md 6절 "함께 여행". 믿는 사람과 함께 다닌다. 함께 걸으면 가까워지고, 말을 배운다.
// 믿음이 무너지거나, 너무 위험한 곳으로 가려 하거나, 해야 할 일이 있으면 따라오지 않는다. 값은 RULES.companion.
const Companion = (() => {
  const J = (w, t) => w + Text.josa(w, t);
  const list = (W) => W.player.companions.map((id) => W.npcs[id]).filter(Boolean);

  function canAsk(S, n) {
    const { W } = S;
    if (!n.alive || W.player.companions.includes(n.id) || n.flags.caring) return false;
    const r = Rel.get(W, n.id, 'player');
    return r.trust >= RULES.companion.minTrust && r.hostility < 20;
  }

  function join(S, id) {
    const { W } = S;
    const n = W.npcs[id];
    if (!W.player.companions.includes(id)) W.player.companions.push(id);
    n.flags.follow = 'player';
    if (!Memory.has(n, 'player', 'travelled_with')) Memory.add(S, n, { type: 'travelled_with', subject: 'player' });
    Bus.emit(S, 'COMPANION_JOINED', { npcId: id });
  }

  function leave(S, id, why) {
    const { W } = S;
    const n = W.npcs[id];
    W.player.companions = W.player.companions.filter((x) => x !== id);
    if (n) n.flags.follow = null;
    Bus.emit(S, 'COMPANION_LEFT', { npcId: id, why: why || null });
  }

  // 함께 가자는 손짓. 할 일(일하는 시간의 일터)이 있거나 몸이 성치 않으면 거절한다.
  function ask(S, n) {
    const { W } = S;
    const who = Narrative.who(S, n);
    const sched = Schedule.current(n, W.time.t);
    if (sched && sched.act === 'work' && Npc.atHome(n)) return [`${J(who, '이가')} 고개를 젓는다. 하던 일 쪽을 턱으로 가리킨다.`];
    if (!Behavior.canTravel(n)) return [`${J(who, '이가')} 다친 곳을 가리키며 고개를 젓는다.`];
    join(S, n.id);
    return [`${J(who, '이가')} 잠시 망설이더니, 고개를 끄덕인다.`];
  }

  // 플레이어가 자리를 옮기면 곁에 있던 동행도 함께 간다. 너무 위험한 곳이면 따라오지 않는다.
  function onMove(S, from, to) {
    const { W } = S;
    const lines = [];
    list(W).forEach((n) => {
      const who = Narrative.who(S, n);
      if (!n.alive) { leave(S, n.id, 'dead'); return; }
      if (n.location.transit || n.location.loc !== from) return;
      const r = Rel.get(W, n.id, 'player');
      if (r.trust < RULES.companion.leaveTrust || r.hostility >= 30) {
        leave(S, n.id, 'distrust');
        lines.push(`${J(who, '은는')} 따라오지 않는다.`);
        return;
      }
      if (W.regions[Places.regionOf(to)].threat > RULES.companion.refuseDanger) {
        leave(S, n.id, 'danger');
        lines.push(`${J(who, '이가')} 그쪽을 보더니 걸음을 멈춘다. 가지 않겠다는 얼굴이다.`);
        return;
      }
      Npc.place(S, n, to);
      Rel.change(S, n.id, 'player', { familiarity: 2 }, 'walked_together', true);
      // 함께 걷다 보면 가끔 무언가를 가리키며 말을 가르쳐 준다
      if (Rng.chance(W, 0.3) && Lang.canTeach(S, n) && r.trust >= n.teach.minTrust) Lang.teach(S, n);
    });
    return lines;
  }

  return { list, canAsk, join, leave, ask, onMove };
})();

if (typeof module !== 'undefined') module.exports = { Companion };
