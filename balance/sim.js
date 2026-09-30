// 밸런스 시뮬레이터: node balance/sim.js [판수]
// game.js / inventory-manager.js / event-manager.js 를 그대로 불러와 정책별로 자동 플레이한다.
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const src = ['game.js', 'inventory-manager.js', 'event-manager.js']
  .map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const ctx = vm.createContext({ Math, console });
vm.runInContext(src + '\nthis.G={newState,endDay,STATS,EVENTS,EventManager,RESCUE_SIGNAL,MAX_DAY,rationNeed};', ctx);
const G = ctx.G;

const pickRand = (a) => a[Math.floor(Math.random() * a.length)];
const policies = {
  // 무작정: 가능한 선택지 중 랜덤, 정량 배급, 의식은 마력석 2 이상이면 항상
  naive: (s, ev) => ({
    idx: pickRand(ev.choices.map((c, i) => i).filter((i) => G.EventManager.isAvailable(s, ev.choices[i]))),
    ration: 'full', broadcast: s.fuel >= 2, forage: false }),
  // 숙련: 직업/아이템 선택지 우선, 나머지 랜덤. 식량 부족하면 절반 배급, 수색 병행
  skilled: (s, ev) => {
    const av = ev.choices.map((c, i) => i).filter((i) => G.EventManager.isAvailable(s, ev.choices[i]));
    const spec = av.filter((i) => ev.choices[i].role || ev.choices[i].item);
    const idx = spec.length ? pickRand(spec) : pickRand(av);
    return { idx, ration: s.food >= G.rationNeed({ ...s, ration: 'full' }) * 3 ? 'full' : 'half',
      broadcast: s.fuel >= 3, forage: s.fuel < 6 || s.food < 8 };
  },
};

function play(policy) {
  const s = G.newState();
  while (!s.over) {
    const ev = G.EventManager.load(s);
    const p = policy(s, ev);
    G.EventManager.choose(s, p.idx);
    s.ration = p.ration; s.broadcast = p.broadcast; s.forage = p.forage;
    G.endDay(s);
  }
  return s;
}

const N = +process.argv[2] || 5000;
const out = {};
for (const [name, pol] of Object.entries(policies)) {
  const r = { rescued: 0, dead: 0, mutiny: 0, lost: 0, days: 0, signal: 0, people: 0 };
  const cause = {};
  for (let i = 0; i < N; i++) {
    const s = play(pol);
    r[s.over]++; r.days += s.day; r.signal += s.signal; r.people += s.people.length;
  }
  out[name] = Object.fromEntries(Object.entries(r).map(([k, v]) => [k, ['days', 'signal', 'people'].includes(k) ? +(v / N).toFixed(2) : +(v / N * 100).toFixed(1) + '%']));
}
console.log(JSON.stringify({ N, ...out }, null, 1));
