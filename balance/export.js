// 현재 game.js 수치를 balance/ 아래 JSON·CSV로 내보낸다: node balance/export.js
const fs = require('fs'), vm = require('vm'), path = require('path');
const root = path.join(__dirname, '..');
const src = ['game.js', 'inventory-manager.js'].map((f) => fs.readFileSync(path.join(root, f), 'utf8')).join('\n');
const ctx = vm.createContext({ Math });
vm.runInContext(src + '\nthis.G={EVENTS,MAX_DAY,RESCUE_SIGNAL,newState};', ctx);
const G = ctx.G, s0 = G.newState();
fs.writeFileSync(path.join(__dirname, 'values.json'), JSON.stringify({
  maxDay: G.MAX_DAY, rescueSignal: G.RESCUE_SIGNAL, moraleMax: 10,
  start: { food: s0.food, fuel: s0.fuel, med: s0.med, morale: s0.morale, people: 5 },
  ration: { full: 0.6, half: 0.3, rounding: 'ceil' },
  nightly: { wardFuel: 1, ritualFuel: 1, ritualSignal: 1, ritualSignalWithRadio: 2, forageFood: 2, forageFuel: 1, forageSickChance: 0.2,
    starvePenaltyMorale: -2, starveDeathIfShort: 2, noWardMorale: -1, fedAndWarmMorale: 1, sickNoMedDeathChance: 0.5 },
}, null, 2));
const rows = ['id,title,weight,minDay,choices'];
for (const e of G.EVENTS) {
  const m = e.cond && /s\.day >= (\d+)/.exec(e.cond.toString());
  rows.push([e.id, e.title, e.w, m ? m[1] : 1, e.choices.length].join(','));
}
fs.writeFileSync(path.join(__dirname, 'events.csv'), '\ufeff' + rows.join('\n') + '\n');
console.log('OK', G.EVENTS.length, 'events');
