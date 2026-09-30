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

  function label(id) {
    const l = RULES.lodgings[id];
    if (l.work) return '일을 거들고 재워 달라고 한다';
    if (l.charity) return `${l.label}에 몸을 누일 수 있을지 살펴본다`;
    if (!l.owner) return `${l.label}에서 밤을 나기로 한다`;
    return `잠자리를 부탁한다 (${l.label})`;
  }

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
    if (l.charity) {
      settle(S, id);
      return ['안은 비어 있다. 누가 쓰라고 개어 둔 것인지, 담요가 몇 장 있다.', '……오늘 밤은 여기 신세를 지기로 한다.'];
    }
    if (!l.owner) {
      settle(S, id);
      return ['울타리 밑, 바람이 덜 드는 자리를 봐 둔다.', '……오늘 밤은 여기서 버텨야 한다.'];
    }
    const o = W.npcs[l.owner];
    const who = Narrative.who(S, o);
    Memory.add(S, o, { type: 'sheltered', subject: 'player', detail: id });
    Rel.change(S, l.owner, 'player', { familiarity: 5 }, 'lodging', true);
    if (l.work) {
      // 돈 대신 일로 치른다: 먼저 일을 하고, 그러면 방을 내준다
      const lines = ['주머니를 뒤집어 보이고, 가게 안쪽과 나를 번갈아 가리킨다.', `${J(who, '이가')} 나를 한참 보더니, 빗자루를 내민다.`, '', ...RULES.jobs[l.work].lines];
      lines.push(...pass(RULES.jobs[l.work].min, { work: RULES.jobs[l.work].fatigue / RULES.jobs[l.work].min }));
      me.tendency[RULES.jobs[l.work].tendency] = (me.tendency[RULES.jobs[l.work].tendency] || 0) + RULES.jobs[l.work].min;
      Rel.change(S, l.owner, 'player', { trust: 3, familiarity: 3 }, 'chores');
      settle(S, id);
      lines.push('', `일이 끝나자 ${J(who, '이가')} 가게 뒤쪽의 작은 방을 가리킨다.`);
      return lines;
    }
    if (l.price) { me.money -= l.price; o.money += l.price; }
    settle(S, id);
    return l.price
      ? [`${who}에게 동전 ${l.price}닢을 내민다.`, `${J(who, '이가')} 동전을 세어 보고, 가게 뒤쪽의 작은 방을 가리킨다.`]
      : [`${J(who, '이가')} 나를 한참 보더니, 헛간 쪽을 턱으로 가리킨다.`, '마른 풀 냄새가 난다. 지붕이 있다.'];
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
      if (me.money >= l.price) { me.money -= l.price; o.money += l.price; me.lodging.paidDay = today(W); }
      else { Rel.change(S, l.owner, 'player', { trust: -10, resentment: 5 }, 'unpaid'); lines.push('……방값을 치를 돈이 없다. 주인의 눈초리가 차갑다.'); }
    }
    if (l.charity) me.charityNights = (me.charityNights || 0) + 1;
    lines.push(...pass(Time.untilDawn(W.time.t), { sleep: true, quality: q }));
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
      lines.push('', `문 두드리는 소리. ${J(Narrative.who(S, visitor), '이가')} 빵 한 덩이를 들고 서 있다.`);
    }
    return lines;
  }

  return { offers, label, take, canSleep, sleep };
})();

if (typeof module !== 'undefined') module.exports = { Lodging };
