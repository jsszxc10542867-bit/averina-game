// 단계 5 장면 문장 — 하르넨의 첫 저녁과 첫 밤 (스토리설계.md, 2026-10-02 스토리 총괄)

// 장소 묘사를 엔진처럼 부른다 (g.first는 W.worldFlags.seen에 남는다)
function placeText(S, loc) {
  const W = S.W;
  const g = { W, P: S.P, me: W.player, period: Time.band(W.time.t), dark: Time.dark(W.time.t),
    first(key) { if (W.worldFlags.seen[key]) return false; W.worldFlags.seen[key] = true; return true; } };
  return LOCS[loc].desc(g).filter((x) => typeof x === 'string').join(' ');
}
const text = (lines) => lines.map((l) => (typeof l === 'string' ? l : l && l.t) || '').join(' ');

// SF1 첫인상 세 가지 [D7]: 처음 볼 때만 [처음] 문장, 그다음은 평소 문장. 짐승 자국 셋째 줄은 리아의 상처를 살펴봤을 때만
(() => {
  const S = newGame();
  to(S, 2, 16);
  const sq1 = placeText(S, 'village_square'), sq2 = placeText(S, 'village_square');
  const gate1 = placeText(S, 'village_gate');
  const T = newGame(); to(T, 2, 16); T.P.knowledge.girl_wound = T.W.time.t;
  const gate2 = placeText(T, 'village_gate');
  T.W.worldFlags.cameWithLia = true;
  const herb = placeText(T, 'village_herbhouse');
  check('SF1 첫인상 → 우물·풀 다발·발톱 자국의 [처음] 문장은 한 번만, 리아의 상처를 봤을 때만 "같은 모양"', /마을보다 우물이 먼저/.test(sq1) && /거꾸로 매달려/.test(sq1)
    && !/우물이 먼저/.test(sq2) && /처마마다 마른 풀 다발/.test(sq2) && /손가락이 홈에 걸린다/.test(gate1) && !/같은 모양/.test(gate1)
    && /같은 모양/.test(gate2) && /몇 배는 많다/.test(herb) && /리아가 들어간 집이다/.test(herb),
    `처음 광장 "${sq1.slice(0, 40)}…", 다음 광장 "${sq2.slice(0, 40)}…", 리아 상처 모름 → 같은 모양 ${/같은 모양/.test(gate1)}, 앎 → ${/같은 모양/.test(gate2)}`);
})();

// SF2 처음 들어선 저녁의 광장: 말소리가 끊긴다. 보증을 받았으면 "들은 눈치", 위협 소문이 돌면 문을 닫는다. 밤이면 비어 있다
(() => {
  const at = (h, fn) => { const S = newGame(); to(S, 2, h); if (fn) fn(S); return placeText(S, 'village_square'); };
  const plain = at(19), vouched = at(19, (S) => { S.W.worldFlags.vouched = true; });
  const feared = at(19, (S) => { Rumor.create(S, ['merchant'], { type: 'threatened', subject: 'player', target: 'lia' }); });
  const night = at(21);
  check('SF2 처음 들어선 저녁 → 말소리가 끊기고, 보증·위협 소문에 따라 다르며, 밤에는 광장이 비어 있다', /말소리가 뚝 끊긴다/.test(plain) && /다시 저희끼리/.test(plain)
    && /들은 눈치/.test(vouched) && /문을 닫는다/.test(feared) && !/다시 저희끼리/.test(feared) && /광장은 비어 있다/.test(night),
    `보통 ${/다시 저희끼리/.test(plain)}, 보증 ${/들은 눈치/.test(vouched)}, 위협 소문 ${/문을 닫는다/.test(feared)}, 밤 ${/비어 있다/.test(night)}`);
})();

// SF3 첫 잠자리의 선택지 문구: 거처 이름도 값도 보이지 않는다
(() => {
  const labels = Object.keys(RULES.lodgings).map((id) => Lodging.label(id));
  const S = newGame(); inVillage(S, 'village_gate', 2, 19); keepAlive(S);
  const opts = Life.options(S, (m, o) => { World.tick(S, m, o); return []; }).filter((o) => /자리|담요|헛간|계단|주머니/.test(o.label));
  check('SF3 잠자리 선택지 → 다섯 문구 모두 행동으로만 (이름·값 없음)', labels.every((l) => !/닢|헛간\)|여관 방|예배당|울타리 밑|노숙/.test(l)) && opts.every((o) => !o.hint),
    labels.join(' / '));
})();

// SF4 헛간: 노파가 리아 쪽을 보고 한 마디로 내준다. 헛간 안 [처음] 줄은 한 번만
(() => {
  const S = newGame();
  inVillage(S, 'village_herbhouse', 2, 19);
  Npc.place(S, S.W.npcs.herbalist, 'village_herbhouse'); Npc.place(S, S.W.npcs.lia, 'village_herbhouse');
  Rel.get(S.W, 'herbalist', 'player').trust = 40;
  const a = Lodging.take(S, 'barn', (m, o) => { World.tick(S, m, o); return []; });
  const b = Lodging.take(S, 'barn', (m, o) => { World.tick(S, m, o); return []; });
  const said = a.find((l) => l && l.cls === 'speech');
  check('SF4 헛간 → "리아 쪽을 한 번 본다", 노파의 한 마디(대사 줄), 헛간 안 [처음] 줄은 첫 번째에만', /리아 쪽을 한 번 본다/.test(text(a)) && said && said.who === 'herbalist'
    && /천장까지 쌓여/.test(text(a)) && !/천장까지 쌓여/.test(text(b)),
    `첫 번째: ${text(a).slice(0, 60)}… / 두 번째에 헛간 안 줄 ${/천장까지/.test(text(b))}`);
})();

// SF5 노숙의 첫 밤과 첫 아침: 숲의 소리(밤의 목소리를 들었으면 그 확인), 문지기의 천, 이슬 젖은 아침, "두 번째 아침"(셋째 날일 때만). 쓰러짐 없음
(() => {
  const S = newGame();
  S.P.knowledge.name_call = 1400;
  inVillage(S, 'village_gate', 2, 18);
  keepAlive(S);
  Lodging.take(S, 'rough');
  Npc.place(S, S.W.npcs.gatekeeper, 'village_gate');
  Rel.get(S.W, 'gatekeeper', 'player').trust = 25;
  const lines = text(Lodging.sleep(S, (m, o) => { World.tick(S, m, o); return []; }));
  const S2 = newGame();
  inVillage(S2, 'village_inn', 3, 16); keepAlive(S2);
  Lodging.take(S2, 'room_work', (m, o) => { World.tick(S2, m, o); return []; });
  to(S2, 3, 21); Player.teleport(S2, 'village_inn'); keepAlive(S2);
  const inn = text(Lodging.sleep(S2, (m, o) => { World.tick(S2, m, o); return []; }));
  check('SF5 노숙 첫 밤 → 숲의 소리·"이름을 부르는 소리는 아니다"·문지기의 천, 첫 아침은 이슬과 "두 번째 아침"(셋째 날만). 여관 첫 아침에는 그 줄이 없다',
    /무언가 우는 소리/.test(lines) && /이름을 부르는 소리는 아니다/.test(lines) && /거친 천 한 장/.test(lines) && /이슬에 옷이 젖어/.test(lines)
    && /두 번째 아침/.test(lines) && /그릇 부딪히는 소리/.test(inn) && !/두 번째 아침/.test(inn) && S.P.collapses === 0 && S.W.player.hp > 0,
    `노숙: ${lines.slice(0, 80)}… / 여관(넷째 날 아침): ${inn.slice(0, 40)}…`);
})();

// SF6 처음 만나는 사람의 첫마디: 여관 주인은 밥·방을 묻고, 노파는 소문을 들었으면 "숲의 이방인", 아니면 "누구?". 의심이 크면 따져 묻는 것이 먼저
__pending.push((async () => {
  const name = 'SF6 사람별 첫마디 → 여관 주인의 모습과 첫마디, 노파는 소문을 들었을 때와 아닐 때가 다르고, 의심이 크면 따져 묻는다';
  try {
    const meet = async (id, loc, h, fn) => {
      const S = newGame();
      inVillage(S, loc, 2, h); keepAlive(S);
      Npc.place(S, S.W.npcs[id], loc);
      if (fn) fn(S);
      const ui = fakeUi(S, ['물러선다']);
      const pages = [];
      ui.page = async (lines) => { pages.push(text(lines)); };
      await Encounter.run(ui, id);
      return pages[0] || '';
    };
    const inn = await meet('innkeeper', 'village_inn', 19);
    const heard = await meet('herbalist', 'village_herbhouse', 19, (S) => { Rumor.create(S, ['herbalist'], { type: 'stranger_seen', subject: 'player', target: 'gatekeeper' }); });
    const unknown = await meet('herbalist', 'village_herbhouse', 19);
    const wary = await meet('innkeeper', 'village_inn', 19, (S) => { Rel.get(S.W, 'innkeeper', 'player').suspicion = 80; });
    check(name, /국자를 든 채/.test(inn) && /계단 위를 가리킨다/.test(inn) && /이미 알고 있다는 투/.test(heard) && /누구냐고 묻는 것 같다/.test(unknown)
      && /국자를 든 채/.test(wary) && !/계단 위를 가리킨다/.test(wary),
      `여관 주인: ${inn.slice(0, 50)}… / 소문 들은 노파 ${/이미 알고/.test(heard)}, 모르는 노파 ${/누구냐고/.test(unknown)}, 의심 큰 여관 주인은 밥·방 대신 ${wary.slice(-30)}`);
  } catch (e) { check(name, false, String(e && e.stack || e)); }
})());
