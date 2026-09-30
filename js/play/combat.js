// 전투 (통합 명세 23절). 공격·방어 버튼이 아니라, 자유 행동의 성공 가능성을 상황이 정한다:
// 위치(지형), 시야(어둠·안개), 소리(비), 몸 상태(체력·피로·출혈), 장비, 상대의 성격과 두려움.
const Combat = (() => {
  const clamp01 = (p) => Math.max(0.02, Math.min(0.98, p));

  // 지금 싸우는 조건
  function mods(S, foe) {
    const { W } = S;
    const me = W.player;
    const loc = me.loc;
    const dark = Time.dark(W.time.t) ? 1 : 0;
    const fog = Weather.hazy(W) ? 1 : 0;
    const rain = Weather.wet(W) ? 1 : 0;
    const hurtR = me.hp / hpMax(me);
    return {
      agi: me.stats.agi - 3, sen: me.stats.sen - 3, str: me.stats.str - 3,
      dark, fog, rain,
      // 몸이 무겁고 다쳤으면 모든 동작이 둔해진다
      body: (me.surv.fatigue >= 85 ? -0.1 : 0) + (hurtR < 0.3 ? -0.1 : 0) + (Player.bleeding(W) ? -0.05 : 0),
      rocks: Places.has(loc, 'rocks'), water: Places.has(loc, 'water'), trees: Places.has(loc, 'trees') || Places.has(loc, 'dense'),
      slope: Places.has(loc, 'slope'),
      foeFear: foe ? (foe.fear || 0) / 100 : 0,
      foeAggro: foe ? (foe.aggression || 60) / 100 : 0.6,
    };
  }

  // 행동별 성공 가능성
  function chance(S, action, foe, extra = {}) {
    const m = mods(S, foe);
    const noticed = extra.noticed !== false;
    switch (action) {
      case 'hit': return clamp01(0.6 + m.agi * 0.05 + m.body - m.dark * 0.15 - m.fog * 0.1 + m.foeFear * 0.2);
      case 'throw': return clamp01(0.5 + m.agi * 0.05 + m.sen * 0.05 + m.body - m.dark * 0.2 - m.fog * 0.15);
      case 'climb': return clamp01(0.55 + m.agi * 0.08 + m.body - (m.rain ? 0.15 : 0));
      case 'hide': return clamp01(0.3 + m.sen * 0.07 + m.agi * 0.07 + (noticed ? 0 : 0.3) + m.dark * 0.15 + m.fog * 0.1 + m.rain * 0.1 + (m.trees ? 0.05 : 0) + m.body);
      case 'flee': return clamp01(0.4 + m.agi * 0.08 + m.body + (m.slope ? -0.05 : 0) + m.foeFear * 0.2);
      case 'sneak': return clamp01(0.8 + m.rain * 0.05 + m.fog * 0.05 + m.body);
      case 'dodge': return clamp01(0.1 + m.agi * 0.08 + m.body);
      // 상대가 반격할 가능성: 사나울수록 높고 겁먹을수록 낮다
      case 'counter': return clamp01(0.55 * (m.foeAggro / 0.7) * (1 - m.foeFear * 0.8));
      default: throw new Error('알 수 없는 전투 행동: ' + action);
    }
  }

  // 손에 쥘 무기 (가장 센 것)
  function weaponOf(me) {
    return Object.keys(me.inv).filter((k) => ITEM_DEFS[k] && ITEM_DEFS[k].properties.weapon)
      .sort((a, b) => ITEM_DEFS[b].properties.weapon.dmg - ITEM_DEFS[a].properties.weapon.dmg
        || (b === 'stone') - (a === 'stone'))[0] || null;
  }

  // 짐승이 겁을 먹는다. 두려움이 차오르면 달아난다.
  function scare(foe, n) { foe.fear = Math.min(100, (foe.fear || 0) + n); return foe.fear >= 80; }

  // 플레이어가 NPC를 공격한다. { hit, dmg, killed }
  function playerVsNpc(S, n, weapon) {
    const { W } = S;
    const m = mods(S, null);
    const dmg = (weapon ? ITEM_DEFS[weapon].properties.weapon.dmg : 0) * 12 + 6 + m.str * 3;
    // 다친 사람은 피하지 못한다
    const evade = n.physical.health >= 25 ? 0.35 + n.personality.bravery / 400 : 0.05;
    const hit = Rng.chance(W, clamp01(0.7 + m.agi * 0.05 + m.body - evade));
    if (hit) {
      if (weapon) Player.wear(W.player, weapon);
      Npc.hurt(S, n, dmg, '이방인에게 공격당했다', 'player');
    }
    return { hit, dmg: hit ? dmg : 0, killed: !n.alive };
  }

  // NPC와 짐승 (보이지 않는 곳에서는 뭉뚱그려 한 번에 계산한다)
  function npcVsCreature(S, n, c, weapon) {
    const { W } = S;
    const dmg = weapon ? ITEM_DEFS[weapon].properties.weapon.dmg : 0;
    if (Rng.chance(W, 0.45 + n.personality.bravery / 400)) {
      c.hp -= Math.max(1, Math.round(dmg / 2));
      if (scare(c, 35) || c.hp <= 0) { c.shy = true; c.loc = 'deepwood'; }
    }
    if (c.alive && !c.shy && Rng.chance(W, 0.4)) Npc.hurt(S, n, 15, '짐승에게 당했다', c.id);
    if (Npc.present(W, n)) W.worldFlags.feed.push(`${Narrative.who(S, n)}${Text.josa(Narrative.who(S, n), '이가')} 무언가와 맞붙는다. 풀숲이 요란하게 흔들린다.`);
  }

  function creatureVsNpc(S, c, n) {
    const { W } = S;
    Npc.injure(S, n, { health: n.physical.health - 20, bleed: Math.max(n.physical.bleed, 1 / 20), shock: 60, kind: 'claw', by: c.id, cause: '짐승에게 습격당했다' });
    if (!n.alive) return;
    Memory.add(S, n, { type: 'attacked_by', subject: c.id });
    Places.addTrace(W, n.location.loc, 'blood');
    WorldEvents.record(S, 'beast_attack', { loc: n.location.loc, actors: [c.id, n.id], data: { subject: c.id, target: n.id } });
    c.hunger = Math.max(0, c.hunger - 40);
    Behavior.interrupt(n);
  }

  return { mods, chance, weaponOf, scare, playerVsNpc, npcVsCreature, creatureVsNpc };
})();

if (typeof module !== 'undefined') module.exports = { Combat };
