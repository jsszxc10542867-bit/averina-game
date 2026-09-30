// 첫 번째 NPC: 숲에서 다친 젊은 여자 (리아).
// 플레이어가 아무것도 하지 않아도 그녀의 시간은 흐른다: 피를 흘리고, 스스로 치료하고, 떠난다.
// 관계 수치는 플레이어에게 보여 주지 않는다.

function newGirl(at) {
  return {
    since: at,           // 움푹한 곳에 몸을 숨긴 시각
    state: { health: 40, hunger: 60, fear: 70, trust: 0, suspicion: 80, pain: 75, location: 'hollow', injured: true },
    rel: { trust: 0, fear: 0, respect: 0, affection: 0, suspicion: 80, hostility: 0 },
    alive: true,
    gone: null,          // 떠난 이유: 'left' | 'fled' | 'village'
    bleed: 1 / 12,       // 분당 체력 감소 (12분에 1)
    magicUsed: false,
    magicSeen: false,
    met: false,
    close: false,        // 가까이 다가가는 걸 허락했는가
    lastSeen: null,      // 플레이어가 마지막으로 곁에 있던 시각
    heardStop: 0,        // "멈춰"를 들은 횟수
    named: false,        // 서로 이름을 주고받았는가
    gotWater: false, gotHerb: false,
    events: [],          // 플레이어가 없는 동안 벌어진 일 (다음에 만나면 흔적으로 보인다)
  };
}

const girlHere = (R) => !!(R.girl && R.girl.alive && !R.girl.gone && R.girl.state.location === 'hollow' && R.t >= R.girl.since);

function clamp(n, lo = 0, hi = 100) { return Math.max(lo, Math.min(hi, n)); }

// 관계 변화. 수치는 숨긴다.
function relate(G, d) {
  for (const k in d) G.rel[k] = clamp(G.rel[k] + d[k]);
  G.state.trust = G.rel.trust;
  G.state.suspicion = G.rel.suspicion;
  G.state.fear = clamp(G.state.fear + (d.fear || 0));
}

// min분 동안 그녀가 스스로 하는 일. present: 플레이어가 곁에 있는가.
// 곁에 있을 때 벌어진 일은 { magic: true } 처럼 돌려주고, 장면이 그것을 보여 준다.
function girlTick(R, min, present) {
  const G = R.girl;
  const out = {};
  if (!G || !G.alive || G.gone || R.t < G.since) return out;
  const s = G.state;
  s.health = Math.max(0, s.health - min * G.bleed);
  s.hunger = clamp(s.hunger + min * 0.03);
  s.pain = clamp(40 + (60 - s.health), 0, 100);
  if (present) {
    G.lastSeen = R.t;
    if (G.rel.hostility < 30) { s.fear = clamp(s.fear - min / 6); G.rel.suspicion = clamp(G.rel.suspicion - min / 12); }
  }

  // 상처가 깊어지면 남은 힘으로 스스로를 치료한다
  if (s.health < 20 && !G.magicUsed) {
    G.magicUsed = true;
    s.health += 15;
    G.bleed = G.bleed / 2;
    if (present) out.magic = true; else G.events.push('magic');
  }
  if (s.health <= 0) {
    G.alive = false;
    out.died = true;
    return out;
  }

  // 기다려 주지 않는다
  if (!present) {
    const away = G.lastSeen == null ? R.t - G.since : R.t - G.lastSeen;
    if (G.rel.hostility >= 50) G.gone = 'fled';
    else if (!G.met && away >= 300) G.gone = 'left';
    else if (G.met && G.rel.trust < 30 && away >= 30) G.gone = 'left';
    else if (G.met && away >= 120) G.gone = 'village';
    if (G.gone) s.location = 'unknown';
  }
  return out;
}

if (typeof module !== 'undefined') module.exports = { newGirl, girlHere, relate, girlTick };
