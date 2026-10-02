// 마을 하르넨 [D7] · 노파의 상처 [D9] · 리아의 집 [D10] · 말을 가르쳐 주는 사람 [D11] · 임시 이름 NPC[역할] [D12]

// V1 장소 8곳: 울타리·광장·여관 겸 밥집·약초집·밭·대장간·작은 예배당·길드 연락소(닫혀 있음). 모두 광장에서 걸어갈 수 있다
(() => {
  const want = ['village_gate', 'village_square', 'village_inn', 'village_herbhouse', 'village_field', 'village_smithy', 'village_chapel', 'village_guild'];
  const missing = want.filter((id) => !PLACE_DATA[id] || !LOCS[id] || PLACE_DATA[id].region !== 'village');
  const unreachable = want.filter((id) => id !== 'village_square' && !Places.route('village_square', id));
  const fromSquare = LOCS.village_square.exits.map((e) => e.to);
  const S = newGame();
  const closed = LOCS.village_guild.desc({ W: S.W }).join(' ');
  S.W.worldFlags.guildOpen = true;
  const open = LOCS.village_guild.desc({ W: S.W }).join(' ');
  check('V1 하르넨 장소 8곳 → 모두 있고 광장에서 갈 수 있으며, 길드 연락소는 처음에 닫혀 있다', !missing.length && !unreachable.length
    && want.filter((id) => id !== 'village_square').every((id) => fromSquare.includes(id)) && /닫혀/.test(closed) && !/닫혀/.test(open) && REGION_DATA.village.name === '하르넨',
    `빠진 곳 ${missing.join(',') || '없음'}, 못 가는 곳 ${unreachable.join(',') || '없음'}, 지역 이름 ${REGION_DATA.village.name}`);
})();

// V2 사람: 여관 주인·또래·마을 아이가 생겼고, 행상은 방문하는 사람이다. 리아와 노파는 약초집에 산다 [D10]
(() => {
  const S = newGame();
  const N = S.W.npcs;
  const ok = ['innkeeper', 'peer', 'child'].every((id) => N[id] && N[id].role === 'resident') && N.peddler.role === 'visitor'
    && N.lia.location.home === 'village_herbhouse' && N.herbalist.location.home === 'village_herbhouse' && N.innkeeper.location.home === 'village_inn';
  // 저녁 7시, 광장에 사람들이 모인다 / 여관 주인은 여관에
  to(S, 3, 19);
  const square = Npc.here(S.W, 'village_square').map((n) => n.id).sort().join(',');
  const inn = Npc.at(S.W, 'innkeeper', 'village_inn');
  const rep = LifeLog.reputation(S);
  check('V2 하르넨 사람들 → 여관 주인·또래·마을 아이, 행상은 방문자(평판에 안 셈), 리아는 노파와 약초집에', ok && inn && !Object.values(rep).some((R) => R.people && rep.far && rep.far.people),
    `저녁 광장 ${square}, 여관 주인 여관에 ${inn}, 평판을 세는 지역 ${Object.keys(rep).join(',')}`);
})();

// V3 노파 [D9]: 채집하러 나가지 않고 집에서 손질·치료한다. 약초로 상처를 관리하고, 약초가 없으면 관리하지 못한 날이 쌓인다
(() => {
  const S = newGame();
  const h = S.W.npcs.herbalist;
  const where = [];
  for (const hr of [7, 9, 14, 16]) { to(S, 3, hr); where.push(h.location.loc); }
  const gathers = h.schedule.some(([, , act, at]) => act === 'gather' || at === 'village_field');
  // 새벽마다의 관리 (World.daily → Condition.daily): 약초가 있으면 하나 쓰고, 없으면 관리하지 못한 날이 쌓인다
  h.inventory.herb = 1;
  Condition.daily(S);
  const used = h.inventory.herb === 0 && h.physical.chronic.herbless === 0;
  Condition.daily(S);
  const missed = h.physical.chronic.herbless === 1 && h.physical.chronic.stage === 'managed';
  check('V3 노파의 상처 → 낮에는 약초집에서 일하고(채집 없음), 날마다 약초 하나로 관리한다 (단계는 사건이 바꾼다)', !gathers && where.every((l) => l === 'village_herbhouse') && used && missed
    && h.physical.maxHealth === RULES.conditions.old_beast_wound.stages.managed.maxHealth,
    `낮의 자리 ${where.join(',')}, 일정에 채집 ${gathers}, 약초 하나 썼음 ${used}, 없는 날 쌓임 ${missed}`);
})();

// V4 노파의 단계: 병상(bedridden)이 끝이다. 죽지 않고, 쓰러짐 규칙과 얽히지 않으며, 병상에서는 일을 맡기지 않는다
(() => {
  const S = newGame();
  const h = S.W.npcs.herbalist;
  const steps = [Condition.shift(S, h, 1), Condition.shift(S, h, 1), Condition.shift(S, h, 1)];
  h.inventory.herb = 0;
  for (let d = 3; d <= 12; d++) to(S, d, 14);
  inVillage(S, 'village_herbhouse', 12, 14);
  const jobs = Work.available(S).map((j) => j.id);
  const bed = h.physical.chronic.stage, alive = h.alive, hp = Math.round(h.physical.health);
  const travel = Condition.canTravel(h);
  const stayed = h.location.loc === 'village_herbhouse';
  const back = Condition.shift(S, h, -1);
  check('V4 노파의 병상 → 한 단계씩 나빠지다 병상에서 멈추고, 열흘을 약초 없이 지내도 살아 있다', steps.join() === 'true,true,false' && bed === 'bedridden' && alive && hp > 0
    && !travel && stayed && !jobs.includes('herbs') && back && h.physical.chronic.stage === 'unsteady' && S.W.player.collapses === undefined,
    `단계 변화 ${steps.join(',')} → ${bed}, 열흘 뒤 살아 있음 ${alive} 체력 ${hp}/${h.physical.maxHealth}, 집에 머묾 ${stayed}, 맡길 일 ${jobs.join(',') || '없음'}, 한 단계 회복 → ${h.physical.chronic.stage}`);
})();

// V5 말을 가르쳐 주는 사람 [D11]: 리아·마을 아이·또래만 가르친다. 아이는 쉽게(낮은 신뢰로) 가르쳐 준다
(() => {
  const S = newGame();
  const N = S.W.npcs;
  const teachers = Object.values(N).filter((n) => n.teach).map((n) => n.id).sort().join(',');
  Rel.get(S.W, 'child', 'player').trust = 20;
  Rel.get(S.W, 'gatekeeper', 'player').trust = 90;
  Npc.place(S, N.child, 'village_square'); Npc.place(S, N.gatekeeper, 'village_square');
  const child = Lang.canTeach(S, N.child), guard = Lang.canTeach(S, N.gatekeeper);
  check('V5 말 가르치기 → 리아·마을 아이·또래만, 아이는 신뢰가 낮아도 가르쳐 준다', teachers === 'child,lia,peer' && child && !guard && N.child.teach.minTrust < N.lia.teach.minTrust,
    `가르치는 사람 ${teachers}, 아이 ${child}, 문지기(신뢰 90) ${guard}`);
})();

// V6 임시 이름 [D12]: 이름을 알기 전에는 겉모습, 안 뒤에는 NPC[역할]. 조사는 대괄호 앞 글자로 붙고, 대사 표기 안에서도 깨지지 않는다
(() => {
  const S = newGame();
  const g = S.W.npcs.gatekeeper;
  const before = Narrative.who(S, g, true);
  Knowledge.learnName(S, 'gatekeeper');
  const after = Narrative.who(S, g);
  const josa = ['NPC[문지기]', 'NPC[여관 주인]', 'NPC[상인]', 'NPC[마을 아이]'].map((w) => w + Text.josa(w, '이가') + '/' + w + Text.josa(w, '을를')).join(' ');
  const r = Dialogue.process(S, { speakerId: 'lia', listenerId: 'player', text: '「[[{target}:0]]가 [[죽었어:30]].」', vars: { target: 'NPC[문지기]' } });
  const rum = Rumor.create(S, ['lia'], { type: 'died', target: 'gatekeeper' });
  const plain = Rumor.plain(S.W, rum, 0);
  check('V6 임시 이름 → 알기 전 "창을 든 남자", 안 뒤 "NPC[문지기]", 조사와 대사 표기가 맞다', before === '창을 든 남자' && after === 'NPC[문지기]'
    && josa === 'NPC[문지기]가/NPC[문지기]를 NPC[여관 주인]이/NPC[여관 주인]을 NPC[상인]이/NPC[상인]을 NPC[마을 아이]가/NPC[마을 아이]를'
    && r.displayText.includes('NPC[문지기]') && !/\[\[/.test(r.displayText) && plain.includes('NPC[문지기]') && !/\[\[/.test(plain),
    `${before} → ${after} / ${josa} / 대사 "${r.displayText}" / 소문 "${plain}"`);
})();

// V7 예전 저장 파일: 이름이 비어 있던 저장도 불러오면 지금의 이름·집·일정을 따른다 (이름은 npcs.js 한 곳만 바꾸면 된다)
(() => {
  const S = newGame();
  const W = JSON.parse(JSON.stringify(S.W));
  W.npcs.gatekeeper.identity.name = null;
  W.npcs.lia.location.home = 'village_homes';
  W.npcs.herbalist.schedule = [[0, 24, 'gather', 'village_field']];
  delete W.npcs.herbalist.physical.chronic;
  delete W.npcs.innkeeper;
  const s = Save.load({ v: 2, P: JSON.parse(JSON.stringify(S.P)), W });
  const N = s.W.npcs;
  check('V7 예전 저장 파일 → 불러오면 이름·집·일정·상처가 지금 데이터를 따르고, 새 사람도 생긴다', N.gatekeeper.identity.name === 'NPC[문지기]'
    && N.lia.location.home === 'village_herbhouse' && !N.herbalist.schedule.some((x) => x[2] === 'gather') && N.herbalist.physical.chronic && !!N.innkeeper,
    `문지기 이름 ${N.gatekeeper.identity.name}, 리아의 집 ${N.lia.location.home}, 노파 상처 ${N.herbalist.physical.chronic && N.herbalist.physical.chronic.stage}, 여관 주인 ${!!N.innkeeper}`);
})();
