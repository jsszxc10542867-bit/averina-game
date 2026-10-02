// 대화 (언어 시스템 23·24·30·31절): 누가 어떤 언어로 말하는가, 듣는 사람이 무엇을 받아들이는가,
// 듣기만 해도 조금씩 익숙해지는 것, 플레이어가 말을 따라 해 보는 것, 가르침, 통역, 읽기.
const Dialogue = (() => {
  // 말하는 사람이 고르는 언어: 자기가 말할 수 있는 언어 가운데 듣는 사람이 가장 잘 알아듣는 것
  function speakerLanguage(S, speakerId, listenerId) {
    const sp = LangKnowledge.profile(S, speakerId);
    const cands = Object.keys(sp).filter((k) => sp[k].speaking >= 30);
    if (!cands.length) return 'common_aver';
    return cands.sort((a, b) => (LangKnowledge.get(S, listenerId, b).understanding - LangKnowledge.get(S, listenerId, a).understanding)
      || (sp[b].speaking - sp[a].speaking))[0];
  }

  // o: { speakerId, listenerId='player', dialogueId | text, vars, lang, fullAt }
  function process(S, o) {
    const listener = o.listenerId || 'player';
    const d = o.dialogueId ? DIALOGUES[o.dialogueId] : null;
    if (o.dialogueId && !d) throw new Error('없는 대사: ' + o.dialogueId);
    const lang = o.lang || (d && d.lang) || (o.speakerId ? speakerLanguage(S, o.speakerId, listener) : 'common_aver');
    if (d) Bus.emit(S, 'DIALOGUE_STARTED', { dialogueId: o.dialogueId, speakerId: o.speakerId || null, listenerId: listener });
    const r = LangResolver.resolve(S, { text: d ? d.text : o.text, lang, listenerId: listener, speakerId: o.speakerId, vars: o.vars, fullAt: o.fullAt });
    if (listener === 'player') hear(S, lang, r);
    // 거의 알아듣지 못하면, 말투와 몸짓으로 분위기만 짐작한다 (통합 명세 15절)
    r.tone = d && r.understanding < 0.5 ? d.tone : null;
    r.semantic = d ? JSON.parse(LangParser.fill(JSON.stringify(d.semantic), o.vars)) : null;
    r.misheard.forEach((m) => Bus.emit(S, 'LANGUAGE_MISUNDERSTOOD', { entityId: listener, languageId: lang, wordId: m.wordId, heard: m.heard }));
    if (r.fullyUnderstood && o.dialogueId && listener === 'player' && !S.P.lang.understood[o.dialogueId]) {
      S.P.lang.understood[o.dialogueId] = S.W.time.t;
      Bus.emit(S, 'LANGUAGE_FULLY_UNDERSTOOD', { entityId: listener, languageId: lang, dialogueId: o.dialogueId });
    }
    if (d) Bus.emit(S, 'DIALOGUE_COMPLETED', { dialogueId: o.dialogueId, speakerId: o.speakerId || null, listenerId: listener, understanding: r.understanding });
    return r;
  }

  // 반복해서 듣기: 들을 때마다 그 소리가 조금 더 귀에 익는다 (뜻은 모른 채로)
  function hear(S, lang, r) {
    r.tokens.forEach((x) => { if (x.th > 0) LangLearning.learn(S, { type: 'heard_word', language: lang, wordId: x.wordId, source: 'heard' }); });
  }

  // 플레이어가 들은 말을 NPC에게 따라 해 본다 (말하기). 통하면 확신과 말하기가 오른다.
  function playerSays(S, npcId, wordId, lang = 'common_aver') {
    const heard = LangKnowledge.get(S, npcId, lang).understanding >= 50;
    const conf = LangKnowledge.word(S, 'player', lang, wordId).confidence;
    const success = heard && conf >= LangKnowledge.GUESS;
    LangLearning.learn(S, { type: success ? 'successful_conversation' : 'failed_conversation', language: lang, wordId, source: 'spoke:' + npcId });
    if (success) Rel.change(S, npcId, 'player', { trust: 2, suspicion: -3, familiarity: 2 }, 'spoke_language');
    return { success, heard };
  }

  // ---------- 가르침 (통합 명세 17절: 호의적인 NPC는 직접 가르쳐 준다) ----------
  const POINT_AT = { water: '개울 쪽', tree: '나무', stone: '발치의 돌', sky: '하늘', hand: '자기 손', blood: '팔에 밴 피' };
  function teachable(S, n) {
    const f = (PLACE_DATA[n.location.loc] || { features: [] }).features;
    const ids = [...new Set(f.map((x) => TEACHABLE[x]).filter(Boolean).concat(TEACH_ALWAYS))];
    return ids.filter((id) => LangKnowledge.word(S, 'player', 'common_aver', id).confidence < LangKnowledge.KNOWN);
  }
  // 말을 가르쳐 주는 사람만 가르친다 [결정 D11: 리아 · 마을 아이 · 또래 — NPC_DEFS의 teach]
  const canTeach = (S, n) => !!n.teach && LangKnowledge.get(S, n.id, 'common_aver').speaking >= 60 && teachable(S, n).length > 0;

  function teach(S, n) {
    const id = teachable(S, n)[0];
    if (!id) return false;
    const w = LangRegistry.word(id);
    const snd = LangRegistry.sound(id);
    const who = Narrative.who(S, n);
    const lines = [`${who}${Text.josa(who, '이가')} ${POINT_AT[id]}${Text.josa(POINT_AT[id], '을를')} 가리킨다.`, `「${snd}.」`, '한 번 더, 천천히.', `「${snd}.」`];
    const r = LangLearning.learn(S, { type: 'teacher_lesson', language: 'common_aver', wordId: id, source: 'teach:' + n.id });
    lines.push(r.newlyKnown ? { t: `……"${w.meaning}". 그런 뜻인 것 같다.`, cls: 'know' } : '……무슨 뜻인지 어렴풋이 알 것 같다.');
    Memory.add(S, n, { type: 'taught', subject: 'player', detail: id });
    Rel.change(S, n.id, 'player', { familiarity: 3, affection: 2 }, 'taught', true);
    lines.forEach((l) => S.W.worldFlags.feed.push(l));
    return true;
  }

  // ---------- 통역 (언어 31절) ----------
  // 통역하는 사람이 원래 말을 알아듣는 만큼, 옮길 말을 할 줄 아는 만큼 전해진다.
  // 쉬운 핵심 단어는 살아남고 어려운 말부터 빠진다 (단순 곱셈이 아니다).
  function interpret(S, o) {
    const { W } = S;
    const ip = LangKnowledge.get(S, o.interpreterId, o.from);
    const op = LangKnowledge.get(S, o.interpreterId, o.to);
    const acc = (ip.understanding / 100) * (op.speaking / 100);
    const p = LangParser.parse(o.text, o.vars);
    const kept = p.tokens.map((tk) => ({ tk, keep: acc >= 0.95 || Rng.next(W) < acc * (1.2 - tk.th / 100) }));
    let i = 0;
    const relayed = p.text.replace(LangParser.RE, () => { const k = kept[i++]; return k.keep ? `[[${k.tk.surface}:${k.tk.th}]]` : '……'; })
      .replace(/(……\s*){2,}/g, '…… ');
    const r = LangResolver.resolve(S, { text: relayed, lang: o.to, listenerId: o.listenerId || 'player', speakerId: o.interpreterId });
    r.accuracy = Math.round(acc * 100) / 100;
    r.lost = kept.filter((k) => !k.keep).map((k) => k.tk.wordId);
    Bus.emit(S, 'TRANSLATION_PERFORMED', { interpreterId: o.interpreterId, from: o.from, to: o.to, accuracy: r.accuracy, lost: r.lost.length });
    return r;
  }

  // ---------- 읽기 (언어 30절: 말을 알아들어도 글은 못 읽을 수 있다) ----------
  function read(S, o) {
    const r = LangResolver.resolve(S, { text: o.text, lang: o.lang, listenerId: o.readerId || 'player', vars: o.vars, reading: true });
    if ((o.readerId || 'player') === 'player') {
      r.tokens.filter((x) => x.state !== 'unknown').forEach((x) => LangLearning.learn(S, { type: 'reading', language: o.lang, wordId: x.wordId, source: 'read' }));
    }
    return r;
  }

  return { speakerLanguage, process, hear, playerSays, teachable, canTeach, teach, interpret, read };
})();

if (typeof module !== 'undefined') module.exports = { Dialogue };
