// 생활 시스템 테스트 (스토리 재설계: 되감기 폐기, 쓰러짐 + 일·거처·동행·단서). spec.js의 도구(newGame, to, run ...)를 쓴다.
function inVillage(S, loc, d = 1, h = 9) { to(S, d, h); Player.teleport(S, loc); }

// C1 혼자 쓰러짐: 되감기가 아니라 같은 세계에서 시간이 흐른 뒤 깨어난다
(() => {
  const S = newGame();
  to(S, 1, 16);
  Player.teleport(S, 'hill');
  const W0 = S.W, t0 = S.W.time.t;
  S.W.player.inv.stone = 1; S.W.player.inv.branch = 2;
  S.W.player.hp = 0;
  const r = Collapse.resolve(S, '시험');
  const slept = S.W.time.t - t0;
  check('C1 혼자 쓰러짐 → 같은 세계에서 시간이 흐른 뒤 깨어난다 (되감기 없음)', S.W === W0 && !r.rescuer && slept >= 360 && S.W.player.hp === Math.ceil(hpMax(S.W.player) * 0.3) && S.P.collapses === 1,
    `정신을 잃은 시간 ${slept}분, 깨어난 체력 ${S.W.player.hp}/${hpMax(S.W.player)}, 잃은 것 ${r.lost || '없음'}, 시각 ${Time.dayLabel(S.W.time.t)} ${Math.floor(Time.clock(S.W.time.t) / 60)}시`);
})();

// C2 구조: 곁에 나를 믿는 사람이 있으면 구해 주고, 기억·빚·소문이 남는다
(() => {
  const S = newGame();
  atHollowWithLia(S);
  Rel.change(S, 'lia', 'player', { trust: 40 }, 'test');
  lia(S).physical.bleed = 0;
  S.W.player.hp = 0;
  Player.injure(S, 'bite', 60);
  const r = Collapse.resolve(S, '시험');
  const L = lia(S);
  const rum = Object.values(S.W.rumors).find((x) => x.type === 'rescued');
  check('C2 구조 → 구해 준 사람의 기억, 나의 빚, 소문, 상처 치료', r.rescuer === L && Memory.has(L, 'player', 'rescued') && S.W.player.debts.length === 1
    && !!rum && !!L.knowledge.rumors[rum.id] && !Player.bleeding(S.W) && S.W.player.hp === Math.ceil(hpMax(S.W.player) * 0.6) && L.location.loc === 'hollow',
    `구한 사람 ${r.rescuer && r.rescuer.id}, 시간 ${r.minutes}분, 빚 ${JSON.stringify(S.W.player.debts.map((d) => d.npcId))}, 소문 "${rum && Rumor.plain(S.W, rum, 0)}", 곁에 있음 ${L.location.loc}`);
})();

// C3 연속 쓰러짐: 하루 안에 또 쓰러지면 더 오래 정신을 잃는다
(() => {
  const S = newGame();
  Player.teleport(S, 'hill');
  S.W.player.hp = 0; const a = Collapse.resolve(S, '1');
  S.W.player.hp = 0; const b = Collapse.resolve(S, '2');
  check('C3 하루 안에 또 쓰러지면 더 오래 정신을 잃는다', b.again && !a.again && b.minutes >= RULES.collapse.aloneMin[0] + RULES.collapse.repeatExtra,
    `첫 번째 ${a.minutes}분, 두 번째 ${b.minutes}분 (again=${b.again})`);
})();

// L1 일: 품삯·직업 경향·호감·기억·소문, 같은 날 두 번째는 소문이 되지 않는다
(() => {
  const S = newGame();
  inVillage(S, 'village_field', 2, 7);
  const jobs = Work.available(S).map((j) => j.id);
  const h = S.W.npcs.herbalist;
  const t0 = Rel.get(S.W, 'herbalist', 'player').trust;
  const pass = (m, o) => { World.tick(S, m, o); return []; };
  if (jobs.includes('field')) Work.perform(S, 'field', pass);
  const rums1 = Object.values(S.W.rumors).filter((x) => x.type === 'worked').length;
  keepAlive(S);
  if (Work.available(S).some((j) => j.id === 'field')) Work.perform(S, 'field', pass);
  const rums2 = Object.values(S.W.rumors).filter((x) => x.type === 'worked').length;
  check('L1 일(품삯) → 돈·직업 경향·호감·기억·소문 (하루 한 번)', jobs.includes('field') && S.W.player.money >= 4 && S.W.player.tendency.labor >= 120
    && Rel.get(S.W, 'herbalist', 'player').trust > t0 && Memory.has(h, 'player', 'worked_with') && rums1 === 1 && rums2 === 1,
    `할 수 있던 일 ${jobs}, 돈 ${S.W.player.money}, 경향 ${JSON.stringify(S.W.player.tendency)}, 노파 신뢰 ${t0}→${Rel.get(S.W, 'herbalist', 'player').trust}, 소문 ${rums1}→${rums2}`);
})();

// L2 거처: 믿음과 돈에 따라 구할 수 있는 잠자리가 다르고, 잠의 질이 회복을 바꾼다
(() => {
  const S = newGame();
  inVillage(S, 'village_square', 2, 10);
  const noMoney = Lodging.offers(S).map((o) => o.id);
  S.W.player.money = 10;
  const withMoney = Lodging.offers(S).map((o) => o.id);
  Lodging.take(S, 'room');
  to(S, 2, 21); Player.teleport(S, 'village_square'); keepAlive(S);
  S.W.player.hp = 3;
  const can = Lodging.canSleep(S);
  const lines = Lodging.sleep(S, (m, o) => { World.tick(S, m, o); return []; });
  // 방값은 하룻밤에 한 번 (잠자리를 구할 때 냈으면 잘 때 또 받지 않는다): 10 - 3 = 7
  check('L2 거처 → 돈과 믿음에 따른 잠자리, 방에서 자면 잘 낫는다 (방값은 하룻밤 한 번)', !noMoney.includes('room') && withMoney.includes('room') && can
    && Time.clock(S.W.time.t) === 360 && S.W.player.hp > 3 && S.W.player.money === 7,
    `돈 없을 때 ${noMoney} / 있을 때 ${withMoney} / 아침 체력 3→${S.W.player.hp} / 남은 돈 ${S.W.player.money} / ${lines.join(' ')}`);
})();

// L3 동행: 믿으면 함께 가고, 함께 걸으면 가까워지며, 위험한 곳으로는 따라오지 않는다
(() => {
  const S = newGame();
  atHollowWithLia(S);
  lia(S).physical.shock = 0; lia(S).physical.bleed = 0;
  const before = Companion.canAsk(S, lia(S));
  Rel.change(S, 'lia', 'player', { trust: 45 }, 'test');
  const can = Companion.canAsk(S, lia(S));
  Companion.ask(S, lia(S));
  const f0 = Rel.get(S.W, 'lia', 'player').familiarity;
  // 짐승이 다니지 않는 공터로 (계곡에는 둘째 날부터 짐승이 돌아다녀서, 그녀가 달아날 수 있다)
  Player.teleport(S, 'clearing'); Companion.onMove(S, 'hollow', 'clearing');
  const moved = lia(S).location.loc === 'clearing';
  run(S, 30);
  const stayed = lia(S).location.loc === 'clearing' && !lia(S).location.transit;
  S.W.regions.village.threat = 90;
  const lines = Companion.onMove(S, 'clearing', 'village_gate');
  check('L3 동행 → 함께 이동, 가까워짐, 위험하면 따라오지 않음', !before && can && moved && stayed && Rel.get(S.W, 'lia', 'player').familiarity > f0 && !S.W.player.companions.includes('lia'),
    `처음엔 청할 수 없음 ${!before}, 믿은 뒤 ${can}, 함께 공터로 ${moved}, 30분 뒤에도 곁에 ${stayed}, 위험한 곳: "${lines.join(' ')}"`);
})();

// L4 단서: 여러 경로의 단서가 모이면 갈래가 열린다
(() => {
  const S = newGame();
  Clues.onFact(S, 'no_trail');
  Clues.onFact(S, 'night_path');
  const mid = !!S.P.threads.forest;
  Clues.onFact(S, 'name_call');
  Clues.onRumor(S, 'anomaly');
  check('L4 단서 → 같은 갈래가 모이면 열린다 (사실·소문 여러 경로)', !mid && !!S.P.threads.forest && !!S.P.threads.world && Clues.lines(S).length > 3,
    `단서 ${Object.keys(S.P.clues)}, 열린 갈래 ${Object.keys(S.P.threads)}`);
})();

// L5 마을 입구: 울타리 경비가 나를 못 믿으면 막고, 리아가 함께 있거나 밤이면 들어갈 수 있다
(() => {
  const S = newGame();
  inVillage(S, 'village_gate', 2, 9);
  const g = () => ({ W: S.W, dark: Time.dark(S.W.time.t) });
  const blocked = !!gateBlock(g());
  Companion.join(S, 'lia'); Npc.place(S, lia(S), 'village_gate');
  const withLia = !!gateBlock(g());
  Companion.leave(S, 'lia');
  to(S, 2, 23); Player.teleport(S, 'village_gate');
  const night = !!gateBlock(g());
  check('L5 마을 입구 (경비가 막음 / 리아가 보증 / 밤)', blocked && !withLia && !night, `낮 혼자 ${blocked ? '막힘' : '통과'} / 리아와 ${withLia ? '막힘' : '통과'} / 밤 ${night ? '막힘' : '통과'}`);
})();

// L6 가게: 돈으로 사고, 가진 것을 판다. 재고와 상인의 돈이 바뀐다
(() => {
  const S = newGame();
  inVillage(S, 'village_square', 2, 10);
  S.W.player.money = 5; S.W.player.inv.herb = 2;
  const open = Shop.open(S);
  const stock0 = S.W.economy.markets.village_square.stock.bread, m0 = S.W.npcs.merchant.money;
  Shop.buy(S, 'bread');
  Shop.sell(S, 'herb');
  check('L6 가게 → 사고팔면 재고·돈이 바뀐다', open && S.W.player.inv.bread === 1 && S.W.economy.markets.village_square.stock.bread === stock0 - 1 && S.W.player.inv.herb === 1 && S.W.npcs.merchant.money !== m0,
    `빵 재고 ${stock0}→${S.W.economy.markets.village_square.stock.bread}, 내 돈 5→${S.W.player.money}, 상인 돈 ${m0}→${S.W.npcs.merchant.money}`);
})();

// L7 시스템 통합 직후의 저장 파일(생활 칸 없음)도 불러와진다
(() => {
  const S = newGame();
  to(S, 1, 18);
  const old = JSON.parse(JSON.stringify({ v: 2, P: S.P, W: S.W }));
  ['money', 'tendency', 'lodging', 'companions', 'debts', 'lastCollapse'].forEach((k) => delete old.W.player[k]);
  delete old.P.clues; delete old.P.threads; delete old.P.collapses;
  old.P.deaths = 1; old.P.rewinds = 1; old.W.run = 1;
  localStorage.setItem(Save.KEY, JSON.stringify(old));
  const s = Save.read();
  check('L7 생활 칸이 없는 예전 저장 파일도 불러와진다', !!s && s.W.player.money === 0 && Array.isArray(s.W.player.companions) && !!s.P.clues && s.P.collapses === 0 && s.W.time.t === Time.at(1, 18),
    `돈 ${s && s.W.player.money}, 동행 ${s && JSON.stringify(s.W.player.companions)}, 단서 ${s && JSON.stringify(s.P.clues)}`);
  localStorage.removeItem(Save.KEY);
})();
