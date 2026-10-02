// 화면용 데이터 (디자인담당). 시스템 상태 S를 읽기만 하고 절대 바꾸지 않는다.
// 메뉴의 각 화면은 이 파일이 만든 "보여 줄 것"만 그린다. 숫자·플래그·내부 이름은 여기서 걸러진다.
// 시스템 상태를 얻는 곳은 source() 한 곳뿐이다: 공식 연결점 window.Avernia (시스템구조.md 9-1절)
const UIData = (() => {
  const source = () => (window.Avernia && window.Avernia.state ? window.Avernia.state() : null);
  const J = (w, t) => (typeof Text !== 'undefined' ? w + Text.josa(w, t) : w);

  // 시각 → "둘째 날 저녁" (분 단위 시각은 보여 주지 않는다: 시계가 없는 사람이다)
  function when(t) {
    if (t == null) return '';
    return `${Time.dayLabel(t)} ${Time.KO[Time.band(t)]}`;
  }
  const npcName = (S, id) => {
    const f = S.P.found.npcs[id];
    const n = S.W.npcs[id];
    if (f && f.name) return f.name;
    return n ? n.identity.desc : '누군가';
  };

  // 지역 이름은 그 지역에 발을 들인 뒤에만 고유 이름(예: 하르넨)으로 부른다. 그 전에는 보통 말로.
  const REGION_PLAIN = { forest: '숲', village: '마을', road: '큰길', far: '먼 곳' };
  function regionLabel(S, rid) {
    const d = REGION_DATA[rid];
    if (!d) return '';
    const been = Object.keys(PLACE_DATA).some((id) => Places.regionOf(id) === rid
      && (S.W.player.loc === id || Knowledge.RANK.indexOf(Knowledge.locState(S.P, id)) >= Knowledge.RANK.indexOf('visited')));
    return been ? d.name : (REGION_PLAIN[rid] || d.name);
  }

  // ---------- 지금 ----------
  function now(S) {
    const { W, P } = S;
    const me = W.player;
    const t = W.time.t;
    const lodging = me.lodging && RULES.lodgings[me.lodging.id];
    return {
      day: Time.dayLabel(t),
      band: Time.KO[Time.band(t)],
      place: Places.name(me.loc),
      region: regionLabel(S, Places.regionOf(me.loc)),
      name: P.name,
      body: Player.barWords(W),
      feeling: Player.hpFeeling(me),
      money: me.money || 0,
      lodging: lodging ? lodging.label : null,
      companions: (me.companions || []).map((id) => npcName(S, id)),
      // 상태창은 열린 뒤에만, 시스템이 만든 문장 그대로 (숫자는 플레이어가 알게 된 것만 나온다)
      status: me.status.unlocked ? Player.statusLines(me, P.name || '') : null,
    };
  }

  // ---------- 이야기 기록 ----------
  // 시각이 남는 것만 날짜별로 묶는다. 시각이 없는 "알아낸 것"은 따로 모은다.
  function journal(S) {
    const { W, P } = S;
    const me = W.player;
    const items = [];
    if (P.name) items.push({ t: Time.START, text: '낯선 숲에서 눈을 떴다.' });
    Object.entries(P.found.npcs).forEach(([id, f]) => {
      if (f.first != null) items.push({ t: f.first, text: `${J(npcName(S, id), '을를')} 처음 만났다.` });
    });
    Object.entries(P.clues || {}).forEach(([id, c]) => {
      const d = RULES.clues[id];
      if (d && c.t != null) items.push({ t: c.t, text: d.text, kind: 'clue' });
    });
    Object.entries(P.threads || {}).forEach(([th, t]) => {
      const d = RULES.threads[th];
      if (d) items.push({ t, text: d.ko + '.', kind: 'thread' });
    });
    if (me.lodging && RULES.lodgings[me.lodging.id]) {
      items.push({ t: me.lodging.since, text: `${RULES.lodgings[me.lodging.id].label}에서 지내기 시작했다.` });
    }
    // 알아낸 사실: 시각이 있으면 그날 기록에 (예전 저장 파일은 true라서 아래 '알아낸 것'으로)
    Object.entries(P.knowledge || {}).forEach(([k, v]) => { if (typeof v === 'number' && KNOW[k]) items.push({ t: v, text: KNOW[k], kind: 'fact' }); });
    if (typeof Knowledge.eventLines === 'function') Knowledge.eventLines(S).forEach((e) => items.push({ t: e.t, text: e.text, kind: e.how === 'witnessed' ? '' : 'heard' }));
    if (me.lastCollapse != null) items.push({ t: me.lastCollapse, text: '정신을 잃고 쓰러졌다.', kind: 'hard' });
    // 단서가 된 사실은 단서 쪽만 남긴다
    const clueFacts = new Set(Object.values(P.clues || {}).map((c) => String(c.from || '')).filter((f) => f.startsWith('fact:')).map((f) => KNOW[f.slice(5)]));
    for (let i = items.length - 1; i >= 0; i--) if (items[i].kind === 'fact' && clueFacts.has(items[i].text)) items.splice(i, 1);
    items.sort((a, b) => a.t - b.t);
    const days = [];
    items.forEach((x) => {
      const d = Time.dayLabel(x.t);
      let g = days[days.length - 1];
      if (!g || g.day !== d) days.push((g = { day: d, items: [] }));
      g.items.push({ when: Time.KO[Time.band(x.t)], text: x.text, kind: x.kind || '' });
    });
    // 단서가 된 사실은 위 날짜 목록에 이미 있으니 다시 적지 않는다
    const asClue = new Set(Object.values(P.clues || {}).map((c) => String(c.from || '')).filter((f) => f.startsWith('fact:')).map((f) => f.slice(5)));
    const facts = Object.keys(P.knowledge || {}).filter((k) => KNOW[k] && P.knowledge[k] === true && !asClue.has(k)).map((k) => KNOW[k]);
    return { days, facts };
  }

  // ---------- 인물 ----------
  // 관계 수치는 보여 주지 않는다 (스토리설계.md: "플레이어에게 숫자를 보이지 않는다").
  // 대신 시스템이 이미 문장으로 바꿔 둔 태도(Narrative.describe)를 쓴다.
  function people(S) {
    const { W, P } = S;
    return Object.entries(P.found.npcs).map(([id, f]) => {
      const n = W.npcs[id];
      if (!n) return null;
      const named = !!f.name;
      return {
        id,
        name: named ? f.name : '이름을 모른다',
        look: n.identity.desc,
        named,
        first: when(f.first),
        last: f.last != null && f.last !== f.first ? when(f.last) : null,
        together: (W.player.companions || []).includes(id),
        attitude: Narrative.describe(S, n),
      };
    }).filter(Boolean).sort((a, b) => (b.together - a.together) || (b.named - a.named));
  }

  // ---------- 소지품 ----------
  const CATEGORY_KO = { tool: '도구', food: '먹을 것', medicine: '약', weapon: '무기', material: '재료', clothing: '옷', misc: '물건' };
  function items(S) {
    const { W, P } = S;
    const inv = W.player.inv || {};
    return {
      money: W.player.money || 0,
      list: Object.entries(inv).filter(([, c]) => c > 0).map(([id, count]) => {
        const d = ITEM_DEFS[id] || {};
        return { id, name: Player.label(id, P), count, kind: CATEGORY_KO[d.category] || '물건', desc: Player.describe ? Player.describe(id, P) : d.desc || null };
      }),
    };
  }

  // ---------- 지도 ----------
  // 가 보았거나 멀리서 본 곳만. 길도 양 끝을 다 아는 것만 그린다.
  function map(S) {
    const { W, P } = S;
    const known = (id) => id === W.player.loc || Knowledge.locState(P, id) !== 'unknown';
    const ids = Object.keys(PLACE_DATA).filter(known);
    return {
      here: W.player.loc,
      places: ids.map((id) => ({
        id, name: Places.name(id), region: Places.regionOf(id),
        regionName: regionLabel(S, Places.regionOf(id)),
        state: id === W.player.loc ? '지금 여기' : Knowledge.KO[Knowledge.locState(P, id)] || '',
      })),
      paths: PATHS.filter(([a, b]) => known(a) && known(b)).map(([a, b]) => [a, b]),
    };
  }

  // ---------- 말 ----------
  function words(S) {
    return {
      words: LangUI.wordLines(S).map((l) => ({ text: l.t.replace(/^·\s*/, ''), dim: /dim/.test(l.cls) })),
      langs: LangUI.languageLines(S).map((l) => l.t),
    };
  }

  // ---------- 저장 ----------
  // 저장 규칙은 시스템(state.js)의 것이다. 여기서는 저장된 내용을 읽어 보여 주기만 한다.
  const SAVED_AGO = (ms) => {
    if (!ms) return null;
    const m = Math.round((Date.now() - ms) / 60000);
    if (m < 1) return '방금 전';
    if (m < 60) return `${m}분 전`;
    if (m < 60 * 24) return `${Math.round(m / 60)}시간 전`;
    return new Date(ms).toLocaleDateString('ko-KR', { month: 'long', day: 'numeric' });
  };
  // 저장 칸들: 자동 + 손 저장 1~3 (Save.list는 세계를 다시 짓지 않아 가볍다)
  function slots() {
    return Save.list().map((x) => x.empty ? { slot: x.slot, empty: true } : {
      slot: x.slot, name: x.name || '이름 없음', when: when(x.t), place: Places.name(x.loc), ago: SAVED_AGO(x.savedAt),
    });
  }
  // 대사의 말하는 사람: 이름을 안 뒤에만 붙인다. 그 전에는 장면 글이 "그녀"·겉모습으로 이미 가리키므로
  // 이름표가 따로 부르면 어긋난다 (리아: 장면은 '그녀', 겉모습은 '젊은 여자')
  function speaker(id) {
    const S = source();
    if (!S || !id) return null;
    const f = S.P.found.npcs[id];
    return f && f.name ? f.name : null;
  }

  return { source, when, now, journal, people, items, map, words, slots, speaker };
})();
