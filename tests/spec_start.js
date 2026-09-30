// 처음 1시간의 결정 (스토리설계.md PART 5, 게임 디렉터 요청): 첫날 밤 보호 [#6], 첫 잠자리의 갈림길 [#10], 리아의 목표 [#1]

// P1 첫날 밤 보호: 둘째 날 새벽까지는 어떤 피해도 체력 1에서 멈춘다. 탈진·부상·소모는 남는다. 새벽이 지나면 보호가 끝난다.
(() => {
  const S = newGame();
  to(S, 1, 20, 0, { alive: false });
  Player.hurt(S, 50, '시험');
  const afterBig = S.W.player.hp;
  Player.injure(S, 'bite', 30);
  // 먹지도 마시지도 않고 밤을 버틴다 (굶주림과 갈증 피해)
  S.W.player.surv.thirst = 100; S.W.player.surv.hunger = 100;
  World.tick(S, Time.untilDawn(S.W.time.t) - 30, { rest: true });
  const beforeDawn = S.W.player.hp;
  const sheltered = Player.sheltered(S);
  const injured = S.W.player.surv.injuries.length > 0 && S.W.player.surv.thirst >= 85;
  to(S, 2, 6, 30, { alive: false });
  Player.hurt(S, 50, '시험');
  check('P1 첫날 밤 보호 → 둘째 날 새벽까지 체력 1에서 멈추고, 그 뒤로는 쓰러질 수 있다', afterBig === 1 && beforeDawn >= 1 && sheltered && injured && S.W.player.hp === 0 && !Player.sheltered(S),
    `큰 피해 뒤 ${afterBig}, 굶주린 채 새벽 직전 ${beforeDawn}, 부상·갈증 남음 ${injured}, 새벽 뒤 같은 피해 → ${S.W.player.hp}`);
})();

// 리아를 도운 경우와 돕지 않은 경우: 저녁까지 흘린 뒤의 노파의 신뢰
function helpedWorld(help) {
  const S = newGame();
  atHollowWithLia(S);
  if (help) {
    Social.help(S, 'player', 'lia', 'water', { trust: 10, suspicion: -5 });
    Social.help(S, 'player', 'lia', 'herb', { trust: 20, respect: 10 });
    lia(S).physical.bleed = 0;
  }
  Player.teleport(S, 'hill');
  to(S, 2, 21);
  return S;
}

// S1 헛간: 리아를 도왔다면 리아의 말로 노파의 신뢰가 헛간을 내줄 만큼(30) 오른다. 돕지 않았다면 아니다.
(() => {
  const A = helpedWorld(true), B = helpedWorld(false);
  const tA = Rel.get(A.W, 'herbalist', 'player').trust, tB = Rel.get(B.W, 'herbalist', 'player').trust;
  Player.teleport(A, 'village_homes');
  const offersA = Npc.at(A.W, 'herbalist', 'village_homes') ? Lodging.offers(A).map((o) => o.id) : ['(노파 부재)'];
  const heardFromLia = Object.values(A.W.npcs.herbalist.knowledge.rumors).some((h) => h.from === 'lia');
  check('S1 첫 잠자리 ① 리아를 도왔다 → 리아의 말로 노파가 헛간을 내준다 (돕지 않았다면 아니다)', tA >= 30 && tB < 30 && heardFromLia && offersA.includes('barn'),
    `노파의 신뢰: 도움 ${Math.round(tA)} / 안 도움 ${Math.round(tB)}, 리아에게 들음 ${heardFromLia}, 집들에서 구할 수 있는 잠자리 ${offersA}`);
})();

// S2 일로 치르기: 돈이 없어도 저녁에 가게 일을 거들면 뒷방에서 잔다. 그 밤의 방값은 받지 않는다.
(() => {
  const S = newGame();
  inVillage(S, 'village_square', 2, 16);
  keepAlive(S);
  const offers = Lodging.offers(S).map((o) => o.id);
  const t0 = S.W.time.t;
  const lines = Lodging.take(S, 'room_work', (m, o) => { World.tick(S, m, o); return []; });
  const worked = S.W.time.t - t0;
  to(S, 2, 21); Player.teleport(S, 'village_square'); keepAlive(S);
  const money0 = S.W.player.money;
  Lodging.sleep(S, (m, o) => { World.tick(S, m, o); return []; });
  check('S2 첫 잠자리 ② 돈 없이 일을 거들고 재워 달라고 한다 → 뒷방, 그 밤 방값 없음', offers.includes('room_work') && !offers.includes('room') && worked >= 90
    && money0 === 0 && S.W.player.money === 0 && Time.clock(S.W.time.t) === 360 && S.W.player.tendency.labor >= 90,
    `돈 0일 때 구할 수 있는 잠자리 ${offers}, 일한 시간 ${worked}분, 아침 돈 ${S.W.player.money}, "${lines.slice(-1)}"`);
})();

// S3 교회의 구호: 돈이 거의 없으면 예배당 구석에서 잘 수 있다. 사흘 밤까지.
(() => {
  const S = newGame();
  inVillage(S, 'village_chapel', 2, 19);
  const nights = [];
  for (let d = 2; d <= 5; d++) {
    to(S, d, 19); Player.teleport(S, 'village_chapel'); keepAlive(S);
    const ok = Lodging.offers(S).some((o) => o.id === 'chapel');
    nights.push(ok);
    if (ok) { Lodging.take(S, 'chapel'); Lodging.sleep(S, (m, o) => { World.tick(S, m, o); return []; }); }
  }
  const S2 = newGame(); inVillage(S2, 'village_chapel', 2, 19); S2.W.player.money = 10;
  const rich = Lodging.offers(S2).some((o) => o.id === 'chapel');
  check('S3 첫 잠자리 ③ 교회의 구호 → 돈이 없으면 사흘 밤까지, 돈이 있으면 안 됨', nights.join() === 'true,true,true,false' && !rich,
    `밤마다 구호를 받을 수 있었나 ${nights.join(' ')}, 돈 10닢일 때 ${rich}`);
})();

// S4 노숙: 아무것도 못 했으면 저녁에 울타리 밑에서 잔다 (낫지 않고, 도둑맞을 수 있다)
(() => {
  const S = newGame();
  inVillage(S, 'village_gate', 2, 18);
  keepAlive(S);
  const offers = Lodging.offers(S).map((o) => o.id);
  Lodging.take(S, 'rough');
  S.W.player.hp = 3;
  Lodging.sleep(S, (m, o) => { World.tick(S, m, o); return []; });
  check('S4 첫 잠자리 ④ 울타리 밑 노숙 → 밤새 낫지 않는다', offers.includes('rough') && S.W.player.hp <= 3,
    `저녁 울타리에서 구할 수 있는 잠자리 ${offers}, 아침 체력 3→${S.W.player.hp}`);
})();

// G1 리아의 목표 "스승의 병을 돌본다": 스승 곁에서 캐 온 약초를 건넨다
(() => {
  const S = newGame();
  inVillage(S, 'village_field', 3, 12);
  const L = lia(S), h = S.W.npcs.herbalist;
  Npc.place(S, L, 'village_homes'); Npc.place(S, h, 'village_homes');
  L.physical.injured = false; L.physical.shock = 0; L.physical.health = 100; L.physical.bleed = 0;
  L.inventory.herb = 4;
  const h0 = h.inventory.herb || 0;
  const goal = Goals.get(L, 'care_for_teacher');
  const c = Behavior.context(S, L, S.W.time.t);
  const avail = Behavior.ACTIONS.tend.avail(L, c);
  Behavior.ACTIONS.tend.start(S, L, c);
  check('G1 리아의 목표 "스승의 병을 돌본다" → 스승 곁에서 약초를 건넨다', !!goal && goal.target === 'herbalist' && avail && (h.inventory.herb || 0) === h0 + 3,
    `목표 ${goal && goal.id}(우선 ${goal && Math.round(goal.priority)}), 약초 리아 4→${L.inventory.herb} / 노파 ${h0}→${h.inventory.herb}`);
})();
