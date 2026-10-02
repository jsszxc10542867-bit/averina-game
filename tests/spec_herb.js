// 약재 부족 (herb_shortage) — 시작마을.md 8절 · 공통 사건 상태 (sim/incidents.js)
// 결정 D8 · D9 · D13(병상이 끝, 죽음 없음, 회복 가능) · D14(리아의 원정: 다쳐도 죽지 않음) · D15(해결 방식 7가지)

const HS = 'herb_shortage';
const hst = (S) => Incidents.get(S.W, HS);
// 시각만 옮긴다 (그 사이 세계를 돌리지 않는다): 하루 판정만 따로 볼 때
const atDay = (S, d, h = 6) => { S.W.time.t = Time.at(d, h); };
const noHerbs = (S) => { S.W.npcs.herbalist.inventory.herb = 0; S.W.npcs.lia.inventory.herb = 0; S.W.economy.markets.village_square.stock.herb = 0; };
// 마을에 둘째 날 닿고, 넷째 날 아침 숲이 위험하고 약초가 바닥났다 → 사건이 열린다
function herbWorld() {
  const S = newGame();
  inVillage(S, 'village_inn', 2, 8);
  to(S, 4, 7);
  S.W.regions.forest.threat = 35;
  noHerbs(S);
  Incidents.daily(S);
  return S;
}

// HS1 열림: 도착 + 2일 · 숲 위험 "중간" 이상 · 공급 40 이하. 하나라도 아니면 열리지 않고, 같은 날 다른 사건이 열렸거나 이미 둘이 열려 있으면 기다린다
(() => {
  const S = herbWorld();
  const st = hst(S);
  const opened = st.state === 'AVAILABLE' && st.data.deadline === Time.day(S.W.time.t) + RULES.herbShortage.deadlineDays
    && S.W.npcs.lia.flags.range === 'near' && Object.values(S.W.rumors).some((r) => r.type === 'herb_scarce');
  const lockedIf = (fn) => { const T = newGame(); inVillage(T, 'village_inn', 2, 8); to(T, 4, 7); T.W.regions.forest.threat = 35; noHerbs(T); fn(T); Incidents.daily(T); return hst(T).state; };
  const rich = lockedIf((T) => { T.W.npcs.herbalist.inventory.herb = 9; });
  const calm = lockedIf((T) => { T.W.regions.forest.threat = 10; });
  const early = (() => { const T = newGame(); inVillage(T, 'village_inn', 3, 8); T.W.regions.forest.threat = 35; noHerbs(T); Incidents.daily(T); return hst(T).state; })();
  const never = (() => { const T = newGame(); to(T, 5, 7); T.W.regions.forest.threat = 35; noHerbs(T); Incidents.daily(T); return hst(T).state; })();
  const yieldDay = lockedIf((T) => { T.W.events.openedOn = { day: Time.day(T.W.time.t), id: 'other' }; });
  const full = lockedIf((T) => { T.W.events.states.a = { id: 'a', state: 'IN_PROGRESS' }; T.W.events.states.b = { id: 'b', state: 'DISCOVERED' }; });
  check('HS1 약재 부족이 열림 → 도착+2일·숲 위험·공급 조건이 모두 맞을 때만, 같은 날 다른 사건이나 두 사건이 열려 있으면 기다린다',
    opened && [rich, calm, early, never, yieldDay, full].every((x) => x === 'LOCKED'),
    `열림 ${st.state}(시한 ${st.data.deadline}일, 리아 범위 ${S.W.npcs.lia.flags.range}) / 비축 많음 ${rich}, 숲 평온 ${calm}, 도착 다음 날 ${early}, 마을에 안 감 ${never}, 같은 날 양보 ${yieldDay}, 둘 열림 ${full}`);
})();

// HS2 발견 경로 일곱 가지: 어떤 길로 알게 되었는지 남고, 단서 갈래 'herb'가 열린다
(() => {
  const res = {};
  const run = (via, fn) => {
    const S = herbWorld();
    fn(S);
    const st = hst(S);
    res[via] = st.discoveredVia === via && st.state === 'DISCOVERED' && !!S.P.found.incidents[HS] && !!S.P.threads.herb && !!S.P.knowledge.herb_short;
  };
  const at = (S, loc, ...ids) => { Player.teleport(S, loc); ids.forEach((id) => Npc.place(S, S.W.npcs[id], loc)); };
  run('via_tutor', (S) => { at(S, 'village_herbhouse', 'herbalist'); Rel.get(S.W, 'herbalist', 'player').trust = 35; Incidents.hourly(S); });
  run('via_injury', (S) => { at(S, 'village_herbhouse', 'herbalist'); Player.injure(S, 'cut', 20); Incidents.hourly(S); });
  run('via_lia', (S) => { at(S, 'edge', 'lia'); Rel.get(S.W, 'lia', 'player').trust = 45; Incidents.hourly(S); });
  run('via_rumor', (S) => { at(S, 'village_inn'); const r = Object.values(S.W.rumors).find((x) => x.type === 'herb_scarce'); S.W.npcs.merchant.knowledge.rumors[r.id] = { level: 1, from: 'herbalist', t: S.W.time.t }; Incidents.hourly(S); });
  run('via_witness', (S) => { Player.teleport(S, 'edge'); HerbShortage.look(S, 'edge'); });
  run('via_market', (S) => { Incidents.notice(S, 'market', { item: 'herb', browse: true }); });
  run('via_work', (S) => { Bus.emit(S, 'PLAYER_WORKED', { job: 'field', giver: 'farmer', paid: 4 }); });
  const S = herbWorld();
  Player.teleport(S, 'village_herbhouse'); Npc.place(S, S.W.npcs.herbalist, 'village_herbhouse'); Rel.get(S.W, 'herbalist', 'player').trust = 5;
  Incidents.hourly(S);
  check('HS2 발견 경로 일곱 가지 → 각각 그 길로 알게 되고(단서 갈래 herb), 노파를 믿지 않으면 약초집에 가도 모른다', Object.values(res).every(Boolean) && Object.keys(res).length === 7 && !Incidents.known(hst(S)),
    Object.entries(res).map(([k, v]) => `${k} ${v ? '✓' : '✗'}`).join(' '));
})();

// 알게 된 상태에서 시작
function knownWorld() {
  const S = herbWorld();
  Incidents.notice(S, 'market', { item: 'herb', browse: true });
  return S;
}
const optionsAt = (S, loc, ...ids) => { Player.teleport(S, loc); ids.forEach((id) => Npc.place(S, S.W.npcs[id], loc)); return Incidents.options(S, (m, o) => { World.tick(S, m, o); return []; }); };
const pickOpt = (opts, re) => opts.find((o) => re.test(o.label));

// HS3 직접 캔 약초·산 약초를 약초집에 건네면 쌓이고, 필요량을 채우면 해결된다. 처음 대한 방식이 중요한 선택으로 남는다
(() => {
  const S = knownWorld();
  const st = hst(S);
  S.W.player.money = 20;
  // 시장에서 하나 산다 (상인이 일하는 낮)
  to(S, 4, 10); keepAlive(S); Player.teleport(S, 'village_square'); Npc.place(S, S.W.npcs.merchant, 'village_square');
  S.W.economy.markets.village_square.stock.herb = 2;
  const bought = Shop.open(S) ? Shop.buy(S, 'herb') : ['(가게 닫힘)'];
  // 숲 가장자리에서 캔다 (짐승이 없게 숲 위험을 잠시 낮춘다)
  S.W.regions.forest.threat = 0;
  let o = optionsAt(S, 'edge');
  const g = pickOpt(o, /풀숲을 뒤진다/);
  for (let i = 0; i < 4 && g; i++) { keepAlive(S); pickOpt(optionsAt(S, 'edge'), /풀숲을 뒤진다/).run(); }
  const have = S.W.player.inv.herb || 0;
  o = optionsAt(S, 'village_herbhouse', 'herbalist');
  const d = pickOpt(o, /약초집에 건넨다/);
  const t0 = Rel.get(S.W, 'herbalist', 'player').trust;
  if (d) d.run();
  const stage = S.W.npcs.herbalist.physical.chronic.stage;
  const choice = S.W.player.life.choices.find((c) => c.id === 'herb_shortage_response');
  check('HS3 캐고 사서 건네기 → 쌓여서 해결(RESOLVED), 해결한 방식과 첫 대응이 남고 "이방인이 도왔다" 소문이 돈다', !!g && have >= 8 && st.state === 'RESOLVED'
    && st.resolvedBy[0] === 'by_gather' && st.resolvedBy.includes('by_buy') && choice && choice.outcome === 'buy'
    && Object.values(S.W.rumors).some((r) => r.type === 'herb_helped' && r.subject === 'player') && Rel.get(S.W, 'herbalist', 'player').trust > t0 && stage === 'managed',
    `산 것 "${bought.slice(-1)}", 가진 약초 ${have}, 상태 ${st.state}, 해결 방식 ${st.resolvedBy.join('+')}, 첫 대응 ${choice && choice.outcome}, 노파 신뢰 ${Math.round(t0)}→${Math.round(Rel.get(S.W, 'herbalist', 'player').trust)}`);
})();

// HS4 배워서 필요량 줄이기 · 다른 사람에게 부탁하기(하루 뒤 가져온다) · 신뢰가 없으면 거절당한다
(() => {
  const S = knownWorld();
  const st = hst(S);
  S.P.knowledge.herb_heals = S.W.time.t;
  Rel.get(S.W, 'herbalist', 'player').trust = 55;
  const need0 = st.data.needed;
  const l = pickOpt(optionsAt(S, 'village_herbhouse', 'herbalist'), /아껴 쓰는 법/);
  if (l) l.run();
  const learned = st.data.needed < need0 && st.state === 'IN_PROGRESS';
  // 또래에게 부탁 (만난 적이 있고 믿는다) / 밭 주인은 믿지 않는다
  ['peer', 'farmer'].forEach((id) => Social.meet(S, id));
  Rel.get(S.W, 'peer', 'player').trust = 35;
  Rel.get(S.W, 'farmer', 'player').trust = 5;
  const a = pickOpt(optionsAt(S, 'village_square', 'peer', 'farmer'), /청년에게 약초를/);
  const b = pickOpt(optionsAt(S, 'village_square', 'peer', 'farmer'), /남자에게 약초를/);
  if (a) a.run();
  if (b) b.run();
  const herb0 = S.W.npcs.herbalist.inventory.herb || 0;
  keepAlive(S);
  to(S, 5, Time.hour(S.W.time.t) + 1);
  const brought = st.data.contrib.by_ask || 0;
  const choice = S.W.player.life.choices.find((c) => c.id === 'herb_shortage_response');
  check('HS4 배우기·부탁하기 → 필요량이 줄고, 믿는 또래는 하루 뒤 약초를 가져오며, 믿지 않는 밭 주인은 거절한다', learned && brought === RULES.herbShortage.ask.herbs
    && (S.W.npcs.herbalist.inventory.herb || 0) >= herb0 && st.data.failures.includes('refused') && choice.outcome === 'learn'
    && S.W.player.debts.some((x) => x.npc === 'peer'),
    `필요량 ${need0}→${st.data.needed}, 또래가 가져온 약초 ${brought}, 실패 기록 ${st.data.failures.join(',')}, 첫 대응 ${choice && choice.outcome}, 상태 ${st.state}`);
})();

// HS5 행상에게 주문: 다음에 행상이 마을에 올 때 가져온다
(() => {
  const S = knownWorld();
  const st = hst(S);
  S.W.player.money = 10;
  const o = pickOpt(optionsAt(S, 'village_square', 'peddler'), /행상에게 약초를/);
  if (o) o.run();
  const paid = S.W.player.money === 10 - RULES.herbShortage.order.price;
  S.W.time.t += 600;
  Npc.place(S, S.W.npcs.peddler, 'road');
  S.W.npcs.peddler.location.loc = 'road';
  Bus.emit(S, 'NPC_MOVED', { npcId: 'peddler', from: 'village_gate', to: 'village_square' });
  check('HS5 행상에게 주문 → 돈을 내고, 다음에 행상이 오면 약초가 약초집에 닿는다', !!o && paid && (st.data.contrib.by_order || 0) === RULES.herbShortage.order.herbs && st.data.orders[0].done,
    `주문 ${!!o}, 낸 돈 ${paid}, 가져온 약초 ${st.data.contrib.by_order || 0}`);
})();

// HS6 아무도 모른 채 방치 → 악화(ESCALATED): 노파 불안정 → 사흘 뒤 병상 → 더는 나빠지지 않음, 시한이 지나면 만료. 노파는 죽지 않고 쓰러짐과 무관하다
(() => {
  const S = herbWorld();
  const st = hst(S);
  const h = S.W.npcs.herbalist;
  const log = [];
  for (let d = 5; d <= 18; d++) { atDay(S, d); noHerbs(S); Incidents.daily(S); log.push(`${d}:${st.state[0]}${h.physical.chronic.stage[0]}`); }
  const L = S.W.npcs.lia;
  check('HS6 방치 → 악화(불안정→병상에서 멈춤), 리아는 원정, 시한 뒤 만료. 노파는 살아 있고 쓰러짐 기록과 얽히지 않는다',
    st.history.some((x) => x.state === 'ESCALATED') && h.physical.chronic.stage === 'bedridden' && h.alive && h.physical.health > 0
    && st.state === 'EXPIRED' && S.W.worldFlags.herbScarce === true && S.P.collapses === 0 && L.flags.range !== 'inner',
    `날:상태·단계 ${log.join(' ')} / 노파 체력 ${Math.round(h.physical.health)}/${h.physical.maxHealth}, 만료 뒤 리아 범위 ${L.flags.range}`);
})();

// HS7 원정 중의 리아 [D14]: 짐승에게 다쳐도 죽지 않는다 (플레이어가 해친 것은 막지 않는다)
(() => {
  const S = herbWorld();
  HerbShortage.setRange(S, 'inner');
  const L = S.W.npcs.lia;
  const inner = L.schedule.some(([, , act, at]) => act === 'gather' && at === 'stream');
  Npc.hurt(S, L, 500, '짐승에게 물렸다', 'thornback');
  const survived = L.alive && L.physical.health > 0 && L.physical.injured;
  HerbShortage.setRange(S, 'edge');
  const flagGone = !L.flags.noDeath;
  const T = herbWorld();
  HerbShortage.setRange(T, 'inner');
  Npc.hurt(T, T.W.npcs.lia, 500, '시험', 'player');
  check('HS7 원정 중의 리아 → 위험한 곳(개울)까지 가고, 짐승에게 다쳐도 죽지 않는다. 원정이 끝나면 보호도 끝', inner && survived && flagGone && !T.W.npcs.lia.alive,
    `원정 일정 ${inner}, 짐승에게 다친 뒤 살아 있음 ${survived}(체력 ${Math.round(L.physical.health)}), 끝난 뒤 보호 없음 ${flagGone}, 플레이어가 해치면 ${T.W.npcs.lia.alive ? '살아 있음' : '죽음'}`);
})();

// HS8 악화된 뒤에 알게 되어 돕기: 상태는 악화 그대로 경로만 남고, 시작하면 필요량이 늘며, 해결되면 노파가 하루에 한 단계씩 돌아온다
(() => {
  const S = herbWorld();
  const st = hst(S);
  const h = S.W.npcs.herbalist;
  for (let d = 5; d <= 11; d++) { atDay(S, d); noHerbs(S); Incidents.daily(S); }
  const escalated = st.state === 'ESCALATED' && h.physical.chronic.stage === 'bedridden';
  Incidents.notice(S, 'market', { item: 'herb', browse: true });
  const keptEsc = st.state === 'ESCALATED' && st.discoveredVia === 'via_market';
  for (let i = 0; i < 20; i++) Player.give(S.W.player, 'herb');
  const d = pickOpt(optionsAt(S, 'village_herbhouse', 'lia'), /약초집에 건넨다/);
  if (d) d.run();
  const need = st.data.needed;
  const after = h.physical.chronic.stage;
  atDay(S, Time.day(S.W.time.t) + 1, 6); Incidents.daily(S);
  check('HS8 악화 뒤 알게 되어 돕기 → 악화 상태 그대로 경로만 남고, 필요량이 늘며(병상 +40%), 해결 뒤 노파가 하루에 한 단계씩 회복', escalated && keptEsc
    && need === Math.ceil(RULES.herbShortage.needed * 1.4) && st.state === 'RESOLVED' && after === 'unsteady' && h.physical.chronic.stage === 'managed',
    `악화 ${escalated}, 알게 된 뒤 ${keptEsc}, 필요량 ${need}, 해결 직후 ${after} → 다음 날 ${h.physical.chronic.stage}`);
})();

// HS9 외면: 알고도 사흘 손대지 않으면 외면(IGNORED)이 중요한 선택으로 남고, 리아가 원정을 나간다. 다시 도우면 진행으로 돌아가지만 첫 대응은 그대로다
(() => {
  const S = knownWorld();
  const st = hst(S);
  for (let d = 5; d <= 8; d++) { atDay(S, d); S.W.npcs.herbalist.inventory.herb = 3; Incidents.daily(S); }
  const ignored = st.state === 'IGNORED' && S.W.npcs.lia.flags.range === 'inner';
  for (let i = 0; i < 2; i++) Player.give(S.W.player, 'herb');
  const d = pickOpt(optionsAt(S, 'village_herbhouse', 'herbalist'), /약초집에 건넨다/);
  if (d) d.run();
  const choice = S.W.player.life.choices.find((c) => c.id === 'herb_shortage_response');
  // 명시적으로 외면: 약초집에서 "모른 척한다"
  const T = knownWorld();
  Rel.get(T.W, 'herbalist', 'player').trust = 20;
  const t0 = Rel.get(T.W, 'herbalist', 'player').trust;
  const r = pickOpt(optionsAt(T, 'village_herbhouse', 'herbalist'), /모른 척한다/);
  if (r) r.run();
  check('HS9 외면 → 사흘 손대지 않으면 외면(리아 원정), 다시 도우면 진행. 첫 대응은 "외면했다" 그대로 / 약초집에서 모른 척하면 노파가 실망한다',
    ignored && st.state === 'IN_PROGRESS' && choice.outcome === 'ignored' && hst(T).state === 'IGNORED' && Rel.get(T.W, 'herbalist', 'player').trust < t0,
    `외면 ${ignored}, 다시 도운 뒤 ${st.state}, 첫 대응 ${choice && choice.outcome}, 모른 척 → ${hst(T).state} (노파 신뢰 ${Math.round(t0)}→${Math.round(Rel.get(T.W, 'herbalist', 'player').trust)})`);
})();

// HS10 진행 중 시한이 지나면 실패(FAILED), 다음 날 만료 / 저장하고 불러와도 사건과 리아의 원정 일정이 그대로다
(() => {
  const S = knownWorld();
  const st = hst(S);
  for (let i = 0; i < 2; i++) Player.give(S.W.player, 'herb');
  pickOpt(optionsAt(S, 'village_herbhouse', 'herbalist'), /약초집에 건넨다/).run();
  HerbShortage.setRange(S, 'inner');
  Save.write(S);
  const back = Save.read();
  const same = JSON.stringify(back.W.events.states[HS]) === JSON.stringify(st) && back.W.npcs.lia.schedule.some(([, , , at]) => at === 'stream') && back.W.npcs.lia.flags.noDeath === true;
  atDay(S, st.data.deadline + 1); Incidents.daily(S);
  const failed = st.state;
  atDay(S, st.data.deadline + 2); Incidents.daily(S);
  check('HS10 시한이 지나면 진행 중 → 실패 → 만료, 저장·불러오기에도 사건과 리아의 원정 일정이 남는다', same && failed === 'FAILED' && st.state === 'EXPIRED',
    `불러온 뒤 같음 ${same}, 시한 다음 날 ${failed}, 그다음 날 ${st.state}`);
})();
