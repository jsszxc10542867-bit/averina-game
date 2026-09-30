// 숲의 짐승. 플레이어가 보지 않는 동안에도 움직인다.
// thornback = 풀숲의 짐승 (눈이 셋, 등에 가시). 이름은 플레이어에게 보이지 않는다 ([???]).
// shade     = 밤에만 돌아다니는 정체불명의 무언가. 모습을 보여 주지 않는다.
const Creatures = (() => {
  const clamp = (n) => Math.max(0, Math.min(100, n));

  function createAll() {
    return {
      thornback: { id: 'thornback', kind: 'thornback', loc: 'downstream', alive: true, hp: 3, maxHp: 3,
        fear: 0, aggression: 70, caution: 40, hunger: 50, shy: false, fled: false,
        territory: ['downstream', 'deep', 'stream'], simT: Time.START },
      shade: { id: 'shade', kind: 'shade', loc: 'deep', alive: true, nocturnal: true,
        territory: ['clearing', 'stream', 'downstream', 'deep', 'hollow', 'hill'], simT: Time.START },
    };
  }

  // 그 장소에서 지금 활동 중인 짐승
  const at = (W, loc) => Object.values(W.creatures).filter((c) => c.alive && c.loc === loc && (!c.nocturnal || Time.dark(W.time.t)));

  function danger(c) {
    if (c.kind === 'shade') return 50;
    return c.shy ? 20 : clamp(40 + c.aggression * 0.3 + c.hunger * 0.2 - c.fear * 0.5);
  }

  // 한 시간마다 자리를 옮긴다
  function update(S, c, t, level) {
    const { W } = S;
    if (!c.alive) { c.simT = t; return; }
    const hours = Math.floor(t / 60) - Math.floor(c.simT / 60);
    c.simT = t;
    if (hours <= 0) return;
    if (c.kind === 'shade') {
      if (Time.dark(t)) c.loc = Rng.pick(W, c.territory);
      else c.loc = 'deep';
      return;
    }
    c.hunger = clamp(c.hunger + hours * 2);
    c.fear = clamp(c.fear - hours * 5);
    // 둘째 날 새벽 이후에는 숲 깊은 곳까지 돌아다닌다 (첫날은 대본 사건을 위해 깊은 곳에 가지 않는다)
    const range = t >= Time.at(2, 6) ? c.territory.concat(['deepwood']) : c.territory;
    if (!Time.dark(t)) c.loc = Rng.pick(W, range);
    // 사람을 덮친다 (둘째 날 새벽 이후, 배가 고프고 겁을 먹지 않았다면)
    if (t >= Time.at(2, 7) && !c.shy && c.hunger >= 60) {
      const prey = Npc.here(W, c.loc).find((n) => !n.location.hidden);
      if (prey && Rng.chance(W, 0.3)) Combat.creatureVsNpc(S, c, prey);
    }
  }

  // 풀숲의 짐승이 플레이어를 노리는가 (첫 번째 위험, 지시서 8절).
  // 제 영역(계곡 아래, 숲 안쪽)에 들어오면, 또는 첫날 해가 기울면 낯선 냄새를 쫓아온다. 비탈 위와 움푹한 곳까지는 오지 않는다.
  function engages(S) {
    const { W } = S;
    const c = W.creatures.thornback;
    if (!c || !c.alive || c.shy || W.worldFlags.seen.beast) return null;
    const loc = W.player.loc, t = W.time.t;
    if (Time.dark(t) || loc === 'hill' || loc === 'hollow') return null;
    const inTerritory = loc === 'downstream' || loc === 'deep';
    const hunting = Time.day(t) === 1 && Time.clock(t) >= 16 * 60 + 30;
    if (!inTerritory && !hunting) return null;
    c.loc = loc;
    return c.id;
  }

  // 밤에 걷다가 어둠 속의 무언가와 마주친다 (그것이 있는 곳을 지나면)
  function nightStrike(S, from, to) {
    const { W } = S;
    const s = W.creatures.shade;
    if (!s || !Time.dark(W.time.t) || !W.worldFlags.seen.night) return false;
    return s.loc === from || s.loc === to;
  }

  return { createAll, at, danger, update, engages, nightStrike };
})();

if (typeof module !== 'undefined') module.exports = { Creatures };
