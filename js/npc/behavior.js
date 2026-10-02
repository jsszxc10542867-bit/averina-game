// NPC 행동 판단 (통합 명세 6~9절). 생성형 AI는 쓰지 않는다. 규칙과 점수로만 움직인다.
// 무작위가 아니라 욕구·목표·성격·일정·관계·위험을 점수로 따져 고른다.
// 행동마다: avail(n, c) 할 수 있는가 / score(n, c) 얼마나 하고 싶은가 / start(S, n, c) 시작 → { min, data }
//          tick(S, n, c, dt) 하는 동안 / end(S, n, c) 끝날 때
// c = 지금 상황 (context): 장소, 곁에 있는 사람과 짐승, 플레이어, 위협, 일정, 어둠
const Behavior = (() => {
  const REPLAN = 30; // 긴 행동을 하는 중에도 30분마다 다시 판단한다
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

  // ---------- 도구 ----------
  const foodOf = (n) => Object.keys(n.inventory).find((k) => n.inventory[k] > 0 && ITEM_DEFS[k]
    && ITEM_DEFS[k].category === 'food' && !ITEM_DEFS[k].properties.poison);
  const medicineOf = (n) => Object.keys(n.inventory).find((k) => n.inventory[k] > 0 && ITEM_DEFS[k] && ITEM_DEFS[k].properties.stopsBleeding);
  const weaponOf = (n) => Object.keys(n.inventory).filter((k) => n.inventory[k] > 0 && ITEM_DEFS[k] && ITEM_DEFS[k].properties.weapon)
    .sort((a, b) => ITEM_DEFS[b].properties.weapon.dmg - ITEM_DEFS[a].properties.weapon.dmg)[0] || null;
  function useItem(n, k) { n.inventory[k]--; if (n.inventory[k] <= 0) delete n.inventory[k]; }
  const HERB_JOBS = ['herbalist', 'herbalist_apprentice']; // 숲에서 약초를 캐는 사람
  const canTravel = (n) => n.physical.shock <= 20 && n.physical.health >= 15 && n.needs.fatigue < 95 && Condition.canTravel(n);
  const hasWater = (n, loc) => Places.has(loc, 'water') || (n.inventory.waterskin > 0);

  function context(S, n, now) {
    const { W } = S;
    const loc = n.location.loc;
    const transit = n.location.transit;
    const others = transit ? [] : Npc.here(W, loc).filter((o) => o !== n);
    const playerHere = !transit && W.player.loc === loc && W.player.hp > 0 && !W.worldFlags.end;
    const creatures = transit ? [] : Creatures.at(W, loc);
    const relP = Rel.peek(W, n.id, 'player');
    // 위협: 곁의 짐승, 곁에 있는 두려운 사람
    let threat = creatures.reduce((m, x) => Math.max(m, Creatures.danger(x)), 0);
    if (playerHere && relP) threat = Math.max(threat, relP.hostility >= 50 ? 80 : relP.fear * 0.8);
    others.forEach((o) => { const r = Rel.peek(W, n.id, o.id); if (r && r.hostility >= 60) threat = Math.max(threat, 60); });
    return {
      S, W, now, loc, transit, others, playerHere, creatures, relP, threat,
      sched: Schedule.current(n, now), dark: Time.dark(now), band: Time.band(now),
      region: Places.regionOf(loc), home: n.location.home,
    };
  }

  // 누군가 도움이 필요한가 (다쳐서 피를 흘리는 사람)
  function needyHere(n, c) {
    const npc = c.others.find((o) => o.physical.bleed > 0 && !(Rel.peek(c.W, n.id, o.id) || {}).hostility);
    if (npc) return { id: npc.id, npc };
    if (c.playerHere && Player.bleeding(c.W) && c.relP && c.relP.trust >= 40 && c.relP.hostility < 20) return { id: 'player' };
    return null;
  }

  // 먼저 떠난 플레이어를 얼마나 기다려 줄까 (믿는 만큼, 참을성만큼)
  const waitLimit = (n) => 60 + n.personality.patience * 1.5;

  // ---------- 행동 ----------
  const A = {
    wait: {
      avail: () => true,
      score: (n) => 8 + n.personality.patience * 0.1,
      start: () => ({ min: 15 }),
    },
    rest: {
      avail: () => true,
      score: (n) => n.needs.fatigue * 0.5 + n.needs.health * 0.4 + (n.physical.shock > 20 ? 30 : 0),
      start: (S, n, c) => ({ min: 30, data: { hidden: Places.has(c.loc, 'shelter') || Places.has(c.loc, 'roots') } }),
      tick: (S, n, c, d) => {
        n.needs.fatigue = clamp(n.needs.fatigue - 0.12 * d);
        n.physical.shock = Math.max(0, n.physical.shock - 0.1 * d);
      },
    },
    sleep: {
      // 행상은 길 위에서도 아무 데나 몸을 누인다
      avail: (n, c) => c.threat < 30 && (c.loc === c.home || Places.has(c.loc, 'shelter') || n.identity.occupation === 'peddler'),
      score: (n, c) => n.needs.fatigue * 0.8 + (c.dark ? 30 : -30) + (c.sched && c.sched.act === 'sleep' ? 40 : 0) - c.threat,
      start: () => ({ min: 60 }),
      tick: (S, n, c, d) => { n.needs.fatigue = clamp(n.needs.fatigue - 0.3 * d); n.mental.stress = clamp(n.mental.stress - 0.05 * d); },
    },
    eat: {
      avail: (n, c) => !!foodOf(n) || (Economy.open(c.W, c.loc) && n.money >= Economy.priceOf(c.W, c.loc, 'bread')),
      score: (n, c) => n.needs.hunger * 1.1 - 20 + (c.sched && c.sched.act === 'eat' ? 30 : 0),
      start: (S, n, c) => {
        let k = foodOf(n);
        if (k) useItem(n, k);
        else if (Economy.buy(S, n, c.loc, 'bread', 1)) k = 'bread'; // 사서 그 자리에서 먹는다
        if (k) n.needs.hunger = clamp(n.needs.hunger + (ITEM_DEFS[k].effects.hunger || -30));
        return { min: 20 };
      },
    },
    drink: {
      avail: (n, c) => hasWater(n, c.loc),
      score: (n) => n.needs.thirst * 1.2 - 15,
      start: (S, n, c) => { n.needs.thirst = Places.has(c.loc, 'water') ? 0 : clamp(n.needs.thirst - 60); return { min: 5 }; },
    },
    work: {
      avail: (n, c) => !!(c.sched && c.sched.act === 'work' && c.loc === c.sched.at),
      score: (n, c) => 55 + n.needs.money * 0.2 - n.needs.fatigue * 0.3 - c.threat * 0.5,
      start: () => ({ min: 60 }),
      tick: (S, n, c, d) => {
        const occ = n.identity.occupation;
        if (occ === 'guard') { n.money += d / 60 * 1.5; c.W.regions.village.alert = Math.max(c.W.regions.village.alert, 30); }
        else if (occ === 'herbalist') {
          // 약초를 달여 천 조각(약)을 만든다
          n.flags.brew = (n.flags.brew || 0) + d;
          if (n.flags.brew >= 120 && n.inventory.herb > 0) { n.flags.brew = 0; useItem(n, 'herb'); n.inventory.bandage = (n.inventory.bandage || 0) + 1; }
        } else if (occ === 'hunter') n.money += d / 60;
      },
    },
    gather: {
      avail: (n, c) => !c.dark && ((c.sched && c.sched.act === 'gather' && c.loc === c.sched.at) || (c.region === 'forest' && HERB_JOBS.includes(n.identity.occupation))),
      score: (n, c) => 50 - c.threat * 0.6 - c.W.regions[c.region].threat * 0.3 + (c.sched && c.sched.act === 'gather' ? 15 : 0),
      start: () => ({ min: 60 }),
      tick: (S, n, c, d) => {
        // 위험하다는 소문이 돌면 멀리까지 나가지 않아 덜 캔다. 숲에서는 숲의 위험이 채집을 줄인다.
        // 리아는 채집 범위(약재 부족 사건)에 따라 캐는 양이 다르다 (RULES.herbShortage.rangeYield)
        const fear = c.region === 'forest' ? c.W.regions.forest.threat / 100 : c.W.regions.village.threat / 120;
        const range = n.flags.range ? RULES.herbShortage.rangeYield[n.flags.range] || 1 : 1;
        const p = (d / 60) * RULES.herbShortage.gatherRate * range * (1 - fear);
        if (Rng.chance(c.W, p)) n.inventory.herb = (n.inventory.herb || 0) + 1;
      },
    },
    hunt: {
      avail: (n, c) => n.identity.occupation === 'hunter' && c.region === 'forest' && !c.dark && !!weaponOf(n) && !n.physical.injured && n.away,
      score: (n, c) => 45 + n.needs.hunger * 0.2 + n.personality.bravery * 0.1 - c.threat * 0.5,
      start: () => ({ min: 60 }),
      tick: (S, n, c, d) => { if (Rng.chance(c.W, d / 60 * 0.2)) n.inventory.dried_meat = (n.inventory.dried_meat || 0) + 1; },
    },
    trade: {
      avail: (n, c) => Economy.open(c.W, c.loc) && Economy.merchantAt(c.W, c.loc) !== n.id && Economy.hasBusiness(c.W, n, c.loc),
      score: (n, c) => 25 + n.personality.greed * 0.2 + n.needs.money * 0.3
        + ((Goals.get(n, 'trade_trip') || {}).target === c.loc && !n.flags.tripDone ? 60 : 0),
      start: (S, n, c) => { Economy.trade(S, n, c.loc); return { min: 30 }; },
    },
    talk: {
      avail: (n, c) => c.others.some((o) => !(o.currentAction && o.currentAction.type === 'sleep')),
      score: (n, c) => n.needs.social * 0.7 + n.personality.sociability * 0.25 - c.threat
        + (c.others.some((o) => Rumor.hasNews(c.W, n, o)) ? 25 : 0) + (c.sched && c.sched.act === 'social' ? 25 : 0),
      start: (S, n, c) => {
        const awake = c.others.filter((o) => !(o.currentAction && o.currentAction.type === 'sleep'));
        // 새 소식이 있는 상대, 그다음 가까운 상대에게 말을 건다
        awake.sort((a, b) => (Rumor.hasNews(c.W, n, b) - Rumor.hasNews(c.W, n, a))
          || ((Rel.peek(c.W, n.id, b.id) || {}).familiarity || 0) - ((Rel.peek(c.W, n.id, a.id) || {}).familiarity || 0));
        return { min: 20, data: { with: awake[0].id } };
      },
      end: (S, n, c) => {
        const o = S.W.npcs[n.currentAction.data.with];
        if (!o || !o.alive || o.location.loc !== n.location.loc || o.location.transit) return;
        n.needs.social = clamp(n.needs.social - 35);
        o.needs.social = clamp(o.needs.social - 20);
        Rel.change(S, n.id, o.id, { familiarity: 2 }, 'talk', true);
        Rel.change(S, o.id, n.id, { familiarity: 2 }, 'talk', true);
        const told = Rumor.exchange(S, n, o);
        if (Rng.chance(S.W, 0.5)) Rumor.exchange(S, o, n);
        Narrative.feedTalk(S, n, o, told);
      },
    },
    explore: {
      avail: (n, c) => n.personality.curiosity >= 60 && !c.dark && canTravel(n) && !n.physical.injured && c.region === 'forest',
      score: (n, c) => n.personality.curiosity * 0.3 - n.needs.fatigue * 0.3 - c.threat - 10,
      start: (S, n, c) => {
        const next = Places.neighbors(c.loc).filter((x) => Places.regionOf(x) === c.region);
        if (next.length) Npc.startMove(S, n, Rng.pick(S.W, next));
        return { min: 20 };
      },
    },
    search: {
      avail: (n) => !!Goals.get(n, 'search') && canTravel(n),
      score: (n, c) => (Goals.get(n, 'search') || {}).priority - (c.dark ? 60 : 0),
      start: (S, n, c) => WorldEvents.searchStep(S, n, c),
    },
    fight: {
      avail: (n, c) => c.creatures.length > 0 && !!weaponOf(n) && n.physical.health > 30,
      score: (n, c) => c.threat * n.personality.bravery / 100 + (c.others.length ? 20 : 0) - n.mental.fear * 0.3 - n.needs.health * 0.3,
      start: (S, n, c) => { Combat.npcVsCreature(S, n, c.creatures[0], weaponOf(n)); return { min: 5 }; },
    },
    flee: {
      avail: (n, c) => c.threat >= 20 && !c.transit,
      score: (n, c) => c.threat * (100 - n.personality.bravery) / 100 + n.mental.fear * 0.4 + n.needs.health * 0.2
        + (c.relP && c.playerHere && c.relP.hostility >= 50 ? 60 : 0),
      start: (S, n, c) => {
        // 위협이 없는 이웃 장소로. 숨을 곳이 있으면 그쪽을 고른다
        const opts = Places.neighbors(c.loc).filter((x) => x !== S.W.player.loc && !Creatures.at(S.W, x).length);
        opts.sort((a, b) => (Places.has(b, 'shelter') - Places.has(a, 'shelter')) || (Places.distance(c.loc, a) - Places.distance(c.loc, b)));
        if (opts.length) Npc.startMove(S, n, opts[0]);
        n.mental.fear = clamp(n.mental.fear + 10);
        return { min: 10 };
      },
    },
    hide: {
      avail: (n, c) => c.threat >= 20 && (Places.has(c.loc, 'shelter') || Places.has(c.loc, 'dense') || Places.has(c.loc, 'roots')),
      score: (n, c) => c.threat * 0.5 + n.mental.fear * 0.3 + (canTravel(n) ? 0 : 30),
      start: () => ({ min: 30, data: { hidden: true } }),
    },
    heal: {
      avail: (n) => n.physical.injured && (!!medicineOf(n) || Magic.canCast(n, 'life', 15)),
      score: (n, c) => {
        const p = n.physical;
        if (medicineOf(n)) return n.needs.health * 0.9 + (p.bleed > 0 ? 20 : 0);
        // 마력으로 고치려면 집중해야 한다: 곁에 믿을 만한 사람이 있거나, 혼자서 마음이 가라앉았거나, 목숨이 걸렸을 때
        if (p.health < 20) return 95;
        const calm = c.threat < 20 && (c.playerHere ? (c.relP && c.relP.trust >= 25) : n.mental.fear < 40);
        return calm ? n.needs.health * 0.6 + 20 : -50;
      },
      start: (S, n, c) => {
        const k = medicineOf(n);
        if (k) { useItem(n, k); n.physical.bleed = 0; return { min: 20 }; }
        Magic.cast(S, n, 'life', { cost: 15, target: n.id });
        if (c.playerHere) c.W.worldFlags.pending.push('magic:' + n.id);
        else n.flags.healedAlone = c.now;
        return { min: 10 };
      },
    },
    pray: {
      avail: (n) => !!n.identity.devout,
      score: (n, c) => 15 + n.mental.stress * 0.3 + (c.sched && c.sched.act === 'pray' ? 45 : 0),
      start: () => ({ min: 30 }),
      tick: (S, n, c, d) => { n.mental.stress = clamp(n.mental.stress - 0.3 * d); n.mental.mood = clamp(n.mental.mood + 0.1 * d); },
    },
    study: {
      avail: (n, c) => n.identity.education === 'literate' && c.loc === c.home && !c.dark,
      score: (n, c) => n.personality.curiosity * 0.25 + (c.sched && c.sched.act === 'rest' ? 15 : 0) - n.needs.fatigue * 0.2,
      start: () => ({ min: 60 }),
      tick: (S, n, c, d) => {
        const l = n.languages.common_aver;
        if (l) l.reading = Math.min(100, l.reading + d / 600);
      },
    },
    teach: {
      avail: (n, c) => c.playerHere && c.relP && n.teach && c.relP.trust >= n.teach.minTrust && n.mental.fear < 50 && c.threat < 20
        && (n.flags.taughtAt == null || c.now - n.flags.taughtAt >= 60) && Lang.canTeach(S_(c), n),
      score: (n, c) => n.personality.kindness * 0.3 + n.personality.patience * 0.2 + c.relP.trust * 0.3,
      start: (S, n, c) => { n.flags.taughtAt = c.now; Lang.teach(S, n); return { min: 10 }; },
    },
    steal: {
      avail: (n, c) => n.personality.greed >= 60 && n.personality.honesty <= 40
        && (n.needs.money >= 50 || n.needs.hunger >= 70) && !!Economy.unattended(c.W, c.loc, n),
      score: (n, c) => (n.personality.greed - n.personality.honesty) * 0.5 + n.needs.money * 0.3 - c.others.length * 40 - (c.playerHere ? 30 : 0),
      start: (S, n, c) => { Economy.steal(S, n, c.loc); return { min: 5 }; },
    },
    help: {
      avail: (n, c) => n.personality.kindness >= 50 && !!needyHere(n, c) && (!!medicineOf(n) || Magic.canCast(n, 'life', 15)),
      score: (n, c) => {
        const who = needyHere(n, c);
        const r = Rel.peek(c.W, n.id, who.id) || { affection: 0, fear: 0 };
        return n.personality.kindness * 0.5 + r.affection * 0.3 - r.fear * 0.3 + (Goals.get(n, 'heal_people') ? 15 : 0);
      },
      start: (S, n, c) => {
        const who = needyHere(n, c);
        const k = medicineOf(n);
        if (k) useItem(n, k); else Magic.cast(S, n, 'life', { cost: 15, target: who.id });
        if (who.id === 'player') { Player.treat(S); Narrative.feedHelpPlayer(S, n, k); }
        else { who.npc.physical.bleed = 0; who.npc.physical.health = Math.min(100, who.npc.physical.health + (k ? 5 : 15)); }
        Social.help(S, n.id, who.id, 'treat');
        return { min: 20 };
      },
    },
    // 돌볼 사람(스승) 곁에서: 캐 온 약초를 건네고, 다치거나 아프면 돌본다 (목표 care_for_teacher)
    tend: {
      avail: (n, c) => {
        const g = Goals.get(n, 'care_for_teacher');
        const t = g && c.others.find((o) => o.id === g.target);
        return !!t && ((n.inventory.herb || 0) > 1 || t.physical.injured || t.needs.health > 30);
      },
      score: (n, c) => {
        const g = Goals.get(n, 'care_for_teacher');
        const t = c.others.find((o) => o.id === g.target);
        return g.priority * 0.6 + (t.physical.injured ? 30 : 0) - (n.flags.tendedAt != null && c.now - n.flags.tendedAt < 120 ? 50 : 0);
      },
      start: (S, n, c) => {
        const t = c.others.find((o) => o.id === Goals.get(n, 'care_for_teacher').target);
        const give = Math.max(0, (n.inventory.herb || 0) - 1);
        if (give) { n.inventory.herb -= give; t.inventory.herb = (t.inventory.herb || 0) + give; }
        if (t.physical.bleed > 0) { t.physical.bleed = 0; Social.help(S, n.id, t.id, 'treat'); }
        n.flags.tendedAt = c.now;
        Rel.change(S, n.id, t.id, { affection: 1 }, 'tend', true);
        return { min: 20 };
      },
    },
    // 함께 다니는 사람을 놓쳤을 때만 따라잡는다 (곁에 있을 때는 먹고 쉬는 등 제 할 일을 한다)
    follow: {
      avail: (n, c) => {
        if (!n.flags.follow || !canTravel(n)) return false;
        const tgt = n.flags.follow === 'player' ? c.W.player.loc : ((c.W.npcs[n.flags.follow] || {}).location || {}).loc;
        return !!tgt && tgt !== c.loc;
      },
      score: () => 70,
      start: (S, n, c) => {
        const tgt = n.flags.follow === 'player' ? S.W.player.loc : (S.W.npcs[n.flags.follow] || {}).location.loc;
        if (tgt && tgt !== c.loc) Npc.startMove(S, n, tgt);
        return { min: 15 };
      },
    },
    betray: {
      avail: (n, c) => !!n.flags.follow && (n.flags.follow === 'player' ? c.playerHere : c.others.some((o) => o.id === n.flags.follow)),
      score: (n, c) => {
        const r = Rel.peek(c.W, n.id, n.flags.follow) || {};
        return ((r.hostility || 0) + (r.resentment || 0)) * 0.4 + n.personality.greed * 0.2 - n.personality.honesty * 0.3 - (r.affection || 0) * 0.5 - 20;
      },
      start: (S, n, c) => { Social.betray(S, n, n.flags.follow); return { min: 5 }; },
    },
    // 어딘가로 간다: 일정의 장소, 집, 물가
    move: {
      avail: (n, c) => !!moveTarget(n, c),
      score: (n, c) => moveTarget(n, c).score,
      start: (S, n, c) => {
        const t = moveTarget(n, c);
        if (t.relocate) n.flags.relocated = true;
        Npc.startMove(S, n, t.to);
        return { min: 10 };
      },
    },
  };

  // 걸어갈 곳과 그 점수
  function moveTarget(n, c) {
    // 함께 다니는 동안에는 혼자 어디로 가지 않는다 (따라가기는 follow 행동이 맡는다)
    if (n.flags.follow) return null;
    const out = [];
    const home = Goals.get(n, 'return_home');
    if (home && home.priority > 0 && c.loc !== c.home) {
      let s = home.priority;
      // 곁에 사람이 있는데 등을 돌려 떠나지는 않는다 (적대하지 않는 한)
      if (c.playerHere && (!c.relP || c.relP.hostility < 50)) s -= 100;
      // 도와준 사람이 먼저 떠났다면 조금 기다려 준다
      const met = Memory.has(n, 'player', 'met');
      const gone = n.flags.lastSawPlayer != null ? c.now - n.flags.lastSawPlayer : Infinity;
      if (met && !c.playerHere && c.relP && c.relP.trust >= 30 && gone < waitLimit(n)) s -= 60;
      out.push({ to: c.home, score: s });
    }
    // 믿지 못할 낯선 이가 내가 있는 곳을 안다: 자리를 옮긴다 (몸이 성치 않아도 기어서라도)
    if (!c.playerHere && c.relP && Memory.has(n, 'player', 'met') && c.relP.trust < 30 && !n.flags.relocated
      && n.flags.lastSawPlayer != null && c.now - n.flags.lastSawPlayer >= 30 && c.region === 'forest') {
      const hide = Places.neighbors(c.loc).find((x) => Places.has(x, 'shelter') && x !== c.W.player.loc);
      if (hide) out.push({ to: hide, score: 85, relocate: true });
    }
    const trip = Goals.get(n, 'trade_trip');
    if (trip && trip.priority >= 50 && !n.flags.tripDone && c.loc !== trip.target && !c.dark) out.push({ to: trip.target, score: trip.priority });
    if (trip && n.flags.tripDone && c.loc !== c.home && !c.dark) out.push({ to: c.home, score: 60 });
    // 일정대로 움직인다: 보통은 사는 지역 안에서만. 채집만은 이웃 지역(숲)까지 나갔다가 (commute) 일정이 끝나면 돌아온다
    if (c.sched && c.sched.at && c.sched.at !== c.loc) {
      const local = Places.regionOf(c.sched.at) === Places.regionOf(c.home);
      if (local && Npc.atHome(n)) out.push({ to: c.sched.at, score: 40 + (c.sched.act === 'sleep' ? 20 : 0) });
      else if (local && n.flags.commute) out.push({ to: c.sched.at, score: 55 });
      else if (!local && c.sched.act === 'gather' && Npc.atHome(n) && !c.dark && canTravel(n)) { n.flags.commute = true; out.push({ to: c.sched.at, score: 40 }); }
    }
    if (n.flags.commute && Npc.atHome(n) && !(c.sched && c.sched.act === 'gather')) delete n.flags.commute;
    if (n.needs.thirst >= 80 && !hasWater(n, c.loc)) {
      const w = Places.neighbors(c.loc).find((x) => Places.has(x, 'water'));
      if (w) out.push({ to: w, score: n.needs.thirst * 0.9 });
    }
    // 충격이 남은 몸으로는 피신 말고는 멀리 가지 못한다
    const mobile = canTravel(n);
    return out.filter((x) => mobile || x.relocate).sort((a, b) => b.score - a.score)[0] || null;
  }

  // lang 모듈이 S를 받으므로, 문맥에서 꺼낸다
  const S_ = (c) => c.S;

  // ---------- 판단 ----------
  function decide(S, n, c) {
    const { W } = S;
    const cands = [];
    for (const [type, a] of Object.entries(A)) {
      if (!a.avail(n, c)) continue;
      const s = a.score(n, c) + Rng.next(W) * n.personality.impulsiveness * 0.15;
      cands.push([type, s]);
    }
    cands.sort((x, y) => y[1] - x[1]);
    const [type] = cands[0] || ['wait'];
    begin(S, n, c, type);
  }

  function begin(S, n, c, type) {
    const r = A[type].start(S, n, c) || {};
    if (!n.alive) return;
    n.currentAction = { type, start: c.now, until: c.now + (r.min || 15), data: r.data || {} };
    n.location.hidden = !!(r.data && r.data.hidden);
    n.lastDecide = c.now;
    if (c.playerHere) Narrative.feedAction(S, n, type);
  }

  // 장면이 NPC에게 행동을 시킨다 (예: 위협을 받고 달아난다)
  function force(S, n, type) {
    const c = context(S, n, S.W.time.t);
    if (!A[type]) throw new Error('알 수 없는 행동: ' + type);
    begin(S, n, c, type);
  }

  // 무언가가 판단을 흔들었다 (공격, 위협, 플레이어의 등장): 다음 틱에 곧바로 다시 판단한다
  function interrupt(n) { n.lastDecide = -1e9; if (n.currentAction) n.currentAction.until = -1e9; }

  // ---------- 한 번의 계산 ----------
  function step(S, n, now, dt, level) {
    Needs.body(S, n, dt);
    if (!n.alive) return;
    Needs.update(S, n, dt);
    Goals.update(S, n);
    // 걷는 중: 도착한 구간을 처리한다
    while (n.location.transit && n.location.nextAt != null && now >= n.location.nextAt) Npc.arrive(S, n);
    if (level === 'distant') { abstract(S, n, now, dt); return; }

    const c = context(S, n, now);
    // 곁에 있는 사람: 두려움이 풀리고 조금 익숙해진다 (적대하지 않는다면)
    if (c.playerHere) {
      n.flags.lastSawPlayer = now;
      if (c.relP && c.relP.hostility < 30) {
        n.mental.fear = clamp(n.mental.fear - dt / 6);
        Rel.change(S, n.id, 'player', { suspicion: -dt / 12, familiarity: dt / 30 }, 'company', true);
      }
    }
    const act = n.currentAction;
    if (act && A[act.type] && A[act.type].tick) A[act.type].tick(S, n, c, dt);
    if (!n.alive) return;
    // 걷는 중에는 도착할 때까지 다시 판단하지 않는다 (도중에 길을 바꾸면 영영 닿지 못한다)
    // 다만 목숨이 걸리면 걸음을 멈추지 않고도 상처를 돌본다
    if (n.location.transit) {
      if (n.physical.health < 20 && A.heal.avail(n, c)) A.heal.start(S, n, c);
      return;
    }
    // 쓰러진 사람을 돌보는 중: 깨어날 때까지 곁을 떠나지 않는다
    if (n.flags.caring && now < n.flags.caring) {
      if (!act || act.type !== 'wait') n.currentAction = { type: 'wait', start: now, until: n.flags.caring, data: {} };
      return;
    }
    const done = !act || now >= act.until;
    if (done && act && A[act.type] && A[act.type].end) A[act.type].end(S, n, c);
    if (done || now - n.lastDecide >= REPLAN) decide(S, n, c);
  }

  // 먼 곳: 일정대로 움직이고 욕구는 뭉뚱그려 채운다. 먼 여행(행상)은 길을 따라 걷는다.
  function abstract(S, n, now, dt) {
    if (n.location.transit) return;
    const c = context(S, n, now);
    const mt = moveTarget(n, c);
    if (mt && mt.score >= 50 && canTravel(n)) { Npc.startMove(S, n, mt.to); return; }
    const s = c.sched;
    if (!s) return;
    if (s.at && Places.regionOf(s.at) === c.region && s.at !== c.loc) Npc.place(S, n, s.at);
    if (s.act === 'sleep') n.needs.fatigue = clamp(n.needs.fatigue - 0.3 * dt);
    if (s.act === 'eat') { n.needs.hunger = clamp(n.needs.hunger - 40); n.needs.thirst = clamp(n.needs.thirst - 40); }
    if (s.act === 'work' && n.identity.occupation === 'peddler') { n.flags.tripDone = false; }
    if (s.act === 'social') {
      const o = Npc.here(S.W, n.location.loc).find((x) => x !== n);
      if (o) { Rumor.exchange(S, n, o); n.needs.social = clamp(n.needs.social - 30); }
    }
    n.needs.thirst = clamp(n.needs.thirst - 0.03 * dt);
    n.currentAction = { type: s.act === 'social' ? 'talk' : s.act, start: now, until: now + dt, data: { abstract: true } };
  }

  function update(S, n, t, level) {
    if (!n.alive) { n.simT = t; return; }
    const max = level === 'distant' ? 180 : level === 'nearby' ? 30 : 5;
    while (n.simT < t && n.alive) {
      const dt = Math.min(max, t - n.simT);
      n.simT += dt;
      step(S, n, n.simT, dt, level);
    }
  }

  return { ACTIONS: A, context, decide, force, interrupt, update, canTravel, waitLimit };
})();

if (typeof module !== 'undefined') module.exports = { Behavior };
