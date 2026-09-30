// 몸: 체력, 갈증, 허기, 능력치와 능력치 이해도. 화면과 무관한 순수 로직이다.
const STAT_KEYS = ['str', 'agi', 'vit', 'int', 'sen', 'wil'];
const STAT_KO = { str: '힘', agi: '민첩', vit: '체력', int: '지능', sen: '감각', wil: '의지' };
const STAT_POINTS = 10; // 상태창이 열릴 때 받는 포인트
const STAT_MAX = 10;
const GRASP_REVEAL = 2; // 이만큼 몸을 써 봐야 그 능력치가 숫자로 보인다

const hpMax = (R) => 7 + R.stats.vit;

// 몸을 쓴다. 상태창이 열린 뒤라면, 처음으로 감이 잡힌 능력치를 알려 준다.
function useStat(R, k) {
  R.grasp[k] = (R.grasp[k] || 0) + 1;
  if (R.status.unlocked && !R.status.known[k] && R.grasp[k] >= GRASP_REVEAL) {
    R.status.known[k] = true;
    R.notes.push({ t: `……${STAT_KO[k]}에 대한 이해도가 상승했다.`, cls: 'sys' });
  }
}

// cause: 이 상처로 죽으면 죽음 화면에 보일 까닭
function hurt(R, n, cause) {
  R.hp = Math.max(0, R.hp - n);
  if (cause) R.cause = cause;
}

function heal(R, n) {
  R.hp = Math.min(hpMax(R), R.hp + n);
}

// 시간이 흐르는 동안 목이 마르고 배가 고파진다. 한계를 넘기면 몸이 상한다.
function bodyTick(R, min, resting) {
  const lines = [];
  R.thirst = Math.min(100, R.thirst + min * 0.05);  // 시간당 +3
  R.hunger = Math.min(100, R.hunger + min * 0.025); // 시간당 +1.5
  if (R.thirst >= 85 || R.hunger >= 90) {
    R.starve += min;
    while (R.starve >= 60) { R.starve -= 60; hurt(R, 1, '굶주림과 갈증을 버티지 못했다'); }
  } else R.starve = 0;
  if (resting && R.thirst < 70 && R.hunger < 80) heal(R, Math.floor(min / 30));

  const feel = (key, on, text) => {
    if (on && !R.feel[key]) { R.feel[key] = true; lines.push(text); }
    if (!on) R.feel[key] = false;
  };
  feel('thirst1', R.thirst >= 60, '목이 마르다.');
  feel('thirst2', R.thirst >= 85, '목이 타들어 간다. 머리가 멍하다.');
  feel('hunger1', R.hunger >= 55, '배가 고프다.');
  feel('hunger2', R.hunger >= 85, '배 속이 쓰리다. 손끝이 조금 떨린다.');
  return lines;
}

// 체력을 숫자 대신 몸의 느낌으로 표현한다.
function hpFeeling(R) {
  const r = R.hp / hpMax(R);
  if (r >= 0.9) return null;
  if (r >= 0.6) return '몸 여기저기가 욱신거린다.';
  if (r >= 0.3) return '상처가 화끈거린다. 움직일 때마다 숨이 막힌다.';
  return '시야가 흐리다. 이대로는 오래 버티지 못한다.';
}

// 상태창. 아직 감이 오지 않은 능력치는 ? 로 보인다.
function statusLines(R, name) {
  const lines = [
    { t: '━━━━━━━━━━━━━━━━', cls: 'stat' },
    { t: name, cls: 'stat head' },
    { t: '━━━━━━━━━━━━━━━━', cls: 'stat' },
  ];
  STAT_KEYS.forEach((k) => {
    const v = R.status.known[k] ? String(R.stats[k]) : '?';
    lines.push({ t: `${STAT_KO[k].padEnd(2, '　')}　　${v.padStart(2, ' ')}`, cls: 'stat' });
  });
  lines.push({ t: '━━━━━━━━━━━━━━━━', cls: 'stat' });
  if (R.status.points > 0) lines.push({ t: `남은 포인트: ${R.status.points}`, cls: 'stat' });
  return lines;
}

function unlockStatus(R) {
  R.status.unlocked = true;
  R.status.points = STAT_POINTS;
  STAT_KEYS.forEach((k) => { R.status.known[k] = R.grasp[k] >= GRASP_REVEAL; });
}

if (typeof module !== 'undefined') {
  module.exports = { STAT_KEYS, STAT_KO, STAT_POINTS, STAT_MAX, hpMax, useStat, hurt, heal, bodyTick, hpFeeling, statusLines, unlockStatus };
}
