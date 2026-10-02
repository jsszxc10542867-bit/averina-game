// 플레이어의 몸: 체력, 생존(허기·갈증·피로·추위·젖음·출혈·부상·병), 능력치와 성장, 소지품.
// 화면과 무관한 순수 로직이다. me = W.player
const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'sen', 'wil'];
const STAT_KO = { str: '힘', agi: '민첩', vit: '체력', int: '지능', sen: '감각', wil: '의지' };
const STAT_POINTS = 10; // 상태창이 열릴 때 받는 포인트
const STAT_MAX = 10;
const GRASP_REVEAL = 2; // 이만큼 몸을 써 봐야 그 능력치가 숫자로 보인다
const GROW_EVERY = 6;   // 상태창이 열린 뒤, 이만큼 더 쓰면 그 능력치가 1 오른다
const GROW_MAX = 2;     // 쓰면서 오를 수 있는 최대치 (능력치마다, 게임 전체에서)

const hpMax = (me) => 7 + me.stats.vit;

const Player = (() => {
  const clamp = (n, lo = 0, hi = 100) => Math.max(lo, Math.min(hi, n));

  function create() {
    const zero = () => Object.fromEntries(STAT_KEYS.map((k) => [k, 0]));
    return {
      id: 'player', loc: 'clearing', inv: {}, dur: {}, hp: 10,
      stats: Object.fromEntries(STAT_KEYS.map((k) => [k, 3])),
      grasp: zero(), grown: zero(),
      status: { unlocked: false, points: 0, known: {} },
      // 몸이 젖은 채로 눈을 뜬다
      surv: { hunger: 30, thirst: 40, fatigue: 20, cold: 20, wet: 60, bleeding: 0, injuries: [], illness: [] },
      acc: { starve: 0, chill: 0, rest: 0 },
      feel: {}, cause: null, ateBerry: false, asleep: false,
      // [제안] 마법 재능은 숨긴 값이다. 플레이어에게 보여 주지 않는다
      magic: { mana: 5, maxMana: 5, talent: { light: 40, spirit: 55, life: 30 } },
      // 생활: 돈(동전), 한 일의 경향(분), 거처, 함께 다니는 사람, 진 빚, 마지막으로 쓰러진 시각
      money: 0, tendency: {}, lodging: null, companions: [], debts: [], lastCollapse: null,
      life: LifeLog.create(), // 삶의 기록 (play/lifelog.js)
    };
  }

  // 몸을 쓴다. 상태창이 열린 뒤라면 처음으로 감이 잡힌 능력치를 알려 주고, 계속 쓰면 조금씩 자란다.
  function use(S, k) {
    const me = S.W.player;
    me.grasp[k] = (me.grasp[k] || 0) + 1;
    if (!me.status.unlocked) return;
    if (!me.status.known[k] && me.grasp[k] >= GRASP_REVEAL) {
      me.status.known[k] = true;
      S.W.worldFlags.notes.push({ t: `……${STAT_KO[k]}에 대한 이해도가 상승했다.`, cls: 'sys' });
      return;
    }
    const over = me.grasp[k] - GRASP_REVEAL;
    if (over > 0 && over % GROW_EVERY === 0 && me.grown[k] < GROW_MAX && me.stats[k] < STAT_MAX) {
      me.stats[k]++;
      me.grown[k]++;
      S.W.worldFlags.notes.push({ t: `……${STAT_KO[k]}이 몸에 조금 붙은 것 같다.`, cls: 'sys' });
    }
  }

  // 첫날 밤 보호 중인가 (RULES.protection): 그동안은 체력이 minHp 밑으로 내려가지 않는다
  const sheltered = (S) => S.W.time.t < Time.at(RULES.protection.until[0], RULES.protection.until[1]);

  // cause: 이 상처로 쓰러지면 보일 까닭. by: 누가 (NPC id, 'beast' 등)
  function hurt(S, n, cause, by) {
    const me = S.W.player;
    me.hp = Math.max(sheltered(S) ? RULES.protection.minHp : 0, me.hp - n);
    if (cause) me.cause = cause;
    Bus.emit(S, 'PLAYER_HURT', { amount: n, cause: cause || null, by: by || null, hp: me.hp });
  }

  function heal(me, n) { me.hp = Math.min(hpMax(me), me.hp + n); }

  // 피가 나는 상처. bleedMin분 동안 피가 흐르고 저절로 멎는다 (그동안 쉬어도 낫지 않는다)
  function injure(S, kind, bleedMin = 0) {
    const me = S.W.player;
    me.surv.injuries.push({ kind, t: S.W.time.t, bleedUntil: S.W.time.t + bleedMin });
  }
  const bleeding = (W) => W.player.surv.injuries.some((x) => x.bleedUntil > W.time.t);
  // 상처를 싸매면 피가 멎는다
  function treat(S) {
    S.W.player.surv.injuries.forEach((x) => { x.bleedUntil = Math.min(x.bleedUntil, S.W.time.t); });
  }
  const ill = (W) => W.player.surv.illness.some((x) => x.until > W.time.t);
  function sicken(S, kind, min) { S.W.player.surv.illness.push({ kind, t: S.W.time.t, until: S.W.time.t + min }); }

  // ---------- 소지품 ----------
  const weight = (me) => Object.entries(me.inv).reduce((s, [k, n]) => s + (ITEM_DEFS[k] ? ITEM_DEFS[k].weight * n : 0), 0);
  const carryLimit = (me) => 4 + me.stats.str * 1.5;
  function give(me, item, n = 1) {
    me.inv[item] = (me.inv[item] || 0) + n;
    const d = ITEM_DEFS[item];
    if (d && d.durability != null && me.dur[item] == null) me.dur[item] = d.durability;
  }
  function take(me, item, n = 1) {
    if (!me.inv[item]) return false;
    me.inv[item] -= n;
    if (me.inv[item] <= 0) { delete me.inv[item]; delete me.dur[item]; }
    return true;
  }
  // 무기로 한 번 쓴다. 부러지면 true (하나를 잃고, 남은 것이 있으면 새것으로 바꿔 든다)
  function wear(me, item) {
    const d = ITEM_DEFS[item];
    if (!d || d.durability == null || !me.inv[item]) return false;
    me.dur[item] = (me.dur[item] == null ? d.durability : me.dur[item]) - 1;
    if (me.dur[item] > 0) return false;
    take(me, item);
    if (me.inv[item]) me.dur[item] = d.durability;
    return true;
  }
  const label = (item, P) => { const d = ITEM_DEFS[item]; return d ? (d.label ? d.label(P) : d.name) : item; };
  // 물건 설명 한 줄. 겉보기(desc)에, 알아낸 것이 있으면 그 줄(known: [사실, 문장])을 덧붙인다
  const describe = (item, P) => {
    const d = ITEM_DEFS[item];
    if (!d || !d.desc) return null;
    return d.known && P.knowledge[d.known[0]] ? `${d.desc} ${d.known[1]}` : d.desc;
  };

  // ---------- 시간이 흐를 때 ----------
  // opt: { rest, sleep, move, fight } — 무엇을 하며 보냈는가. 느낌이 바뀌면 그 줄을 돌려준다.
  function update(S, dt, opt = {}) {
    const { W } = S;
    const me = W.player, s = me.surv, a = me.acc;
    const lines = [];
    s.thirst = clamp(s.thirst + dt * 0.05);  // 시간당 +3
    s.hunger = clamp(s.hunger + dt * 0.025); // 시간당 +1.5

    // 피로
    // opt.work = 일의 분당 피로 (play/work.js)
    let f = opt.fight ? 0.15 : opt.move ? 0.08 : opt.work != null ? opt.work : 0.03;
    if (opt.move && weight(me) > carryLimit(me)) f *= 1.5;
    if (ill(W)) f *= 2;
    f *= 1 - (me.stats.vit - 3) * 0.05;
    if (opt.sleep) f = -0.25; else if (opt.rest) f = -0.08;
    s.fatigue = clamp(s.fatigue + f * dt);

    // 젖음과 추위: 비를 맞으면 젖고, 해가 있으면 마른다. 젖은 몸은 밤에 식는다.
    const shelter = Places.has(me.loc, 'shelter');
    if (Weather.wet(W)) s.wet = clamp(s.wet + dt * (shelter ? 0.12 : 0.3));
    else s.wet = clamp(s.wet - dt * (Time.dark(W.time.t) ? 0.04 : 0.12));
    const target = clamp((15 - Weather.temp(W)) * 4 + s.wet * 0.4 - (opt.move || opt.fight ? 10 : 0) - (opt.cover ? 15 : 0));
    s.cold = clamp(s.cold + (target - s.cold) * Math.min(1, dt / 60));
    if (s.cold >= 90) {
      a.chill += dt;
      while (a.chill >= 90) { a.chill -= 90; hurt(S, 1, '추위를 버티지 못했다'); }
    } else a.chill = 0;

    // 굶주림과 갈증
    if (s.thirst >= 85 || s.hunger >= 90) {
      a.starve += dt;
      while (a.starve >= 60) { a.starve -= 60; hurt(S, 1, '굶주림과 갈증을 버티지 못했다'); }
    } else a.starve = 0;

    s.bleeding = bleeding(W) ? 1 : 0;
    // 쉬면 조금씩 낫는다 (목마르거나, 굶주리거나, 피를 흘리거나, 얼어붙어 있으면 낫지 않는다)
    // 거처에서 자면 잠의 질(opt.quality)만큼 낫는다 (RULES.sleep.healPer30)
    // 정신을 잃은 동안(opt.unconscious)은 쉬는 게 아니다: 낫지 않는다 (깨어날 때의 체력은 쓰러짐 규칙이 정한다)
    if ((opt.rest || opt.sleep) && !opt.unconscious && s.thirst < 70 && s.hunger < 80 && !s.bleeding && s.cold < 80) {
      a.rest += dt;
      const per = opt.sleep && opt.quality != null ? RULES.sleep.healPer30[opt.quality] : 1;
      while (a.rest >= 30) { a.rest -= 30; heal(me, per); }
    }
    s.illness = s.illness.filter((x) => x.until > W.time.t);

    const feel = (key, on, text) => {
      if (on && !me.feel[key]) { me.feel[key] = true; lines.push(text); }
      if (!on) me.feel[key] = false;
    };
    feel('thirst1', s.thirst >= 60, '목이 마르다.');
    feel('thirst2', s.thirst >= 85, '목이 타들어 간다. 머리가 멍하다.');
    feel('hunger1', s.hunger >= 55, '배가 고프다.');
    feel('hunger2', s.hunger >= 85, '배 속이 쓰리다. 손끝이 조금 떨린다.');
    feel('tired1', s.fatigue >= 60, '몸이 무겁다. 걸음이 자꾸 늦어진다.');
    feel('tired2', s.fatigue >= 85, '눈꺼풀이 자꾸 내려앉는다.');
    feel('cold1', s.cold >= 55, s.wet >= 40 ? '젖은 옷이 차갑게 달라붙는다. 몸이 떨린다.' : '춥다. 몸이 저절로 움츠러든다.');
    feel('cold2', s.cold >= 80, '이가 딱딱 부딪친다. 손끝에 감각이 없다.');
    return lines;
  }

  // 체력을 숫자 대신 몸의 느낌으로 표현한다.
  function hpFeeling(me) {
    const r = me.hp / hpMax(me);
    if (r >= 0.9) return null;
    if (r >= 0.6) return '몸 여기저기가 욱신거린다.';
    if (r >= 0.3) return '상처가 화끈거린다. 움직일 때마다 숨이 막힌다.';
    return '시야가 흐리다. 이대로는 오래 버티지 못한다.';
  }

  // 화면 아래에 늘 보이는 몸 상태 (통합 명세 37절). 숫자 대신 느낌으로.
  function barWords(W) {
    const me = W.player, s = me.surv;
    const r = me.hp / hpMax(me);
    const pick = (v, steps) => steps.find(([th]) => v >= th)[1];
    return [
      ['몸', r >= 0.9 ? '멀쩡함' : r >= 0.6 ? '욱신거림' : r >= 0.3 ? '다침' : '위험'],
      ['허기', pick(s.hunger, [[85, '굶주림'], [55, '배고픔'], [35, '출출함'], [0, '괜찮음']])],
      ['갈증', pick(s.thirst, [[85, '타는 듯함'], [60, '목마름'], [0, '괜찮음']])],
      ['피로', pick(s.fatigue, [[85, '한계'], [60, '지침'], [35, '조금'], [0, '괜찮음']])],
      ...(s.cold >= 55 ? [['추위', s.cold >= 80 ? '얼어붙음' : '떨림']] : []),
      ...(bleeding(W) ? [['피', '흐름']] : []),
    ];
  }

  // 상태창. 아직 감이 오지 않은 능력치는 ? 로 보인다.
  function statusLines(me, name) {
    const lines = [
      { t: '━━━━━━━━━━━━━━━━', cls: 'stat' },
      { t: name, cls: 'stat head' },
      { t: '━━━━━━━━━━━━━━━━', cls: 'stat' },
    ];
    STAT_KEYS.forEach((k) => {
      const v = me.status.known[k] ? String(me.stats[k]) : '?';
      lines.push({ t: `${STAT_KO[k].padEnd(2, '　')}　　${v.padStart(2, ' ')}`, cls: 'stat' });
    });
    lines.push({ t: '━━━━━━━━━━━━━━━━', cls: 'stat' });
    if (me.status.points > 0) lines.push({ t: `남은 포인트: ${me.status.points}`, cls: 'stat' });
    return lines;
  }

  function unlockStatus(me) {
    me.status.unlocked = true;
    me.status.points = STAT_POINTS;
    STAT_KEYS.forEach((k) => { me.status.known[k] = me.grasp[k] >= GRASP_REVEAL; });
  }

  // 순간 이동 (디버그용)
  function teleport(S, loc) {
    const from = S.W.player.loc;
    S.W.player.loc = loc;
    Bus.emit(S, 'PLAYER_MOVED', { from, to: loc });
  }

  return {
    create, use, hurt, heal, injure, bleeding, treat, ill, sicken, sheltered,
    weight, carryLimit, give, take, wear, label, describe, update, hpFeeling, barWords, statusLines, unlockStatus, teleport,
  };
})();

if (typeof module !== 'undefined') {
  module.exports = { STAT_KEYS, STAT_KO, STAT_POINTS, STAT_MAX, hpMax, Player };
}
