// 화면(js/ui)이 쓰는 시스템 연결점 (디자인_가이드.md 9절 요청 3·6·7·8). 엔진(window.Avernia)은 브라우저에서 확인한다.

// U1 저장 칸: 손 저장 칸은 자동 칸과 따로 남고, "처음부터"(자동 칸 지우기)에도 지워지지 않는다
(() => {
  const S = newGame();
  to(S, 1, 18);
  const ok = Save.write(S, 1);
  Save.write(S);
  Save.clear();
  const list = Save.list();
  const one = list.find((x) => x.slot === 1), auto = list.find((x) => x.slot === 'auto');
  const back = Save.read(1);
  const same = back && JSON.stringify({ P: back.P, W: back.W }) === JSON.stringify({ P: S.P, W: S.W });
  Save.clear(1);
  const gone = Save.list().find((x) => x.slot === 1).empty;
  check('U1 저장 칸 → 손 저장은 자동 칸과 따로 남고, 같은 세계로 불러온다', ok && auto.empty && one.name === '민준' && one.t === S.W.time.t && same && gone,
    `칸 ${list.map((x) => `${x.slot}:${x.empty ? '빈칸' : x.name}`).join(' ')}, 불러온 세계 같음 ${same}, 지운 뒤 빈칸 ${gone}`);
})();

// U2 기록: 알아낸 사실은 처음 알아낸 시각을 갖고, 본 사건은 아는 이름으로 문장이 된다
(() => {
  const S = newGame();
  atHollowWithLia(S);
  const t = S.W.time.t;
  if (!S.P.knowledge.girl_wound) S.P.knowledge.girl_wound = t;
  Social.help(S, 'player', 'lia', 'water', { trust: 10 });
  const before = Knowledge.eventLines(S).map((x) => x.text);
  Knowledge.learnName(S, 'lia');
  const after = Knowledge.eventLines(S).map((x) => x.text);
  check('U2 기록 → 본 사건이 문장이 되고, 이름을 알기 전에는 겉모습으로 부른다', typeof S.P.knowledge.girl_wound === 'number'
    && before.some((x) => /젊은 여자를 도왔다/.test(x)) && after.some((x) => /리아를 도왔다/.test(x)) && !before.some((x) => /리아/.test(x)),
    `이름 모를 때 "${before.join(' / ')}" → 안 뒤 "${after.join(' / ')}"`);
})();

// U3 물건 설명: 겉보기만 보이고, 알아낸 뒤에야 쓰임이 붙는다
(() => {
  const S = newGame();
  const a = Player.describe('herb', S.P);
  S.P.knowledge.herb_heals = S.W.time.t;
  const b = Player.describe('herb', S.P);
  check('U3 물건 설명 → 쓴 풀의 쓰임은 알아낸 뒤에만 보인다', a && !/피가 멎/.test(a) && /피가 멎/.test(b) && Object.keys(ITEM_DEFS).every((k) => ITEM_DEFS[k].desc),
    `모를 때 "${a}" / 안 뒤 "${b}"`);
})();

// U4 대사 줄: NPC의 말은 { cls: 'speech', who } 줄로 나온다 (화면이 이름표를 붙인다)
(() => {
  const S = newGame();
  to(S, 2, 7); Player.teleport(S, 'village_field');
  const lines = Work.available(S).some((j) => j.id === 'field') ? Work.perform(S, 'field', (m, o) => { World.tick(S, m, o); return []; }) : [];
  const said = lines.filter((l) => l && typeof l === 'object' && l.cls === 'speech');
  const worked = Knowledge.eventLines(S).some((x) => /일을 거들었다/.test(x.text));
  check('U4 대사 줄 → 말한 사람의 id가 붙고, 거든 일은 기록에 남는다', said.length === 1 && said[0].who === 'farmer' && worked,
    `대사 ${said.map((l) => `${l.who}: ${l.t}`).join(' / ') || '없음'}, 기록에 일 ${worked}`);
})();

// U5 낯선 소리 조각: 못 알아들은 말은 parts로 나뉘어 화면이 따로 꾸민다. 글자는 displayText와 똑같다
(() => {
  const S = newGame();
  const r = Dialogue.process(S, { speakerId: 'lia', listenerId: 'player', text: '「[[어디:30]]서 [[왔:30]]어? [[물:10]]?」' });
  const L = Lang.line(r, 'lia');
  const joined = r.parts ? r.parts.map((x) => x.s).join('') : null;
  const foreign = r.parts ? r.parts.filter((x) => x.foreign).map((x) => x.s) : [];
  const plain = Dialogue.process(S, { speakerId: 'lia', listenerId: 'player', text: '「물.」' });
  check('U5 낯선 소리 조각 → parts의 글자를 이으면 화면 문장과 같고, 낯선 소리만 foreign이다', joined === r.displayText && foreign.length >= 1
    && foreign.every((s) => r.displayText.includes(s) && !/[「」?]/.test(s)) && L.parts === r.parts && !/[\u0001\u0002]/.test(r.displayText) && plain.parts == null,
    `"${r.displayText}" → ${r.parts ? r.parts.map((x) => (x.foreign ? `[${x.s}]` : x.s)).join('') : '없음'}`);
})();
