// 시스템 테스트 (통합 명세 41절의 12개 + 기존 동작 회귀). 실행: node tests/run.js
var __results = [];
function check(name, ok, detail) { __results.push({ name, ok: !!ok, detail: detail === undefined ? '' : detail }); }
function newGame() { const S = { P: Persist.create(), W: World.create(0) }; S.P.name = '민준'; S.P.memory.name = true; return S; }
function keepAlive(S) { const s = S.W.player.surv; s.thirst = 20; s.hunger = 20; s.fatigue = 20; S.W.player.hp = hpMax(S.W.player); }
// 목표 시각까지 흘린다 (플레이어는 살려 둔다, 장면 대기열은 비운다)
function to(S, d, h, m = 0, opt = {}) {
  const target = Time.at(d, h, m);
  while (S.W.time.t < target) {
    World.tick(S, Math.min(opt.step || 30, target - S.W.time.t), { rest: true });
    if (opt.alive !== false) keepAlive(S);
    S.W.worldFlags.pending.length = 0;
    S.W.worldFlags.feed.length = 0;
  }
}
function run(S, min, opt = {}) { to(S, 1, 0, S.W.time.t + min, opt); }
const lia = (S) => S.W.npcs.lia;
const snap = (S) => JSON.stringify(Object.values(S.W.npcs).map((n) => [n.id, n.location.loc, n.location.transit, n.currentAction && n.currentAction.type, Math.round(n.needs.hunger), Math.round(n.physical.health)]));
function atHollowWithLia(S) {
  to(S, 2, 7, 10);
  Player.teleport(S, 'hollow');
  lia(S).flags.met = true;
  Social.meet(S, 'lia');
}
const busLog = [];
Bus.on('*', (S, e) => busLog.push(e));

// ---------- 테스트 1: 아무것도 하지 않고 1시간 ----------
(() => {
  const S = newGame();
  atHollowWithLia(S);
  const before = Object.fromEntries(Object.values(S.W.npcs).map((n) => [n.id, { act: n.currentAction && n.currentAction.type, loc: n.location.loc, h: n.physical.health, needs: { ...n.needs } }]));
  const acts = [];
  const ev = (s, e) => {};
  const start = busLog.length;
  const decisions = {};
  const orig = Behavior.decide;
  World.tick(S, 60, { rest: true });
  const changed = Object.values(S.W.npcs).filter((n) => {
    const b = before[n.id];
    const needsMoved = Object.keys(b.needs).some((k) => Math.abs(b.needs[k] - n.needs[k]) >= 1);
    return (n.currentAction && n.currentAction.type) !== b.act || n.location.loc !== b.loc || needsMoved;
  }).map((n) => n.id);
  const L = lia(S);
  check('T1 1시간 대기 → NPC 행동/상태 변화', changed.length >= 4 && L.physical.health < before.lia.h,
    `변한 NPC ${changed.join(',')} / 리아 체력 ${before.lia.h.toFixed(1)}→${L.physical.health.toFixed(1)}, 행동 ${before.lia.act}→${L.currentAction && L.currentAction.type}`);
})();

// ---------- 테스트 2: 플레이어가 떠난 뒤에도 그곳의 일이 진행된다 ----------
(() => {
  const S = newGame();
  atHollowWithLia(S);
  const t0 = S.W.time.t;
  Player.teleport(S, 'hill');            // 같은 숲 안에서 자리를 뜬다
  run(S, 180);
  const L = lia(S);
  const leftHollow = !(L.location.loc === 'hollow' && !L.location.transit);
  // 지역 자체를 떠난 경우 (마을로 순간 이동): 숲은 이웃 지역(30분 단위)으로 계속 계산된다
  const S2 = newGame();
  atHollowWithLia(S2);
  Player.teleport(S2, 'village_square');
  const simBefore = lia(S2).simT;
  run(S2, 180);
  const L2 = lia(S2);
  check('T2 떠난 뒤에도 그곳의 NPC와 사건이 진행', leftHollow && L2.simT > simBefore && S2.W.regions.forest.level === 'nearby',
    `같은 지역: 3시간 뒤 리아 위치 ${L.location.loc}${L.location.transit ? '→' + L.location.dest : ''} / 다른 지역: 숲 정밀도 ${S2.W.regions.forest.level}, 리아 시각 ${Time.clock(L2.simT)} 체력 ${L2.physical.health.toFixed(1)} 위치 ${L2.location.loc}${L2.location.transit ? '→' + L2.location.dest : ''}`);
})();

// ---------- 테스트 3: 도와주면 기억·관계·소문이 이어진다 ----------
(() => {
  const S = newGame();
  atHollowWithLia(S);
  const r0 = { ...Rel.get(S.W, 'lia', 'player') };
  Social.help(S, 'player', 'lia', 'water', { trust: 10, suspicion: -5 });
  Social.help(S, 'player', 'lia', 'herb', { trust: 15, respect: 5 });
  lia(S).physical.bleed = 0;
  const L = lia(S);
  const r1 = Rel.get(S.W, 'lia', 'player');
  const mem = L.memories.filter((m) => m.subject === 'player' && m.type === 'helped_by').length;
  const rum = Object.values(S.W.rumors).find((r) => r.type === 'helped' && L.knowledge.rumors[r.id]);
  run(S, 60);
  Player.teleport(S, 'hill');
  to(S, 3, 21);
  const holders = rum ? Object.values(S.W.npcs).filter((n) => n.id !== 'lia' && n.knowledge.rumors[rum.id]).map((n) => `${n.id}L${n.knowledge.rumors[rum.id].level}`) : [];
  const gk = Rel.peek(S.W, 'gatekeeper', 'player');
  check('T3 도움 → 기억 + 관계 + 소문', mem >= 2 && r1.trust > r0.trust && r1.gratitude > 0 && rum && holders.length > 0,
    `기억 helped_by×${mem}, 신뢰 ${r0.trust}→${r1.trust}, 감사 ${r1.gratitude}, 소문 ${rum ? rum.id : '없음'} → 전해 들은 사람 ${holders.join(',') || '없음'}, 리아 위치 ${L.location.loc}, 문지기의 인상 ${gk ? `신뢰${Math.round(gk.trust)} 경계${Math.round(gk.suspicion)}` : '없음'}`);
})();

// ---------- 테스트 4: 공격하면 공포·적대·기억·행동이 바뀐다 ----------
(() => {
  const S = newGame();
  atHollowWithLia(S);
  const r0 = { ...Rel.get(S.W, 'lia', 'player') };
  Social.attack(S, 'player', 'lia', { weapon: null });
  Npc.hurt(S, lia(S), 5, '이방인에게 공격당했다', 'player');
  World.tick(S, 10);
  const L = lia(S), r1 = Rel.get(S.W, 'lia', 'player');
  const mem = Memory.has(L, 'player', 'attacked_by');
  const reacted = L.location.transit || L.location.loc !== 'hollow' || ['flee', 'hide', 'fight'].includes(L.currentAction && L.currentAction.type);
  check('T4 공격 → 공포/적대/기억/행동 변화', r1.fear > r0.fear && r1.hostility >= 50 && mem && reacted,
    `공포 ${r0.fear}→${Math.round(r1.fear)}, 적대 ${r0.hostility}→${Math.round(r1.hostility)}, 기억 attacked_by=${mem}, 행동 ${L.currentAction && L.currentAction.type} 위치 ${L.location.loc}${L.location.transit ? '→' + L.location.dest : ''}`);
})();

// ---------- 테스트 5: NPC가 다른 NPC에게 사건을 전한다 ----------
(() => {
  const S = newGame();
  to(S, 1, 17, 30);
  const gk = S.W.npcs.gatekeeper;
  const ev = WorldEvents.record(S, 'beast_attack', { loc: gk.location.loc, witnesses: ['gatekeeper'], data: { subject: 'thornback', target: 'gatekeeper' } });
  const rum = Object.values(S.W.rumors).find((r) => r.event === ev.id);
  const start = busLog.length;
  to(S, 1, 21);
  const spread = busLog.slice(start).filter((e) => e.type === 'RUMOR_SPREAD' && e.rumorId === rum.id);
  const holders = Object.values(S.W.npcs).filter((n) => n.knowledge.rumors[rum.id]).map((n) => `${n.id}L${n.knowledge.rumors[rum.id].level}`);
  check('T5 NPC→NPC 전달 → 소문', spread.length >= 1 && holders.length >= 2,
    `전달 ${spread.length}번 (${spread.map((e) => e.from + '→' + e.to + ' L' + e.level).join(', ')}), 아는 사람 ${holders.join(',')}, 변형: "${Rumor.plain(S.W, rum, 0)}" / "${Rumor.plain(S.W, rum, 2)}"`);
})();

// ---------- 테스트 6: 처음 듣는 외국어는 완벽히 이해되지 않는다 ----------
(() => {
  const S = newGame();
  const lines = ['「[[거기:15]]…… [[멈춰:10]].」', '「[[어디:30]]서 [[왔:30]]어? [[어느:35]] [[마을:20]]?」', '「[[물:10]].」'];
  const outs = lines.map((t) => Dialogue.process(S, { speakerId: 'lia', text: t }));
  const leaked = outs.filter((r) => r.fullyUnderstood || /거기|멈춰|어디|마을|물/.test(r.displayText));
  // 이름만 부르는 대사(call_name)는 소리 그대로 들리므로 뺀다
  const dl = Object.keys(DIALOGUES).filter((id) => id !== 'call_name').map((id) => Dialogue.process(S, { speakerId: 'gatekeeper', dialogueId: id, vars: { target: '리아' } }));
  check('T6 첫 외국어 → 완벽히 이해 못 함', leaked.length === 0 && dl.every((r) => !r.fullyUnderstood),
    outs.map((r) => r.displayText).join(' / ') + ` | 대사 ${dl.length}개 모두 부분 이해, 예: ${dl[1].displayText} [${dl[1].tone}]`);
})();

// ---------- 테스트 7: 같은 단어를 여러 번 들으면 이해도가 오른다 ----------
(() => {
  const S = newGame();
  const conf = [], shown = [];
  for (let i = 0; i < 10; i++) {
    const r = Dialogue.process(S, { speakerId: 'lia', text: '「[[물:10]]. [[물:10]]……」' });
    conf.push(LangKnowledge.word(S, 'player', 'common_aver', 'water').confidence);
    shown.push(r.displayText);
  }
  const rising = conf.every((c, i) => i === 0 || c >= conf[i - 1]) && conf[conf.length - 1] > conf[0];
  const w = LangKnowledge.word(S, 'player', 'common_aver', 'water');
  check('T7 반복 청취 → 단어 이해도 증가 (듣기만으로는 뜻을 확신하지 못함)', rising && w.confidence < LangKnowledge.KNOWN && w.encounters === 20,
    `확신 ${conf.map((c) => c.toFixed(2)).join(' ')} / 만남 ${w.encounters}회 / 처음 "${shown[0]}" → 나중 "${shown[9]}" / 이해도 ${LangKnowledge.get(S, 'player', 'common_aver').understanding}%`);
})();

// ---------- 테스트 8: 관계가 좋아지면 말투와 몸짓이 달라진다 ----------
(() => {
  const S = newGame();
  atHollowWithLia(S);
  LangLearning.learn(S, { type: 'contextual_guess', language: 'common_aver', amount: 22, source: 'test' }); // 이해도 22%
  const line = '「[[같이:30]]…… [[가:30]].」';
  const before = Dialogue.process(S, { speakerId: 'lia', text: line }).displayText;
  const d0 = Narrative.describe(S, lia(S));
  const c0 = Behavior.context(S, lia(S), S.W.time.t);
  const teach0 = Behavior.ACTIONS.teach.avail(lia(S), c0);
  Rel.change(S, 'lia', 'player', { trust: 50, suspicion: -60, gratitude: 30 }, 'test');
  lia(S).physical.bleed = 0;
  run(S, 150); // 곁에서 함께 시간을 보내면 두려움이 가라앉는다
  const after = Dialogue.process(S, { speakerId: 'lia', text: line }).displayText;
  const d1 = Narrative.describe(S, lia(S));
  const c1 = Behavior.context(S, lia(S), S.W.time.t);
  const teach1 = Behavior.ACTIONS.teach.avail(lia(S), c1);
  check('T8 관계 개선 → 대화/비언어 행동 변화', before !== after && JSON.stringify(d0) !== JSON.stringify(d1) && !teach0 && teach1,
    `말: "${before}" → "${after}" / 몸짓: ${JSON.stringify(d0)} → ${JSON.stringify(d1)} / 가르쳐 주기 ${teach0}→${teach1}`);
})();

// ---------- 테스트 9: NPC가 죽으면 세계에 후속 변화가 생긴다 ----------
(() => {
  const control = newGame();
  const S = newGame();
  to(S, 2, 8); to(control, 2, 8);
  Npc.kill(S, lia(S), '피를 너무 많이 흘렸다', null);
  Player.teleport(S, 'hill'); Player.teleport(control, 'hill');
  to(S, 4, 12); to(control, 4, 12);
  const types = S.W.events.log.map((e) => e.type);
  const died = Object.values(S.W.rumors).find((r) => r.type === 'died');
  const knowers = died ? Object.values(S.W.npcs).filter((n) => n.knowledge.rumors[died.id]).map((n) => n.id) : [];
  const herb = S.W.npcs.herbalist;
  const grief = Memory.has(herb, 'lia', 'lost');
  const v = S.W.economy.markets.village_square, vc = control.W.economy.markets.village_square;
  check('T9 NPC 사망 → 실종·수색·발견·소문·슬픔·마을 변화', types.includes('missing') && types.includes('found_dead') && knowers.length >= 2 && grief
    && S.W.regions.village.threat > control.W.regions.village.threat,
    `사건 ${[...new Set(types)].join(',')} / "죽었다" 소문을 아는 사람 ${knowers.join(',')} / 약초꾼 슬픔 ${grief} 기분 ${Math.round(herb.mental.mood)}(대조 ${Math.round(control.W.npcs.herbalist.mental.mood)}) / 마을 위협 ${Math.round(S.W.regions.village.threat)}(대조 ${Math.round(control.W.regions.village.threat)}) 경계 ${Math.round(S.W.regions.village.alert)} / 빵값 ${v.price.bread}(대조 ${vc.price.bread}) 고기값 ${v.price.dried_meat}(대조 ${vc.price.dried_meat})`);
})();

// ---------- 테스트 10: 마을을 떠났다가 며칠 뒤 돌아오면 달라져 있을 수 있다 ----------
(() => {
  const S = newGame();
  Player.teleport(S, 'village_square');
  to(S, 1, 16);
  const shot = () => {
    const v = S.W.economy.markets.village_square;
    return {
      people: Object.values(S.W.npcs).filter((n) => n.alive && Places.regionOf(n.location.loc) === 'village').map((n) => n.id).sort().join(','),
      stock: JSON.stringify(v.stock), price: JSON.stringify(v.price), rumors: Object.keys(S.W.rumors).length,
      merchantMoney: Math.round(S.W.npcs.merchant.money), threat: Math.round(S.W.regions.village.threat),
    };
  };
  const a = shot();
  Player.teleport(S, 'clearing');
  to(S, 4, 16);
  Player.teleport(S, 'village_square');
  const b = shot();
  const diff = Object.keys(a).filter((k) => a[k] !== b[k]);
  check('T10 며칠 뒤 돌아온 마을은 같지 않다', diff.length >= 2, `달라진 것: ${diff.map((k) => `${k} ${a[k]} → ${b[k]}`).join(' | ')}`);
})();

// ---------- 테스트 11: 보지 못한 사건의 진실은 화면에 나오지 않는다 ----------
(() => {
  const S = newGame();
  to(S, 2, 9);
  const attack = S.W.events.log.find((e) => e.type === 'beast_attack');
  const knowsEvent = !!S.P.found.events[attack.id];
  // 플레이어가 볼 수 있는 문장들: 움푹한 곳의 흔적, 수첩, 들은 말, 아는 곳, 만난 사람
  Player.teleport(S, 'hollow');
  const visible = [
    ...Narrative.traceLines(S, 'hollow'), ...LangUI.notebook(S).map((x) => x.t || x), ...Explore.mapLines(S).map((x) => x.t),
    ...Object.keys(KNOW).filter((k) => S.P.knowledge[k]).map((k) => KNOW[k]),
  ].join(' ');
  const leaks = ['짐승', '습격', '가시', 'deepwood', '숲 깊은 곳', 'thornback'].filter((w) => visible.includes(w));
  // 소문을 엿들어도 말을 모르면 내용은 가려진다
  const rum = Object.values(S.W.rumors)[0];
  const heard = Dialogue.process(S, { speakerId: 'lia', text: Rumor.speech(S.W, rum, 0) });
  check('T11 보지 못한 사건은 UI에 드러나지 않는다', !knowsEvent && leaks.length === 0 && !heard.fullyUnderstood && !S.P.knowledge.girl_wound,
    `습격을 아는가 ${knowsEvent} / 드러난 단어 ${leaks.join(',') || '없음'} / 엿들은 소문 "${heard.displayText}" (실제: "${Rumor.plain(S.W, rum, 0)}")`);
})();

// ---------- 테스트 12: 저장 후 불러오면 같은 세계가 이어진다 ----------
(() => {
  const S = newGame();
  atHollowWithLia(S);
  Social.help(S, 'player', 'lia', 'water', { trust: 10, suspicion: -5 });
  Dialogue.process(S, { speakerId: 'lia', text: '「[[물:10]].」' });
  Lang.learn(S, '물');
  to(S, 3, 10);
  Save.write(S);
  const loaded = Save.read();
  const same = JSON.stringify({ P: S.P, W: S.W }) === JSON.stringify({ P: loaded.P, W: loaded.W });
  const S2 = { P: loaded.P, W: loaded.W };
  to(S, 4, 10); to(S2, 4, 10);
  const a = JSON.stringify({ P: S.P, W: S.W }), b = JSON.stringify({ P: S2.P, W: S2.W });
  let firstDiff = -1;
  if (a !== b) for (let i = 0; i < a.length; i++) if (a[i] !== b[i]) { firstDiff = i; break; }
  check('T12 저장→불러오기: 시간/NPC/관계/언어/사건/위치/세계 유지, 이후도 똑같이 흐름', same && a === b && !loaded.migrated,
    `불러온 직후 같음 ${same} / 하루 더 흘린 뒤 같음 ${a === b}${firstDiff >= 0 ? ' 첫 차이: ' + a.slice(firstDiff - 80, firstDiff + 80) : ''} / 저장 크기 ${(localStorage.getItem(Save.KEY).length / 1024).toFixed(0)}KB`);
})();

// ================= 회귀: 기존 동작 =================
// R1~R3 리아가 기다려 주지 않는 시간 (예전 규칙: 못 만났으면 5시간, 믿지 못하면 30분, 믿으면 2시간)
function departure(S, from) {
  for (let i = 0; i < 80; i++) {
    World.tick(S, 5, { rest: true }); keepAlive(S); S.W.worldFlags.pending.length = 0; S.W.worldFlags.feed.length = 0;
    const L = lia(S);
    if (!(L.location.loc === 'hollow' && !L.location.transit)) return S.W.time.t - from;
  }
  return null;
}
(() => {
  const S = newGame();
  to(S, 2, 7, 5);
  Player.teleport(S, 'clearing');
  const m = departure(S, Time.at(2, 7));
  check('R1 못 만난 리아는 약 5시간 뒤 떠난다 (예전 5시간)', m != null && m >= 240 && m <= 360, `${m}분 뒤, 목적지 ${lia(S).location.dest}`);
})();
(() => {
  const S = newGame();
  atHollowWithLia(S);
  run(S, 20);
  Player.teleport(S, 'stream');
  lia(S).flags.lastSawPlayer = S.W.time.t;
  const m = departure(S, S.W.time.t);
  check('R2 믿지 못할 낯선 이가 떠나면 약 30분 뒤 자리를 옮긴다 (예전 30분)', m != null && m >= 25 && m <= 60, `${m}분 뒤, 목적지 ${lia(S).location.dest}`);
})();
(() => {
  const S = newGame();
  atHollowWithLia(S);
  Social.help(S, 'player', 'lia', 'water', { trust: 10, suspicion: -5 });
  Social.help(S, 'player', 'lia', 'herb', { trust: 20, respect: 10 });
  lia(S).physical.bleed = 0;
  run(S, 30);
  Player.teleport(S, 'stream');
  const t = S.W.time.t;
  const m = departure(S, t);
  check('R3 믿는 사람이 떠나면 약 2시간 기다린다 (예전 2시간)', m != null && m >= 100 && m <= 200, `${m}분 뒤, 목적지 ${lia(S).location.dest}, 신뢰 ${Math.round(Rel.get(S.W, 'lia', 'player').trust)}`);
})();
// R4 대본 시계: 23시 목소리에서 시간이 멈추고, 새벽에 상태창
(() => {
  const S = newGame();
  const r = World.tick(S, 9 * 60); // 15:00 → 24:00 이지만 23:00에 멈춰야 한다
  const stop = Time.clock(S.W.time.t);
  const pend1 = S.W.worldFlags.pending.slice();
  S.W.worldFlags.pending.length = 0;
  World.tick(S, Time.untilDawn(S.W.time.t), { rest: true });
  check('R4 밤의 목소리(23시)와 새벽 상태창', stop === 23 * 60 && pend1.includes('call') && S.W.worldFlags.pending.includes('status'),
    `멈춘 시각 ${stop / 60}시, 대기 ${pend1} → ${S.W.worldFlags.pending}, 줄 ${r.lines.length}`);
})();
// R5 짐승: 첫날 16:30 이후 공터에서 나타난다, 비탈 위에서는 안 나타난다
(() => {
  const S = newGame();
  to(S, 1, 16, 20);
  const early = Creatures.engages(S);
  to(S, 1, 16, 40);
  Player.teleport(S, 'hill');
  const hill = Creatures.engages(S);
  Player.teleport(S, 'clearing');
  const late = Creatures.engages(S);
  const S2 = newGame();
  Player.teleport(S2, 'downstream');
  check('R5 첫 번째 위험 조건 (16:30 이후 / 영역 / 비탈 제외)', !early && !hill && late === 'thornback' && Creatures.engages(S2) === 'thornback', `16:20 ${early} / 비탈 ${hill} / 16:40 공터 ${late}`);
})();
// R6 날씨: 첫 이틀 (회차마다 같아야 한다)
(() => {
  const a = newGame(), b = newGame();
  const wa = [], wb = [];
  Player.teleport(b, 'stream');
  for (let i = 0; i < 48; i++) { run(a, 60); run(b, 60); wa.push(a.W.weather.kind[0]); wb.push(b.W.weather.kind[0]); }
  check('R6 날씨는 플레이어 행동과 무관하게 회차마다 같다', wa.join('') === wb.join(''), `15시부터 48시간: ${wa.join('')} (c=맑음 l=흐림 r=비 f=안개)`);
})();
// R7 예전 저장 파일(v1) 옮기기
(() => {
  localStorage.removeItem(Save.KEY);
  localStorage.setItem('avernia_save_v1', JSON.stringify({ v: 1, P: { name: '서연', deaths: 2, rewinds: 2, language: { avere: 15, spirit: 1 }, words: { 물: true, 멈춰: true }, knowledge: { smoke: true }, memory: { name: true } }, R: { t: 1000 } }));
  const s = Save.read();
  const S = { P: s.P, W: s.W };
  check('R7 예전 저장 파일(v1) → 이름·지식·배운 말 유지, 세계는 처음부터', s.migrated && s.P.name === '서연' && Lang.knows(S, '물') && Lang.knows(S, '멈춰')
    && LangKnowledge.get(S, 'player', 'common_aver').understanding === 15 && s.P.knowledge.smoke && S.W.time.t === Time.START && !s.P.words && !s.P.language,
    `이해도 ${LangKnowledge.get(S, 'player', 'common_aver').understanding}, 정령어 ${LangKnowledge.get(S, 'player', 'spirit').understanding}, 단어 ${JSON.stringify(s.P.lang.knownWords)}`);
  localStorage.removeItem('avernia_save_v1');
})();
// R8 자연어 행동 (통합 명세 34절의 예)
(() => {
  const girlOpts = ['멈춰 선다. 두 손을 펴 보인다', '다가간다', '개울물을 떠다 건넨다', '상처를 살펴본다', '말을 걸어 본다', '들은 말을 되풀이해 본다',
    '거리를 두고 기다린다', '돌을 쥐고 위협한다', '날카로운 돌을 치켜들고 달려든다', '그냥 지나간다'].map((label) => ({ label }));
  const beastOpts = ['관찰한다', '날카로운 돌로 공격한다', '돌을 던진다', '바위 위로 올라간다', '숨는다', '도망친다'].map((label) => ({ label }));
  const cases = [
    ['그녀에게 물을 건네', girlOpts, '개울물을 떠다 건넨다'], ['상처를 살펴본다', girlOpts, '상처를 살펴본다'],
    ['조심스럽게 다가간다', girlOpts, '다가간다', 'careful'], ['검을 뽑지만 공격하지 않는다', girlOpts, '돌을 쥐고 위협한다'],
    ['방금 들은 단어를 다시 말해본다', girlOpts, '들은 말을 되풀이해 본다'], ['나무 뒤에 숨을래', beastOpts, '숨는다'],
    ['돌을 던져', beastOpts, '돌을 던진다'], ['냅다 도망', beastOpts, '도망친다'],
  ];
  // 탐색 화면: 실제 장소 데이터의 선택지와 키워드
  const streamOpts = [...LOCS.stream.actions, ...LOCS.stream.exits, { label: '소리를 듣는다', kw: GLOBAL_ACTIONS.listen.kw }, { label: '잠시 쉰다', kw: GLOBAL_ACTIONS.rest.kw }];
  const clearingOpts = [...LOCS.clearing.actions, ...LOCS.clearing.exits, { label: '소리를 듣는다', kw: GLOBAL_ACTIONS.listen.kw }];
  cases.push(['물을 마셔', streamOpts, '물을 마신다'], ['마신다', streamOpts, '물을 마신다'], ['발자국 좀 보자', streamOpts, '진흙의 자국을 살펴본다'],
    ['아래로 내려가 볼래', streamOpts, '계곡을 따라 내려간다'], ['좀 쉬자', streamOpts, '잠시 쉰다'], ['비탈을 올라가', clearingOpts, '비탈을 올라간다'],
    ['주변을 조사해', clearingOpts, '주변을 조사한다'], ['귀를 기울인다', clearingOpts, '소리를 듣는다']);
  const res = cases.map(([text, opts, want, manner]) => {
    const m = Intent.match(opts, text);
    return { text, got: m && m.option.label, ok: m && m.option.label === want && (!manner || m.manner === manner) };
  });
  check('R8 자연어 입력 → 알맞은 선택지', res.every((r) => r.ok), res.map((r) => `${r.ok ? '✓' : '✗'} "${r.text}"→${r.got}`).join(' / '));
})();
// R10 리아의 첫날: 숲 깊은 곳에서 사냥하고 야영한다. 새벽 습격 뒤 7시에 움푹한 곳에 닿는다.
(() => {
  const S = newGame();
  const where = [];
  [[1, 18], [1, 23], [2, 5], [2, 6, 30], [2, 7, 5]].forEach(([d, h, m]) => {
    to(S, d, h, m || 0, { step: 5 });
    const L = lia(S);
    where.push(`${d}일 ${h}:${m || '00'} ${L.location.loc}${L.location.transit ? '→' + L.location.dest : ''} ${L.currentAction && L.currentAction.type}`);
  });
  const L = lia(S);
  check('R10 리아의 첫날 (숲 깊은 곳 → 새벽 습격 → 7시 움푹한 곳)', where[1].includes('deepwood') && where[2].includes('deepwood') && L.location.loc === 'hollow' && !L.location.transit,
    where.join(' / '));
})();
// R9 성능: 열흘
(() => {
  const S = newGame();
  const t0 = Date.now();
  to(S, 11, 15, 0, { step: 60 });
  const ms = Date.now() - t0;
  check('R9 열흘 시뮬레이션 성능', ms < 3000, `${ms}ms, 사건 ${S.W.events.log.length}개, 소문 ${Object.keys(S.W.rumors).length}개, 저장 크기 ${(JSON.stringify(S).length / 1024).toFixed(0)}KB`);
})();
