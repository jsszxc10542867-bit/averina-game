// 거처 — 스토리_재설계.md 6절 "잠자리 문제", 스토리설계.md PART 5 단계 5 [결정 #10].
// 첫 잠자리는 앞의 행동에 따라 갈린다: 리아의 말로 노파가 헛간을 내준다 / 일을 거들고 재워 달라고 한다 /
// 교회의 구호를 받는다 / 울타리 밑에서 노숙한다. 어느 길이 정답인지 게임은 알려 주지 않는다.
// 어디서 자느냐가 회복, 안전, 사람들과의 관계를 바꾼다. 거처 목록은 RULES.lodgings, 잠의 효과는 RULES.sleep.
const Lodging = (() => {
  const J = (w, t) => w + Text.josa(w, t);
  const today = (W) => Time.day(W.time.t - 6 * 60); // 밤은 전날에 속한다 (새벽 6시가 하루의 경계)
  const stayId = (id) => RULES.lodgings[id].stays || id;

  // 지금 이 자리에서 구할 수 있는 잠자리
  function offers(S) {
    const { W } = S;
    const me = W.player;
    const h = Time.hour(W.time.t);
    const night = h >= 17 || h < 5; // 저녁부터 새벽 전까지
    const paidTonight = me.lodging && me.lodging.paidDay === today(W);
    return Object.entries(RULES.lodgings).filter(([id, l]) => {
      if (l.at !== me.loc) return false;
      if (me.lodging && stayId(id) === me.lodging.id && (paidTonight || !l.price)) return false; // 이미 오늘 밤 잘 곳이다
      if (l.charity) {
        const used = me.charityNights || 0;
        return night && me.money <= l.charity.maxMoney && used < l.charity.maxNights;
      }
      if (!l.owner) return night && !me.lodging;
      const o = W.npcs[l.owner];
      if (!o || !Npc.present(W, o)) return false;
      const r = Rel.get(W, l.owner, 'player');
      if (r.trust < l.minTrust || r.hostility >= 30) return false;
      if (l.work) {
        const job = RULES.jobs[l.work];
        return h >= job.hours[0] && h < job.hours[1] && r.suspicion < 70;
      }
      return me.money >= l.price;
    }).map(([id, l]) => ({ id, l }));
  }

  const label = (id) => RULES.lodgings[id].ask || RULES.lodgings[id].label;

  // 처음인가 (거처마다 · 마을의 첫 아침): W.worldFlags.seen에 남긴다
  const once = (W, key) => { if (W.worldFlags.seen[key]) return false; W.worldFlags.seen[key] = true; return true; };
  const say = (S, id, text) => Lang.line(Dialogue.process(S, { speakerId: id, listenerId: 'player', text }), id);

  function settle(S, id) {
    const { W } = S;
    W.player.lodging = { id: stayId(id), since: W.time.t, paidDay: today(W) };
    Bus.emit(S, 'LODGING_CHANGED', { lodging: stayId(id), via: id });
  }

  // 잠자리를 얻는다. pass(min, opt)는 시간을 흘린다 (일로 치를 때)
  function take(S, id, pass) {
    const { W } = S;
    const l = RULES.lodgings[id];
    const me = W.player;
    // 문장: 스토리설계.md 단계 5 장면 문장 D (첫 잠자리 네 갈래)
    if (l.charity) {
      settle(S, id);
      return ['안은 서늘하다. 아무도 없다.', '앞쪽의 돌 앞에 작은 등잔 하나가 타고 있다. 누군가 불을 갈아 두고 갔다.',
        '구석에 개어 둔 담요는 낡았지만 깨끗하다.', '……누구에게 허락을 받아야 하는지 모른다. 물어볼 사람도 없다.', '담요 한 장을 조심스럽게 펼친다.'];
    }
    if (!l.owner) {
      settle(S, id);
      return ['울타리 말뚝에 등을 붙인다. 바람이 덜 드는 자리다.',
        ...(W.worldFlags.seen.v_gate ? ['발톱 자국이 난 말뚝이 바로 옆에 있다.'] : []), '……숲이 등 뒤에 있다.'];
    }
    const o = W.npcs[l.owner];
    const who = Narrative.who(S, o);
    const whoFull = Narrative.who(S, o, true);
    Memory.add(S, o, { type: 'sheltered', subject: 'player', detail: id });
    Rel.change(S, l.owner, 'player', { familiarity: 5 }, 'lodging', true);
    if (l.work) {
      // 돈 대신 일로 치른다: 먼저 일을 하고, 그러면 방을 내준다
      const lines = ['주머니를 뒤집어 보이고, 계단 위와 나를 번갈아 가리킨다.', `${J(whoFull, '이가')} 팔짱을 낀다. 내 얼굴과 빈 주머니를 번갈아 본다.`,
        '……한숨. 그리고 행주를 던지듯 내민다.', '', ...RULES.jobs[l.work].lines];
      lines.push(...pass(RULES.jobs[l.work].min, { work: RULES.jobs[l.work].fatigue / RULES.jobs[l.work].min }));
      me.tendency[RULES.jobs[l.work].tendency] = (me.tendency[RULES.jobs[l.work].tendency] || 0) + RULES.jobs[l.work].min;
      LifeLog.worked(S, l.work, l.owner, RULES.jobs[l.work].min);
      Incidents.notice(S, 'work', { job: l.work, at: me.loc });
      Rel.change(S, l.owner, 'player', { trust: 3, familiarity: 3 }, 'chores');
      settle(S, id);
      lines.push('', `일이 끝나자 ${J(who, '이가')} 국자로 계단 위를 가리킨다.`);
      // 첫날에만: 식은 국 한 그릇 (허기가 조금 준다)
      if (once(W, 'lodge_soup')) {
        me.surv.hunger = Math.max(0, me.surv.hunger - RULES.sleep.firstSoup);
        lines.push('탁자 위에 그릇 하나가 놓여 있다. 식은 국이다. 아무도 내 것이라고 말하지 않았지만, 아무도 치우지 않는다.');
      }
      return lines;
    }
    if (l.price) { me.money -= l.price; o.money += l.price; LifeLog.money(S, -l.price, 'rent', { with: l.owner }); }
    settle(S, id);
    if (l.price) return [`${who}에게 동전 ${l.price}닢을 내민다.`, `${J(who, '이가')} 동전을 세어 보고, 계단 위의 작은 방을 가리킨다.`];
    // 헛간: 노파가 리아 쪽을 한 번 보고, 한 마디로 내준다
    const liaHere = Npc.present(W, W.npcs.lia);
    return [`${J(whoFull, '이가')} 나를 오래 본다.`, ...(liaHere ? ['그리고 리아 쪽을 한 번 본다.'] : []),
      `${J(who, '이가')} 마른 손가락으로 마당 한쪽을 가리킨다. 헛간이다.`, say(S, l.owner, '「[[자:30]].」'),
      `한 마디뿐이다. ${J(who, '은는')} 다시 약초 통으로 몸을 돌린다.`,
      ...(once(W, 'lodge_barn') ? ['', '마른 풀이 천장까지 쌓여 있다. 숨을 쉴 때마다 쓴 냄새가 목에 걸린다.', '지붕이 있다. 벽이 있다. 그것만으로 다리에 힘이 풀린다.'] : [])];
  }

  // 잘 수 있는가: 내 거처에 있고, 저녁 6시 이후 또는 새벽 5시 전
  function canSleep(S) {
    const me = S.W.player;
    if (!me.lodging || RULES.lodgings[me.lodging.id].at !== me.loc) return false;
    const h = Time.hour(S.W.time.t);
    return h >= 18 || h < 5;
  }

  // 잔다. 아침(6시)까지. 흐른 시간의 줄은 pass가 만든다
  function sleep(S, pass) {
    const { W } = S;
    const me = W.player;
    const l = RULES.lodgings[me.lodging.id];
    const q = l.quality;
    const lines = [q === 0 ? '울타리 밑에 몸을 웅크린다. 땅이 차다.' : q === 1 ? '마른 풀과 담요 위에 몸을 누인다.' : '좁지만 벽과 지붕이 있는 방이다. 눕자마자 눈이 감긴다.'];
    // 방값은 하룻밤마다 한 번 (이미 치렀으면 받지 않는다. 못 내면 주인의 신뢰가 깎인다)
    if (l.price && me.lodging.paidDay !== today(W)) {
      const o = W.npcs[l.owner];
      if (me.money >= l.price) { me.money -= l.price; o.money += l.price; me.lodging.paidDay = today(W); LifeLog.money(S, -l.price, 'rent', { with: l.owner }); }
      else { Rel.change(S, l.owner, 'player', { trust: -10, resentment: 5 }, 'unpaid'); lines.push('……방값을 치를 돈이 없다. 주인의 눈초리가 차갑다.'); }
    }
    if (l.charity) me.charityNights = (me.charityNights || 0) + 1;
    // 그 거처에서 처음 자는 밤 (스토리설계.md 단계 5 장면 문장 D)
    const id = me.lodging.id;
    let cover = false;
    if (once(W, 'night_' + id)) {
      if (id === 'barn') {
        lines.push('벽 너머 집 안에서 기침 소리가 난다. 늙은 사람의 기침이다.');
        if (Npc.at(W, 'lia', 'village_herbhouse')) lines.push('……한참 뒤, 낮은 목소리가 무언가를 달랜다. 리아의 목소리 같다.');
      } else if (id === 'chapel') {
        lines.push('한밤중에 문이 삐걱 열린다. 발소리가 등잔 앞에서 멈췄다가, 다시 나간다. 나를 깨우지 않는다.');
      } else if (id === 'rough') {
        lines.push('숲 쪽에서 무언가 우는 소리가 난다. 멀다.');
        if (S.P.knowledge.name_call) lines.push('……이름을 부르는 소리는 아니다. 그것만 확인하고, 눈을 감는다.');
        lines.push('잠은 자꾸 끊긴다. 깰 때마다 하늘을 본다. 아직 어둡다.');
      }
    }
    // 노숙하는 밤 울타리를 지키던 사람이 지나간다. 나를 믿으면 천을 던져 준다 (추위만 조금 덜하다)
    if (id === 'rough' && Npc.at(W, 'gatekeeper', 'village_gate')) {
      const gk = Narrative.who(S, W.npcs.gatekeeper, true);
      if (Rel.get(W, 'gatekeeper', 'player').trust >= RULES.sleep.coverTrust) {
        cover = true;
        lines.push(`${J(gk, '이가')} 지나가다 나를 내려다본다.`, '……발치에 거친 천 한 장을 던져 두고 간다.');
      } else lines.push(`${J(gk, '이가')} 지나가다 나를 내려다본다. 한참 서 있다가…… 그냥 지나간다.`);
    }
    lines.push(...pass(Time.untilDawn(W.time.t), { sleep: true, quality: q, cover }));
    // 마을에서 맞는 첫 아침 (스토리설계.md 단계 5 장면 문장 E)
    const firstMorning = once(W, 'village_morning');
    if (firstMorning) lines.push('', ...(FIRST_MORNING[id] || []));
    // 노숙은 도둑과 추위에 약하다
    const items = Object.keys(me.inv).filter((k) => me.inv[k] > 0);
    if (items.length && Rng.chance(W, RULES.sleep.theftChance[q])) {
      const k = Rng.pick(W, items);
      Player.take(me, k);
      lines.push('', `아침에 보니 ${J(Player.label(k, S.P), '이가')} 없다.`);
    }
    // 방값을 치른 밤이 지났다: 다음 밤은 새로 치러야 한다 / 구호는 하룻밤씩
    if (l.price || l.charity) me.lodging = l.charity ? null : Object.assign(me.lodging, { paidDay: null });
    Bus.emit(S, 'PLAYER_SLEPT', { lodging: me.lodging ? me.lodging.id : 'chapel', quality: q });
    // 나를 믿는 사람은 아침에 찾아온다
    const visitor = Object.values(W.npcs).find((n) => n.alive && Places.regionOf(n.location.loc) === 'village'
      && Rel.get(W, n.id, 'player').trust >= RULES.sleep.visitTrust && Memory.has(n, 'player', 'met'));
    if (visitor) {
      Npc.place(S, visitor, me.loc);
      Player.give(me, 'bread');
      Rel.change(S, visitor.id, 'player', { familiarity: 3 }, 'visited', true);
      lines.push('', firstMorning && visitor.id === 'lia'
        ? '문 두드리는 소리. 리아다. 빵 한 덩이를 내밀고, 내가 받기 전에 벌써 돌아서 있다.'
        : `문 두드리는 소리. ${J(Narrative.who(S, visitor), '이가')} 빵 한 덩이를 들고 서 있다.`);
    }
    // 숲의 새벽이 첫 번째였다: 둘째 날 마을에 닿아 셋째 날 아침을 맞을 때만
    if (firstMorning && Time.day(W.time.t) === 3) lines.push('', '이 세계에서 맞는 두 번째 아침이다.');
    return lines;
  }

  const FIRST_MORNING = {
    barn: ['풀 냄새 속에서 눈을 뜬다. 틈으로 햇빛이 줄무늬처럼 들어온다.', '마당에서 절구 찧는 소리가 난다.'],
    room: ['아래층에서 그릇 부딪히는 소리에 눈을 뜬다.', '창밖 우물가에 벌써 사람들이 있다.'],
    chapel: ['등잔은 꺼져 있다. 담요가 한 장 더 덮여 있다. 어젯밤엔 없던 것이다.'],
    rough: ['이슬에 옷이 젖어 있다. 몸이 굳어 펴지지 않는다.', '울타리 너머로 마을이 깨어나는 소리가 들린다. 나는 아직 그 바깥에 있다.'],
  };

  return { offers, label, take, canSleep, sleep };
})();

if (typeof module !== 'undefined') module.exports = { Lodging };
