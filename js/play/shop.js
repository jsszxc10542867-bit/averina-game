// 가게 — 마을 광장의 가게에서 사고판다. 값은 마을 사정(경제 시스템)에 따라 매일 달라진다.
// 말이 통하지 않아도 물건과 동전은 통한다.
const Shop = (() => {
  const J = (w, t) => w + Text.josa(w, t);
  const SELLS = ['bread', 'dried_meat', 'bandage', 'waterskin']; // 플레이어에게 파는 것
  const BUYS = ['herb', 'dried_meat'];                           // 플레이어에게서 사는 것

  const open = (S) => Economy.open(S.W, S.W.player.loc) && S.W.player.loc !== 'far_town';

  // 살 수 있는 것: { item, price }
  function wares(S) {
    const { W } = S;
    const m = Economy.get(W, W.player.loc);
    return SELLS.filter((k) => (m.stock[k] || 0) > 0).map((k) => ({ item: k, price: Math.ceil(Economy.priceOf(W, W.player.loc, k)) }));
  }
  // 팔 수 있는 것: { item, price }
  function offers(S) {
    const { W } = S;
    return BUYS.filter((k) => W.player.inv[k] > 0).map((k) => ({ item: k, price: Math.max(1, Math.floor(Economy.priceOf(W, W.player.loc, k) * 0.6)) }));
  }

  function buy(S, item) {
    const { W } = S;
    const me = W.player;
    const loc = me.loc;
    const m = Economy.get(W, loc);
    const price = Math.ceil(Economy.priceOf(W, loc, item));
    const owner = W.npcs[Economy.merchantAt(W, loc)];
    const who = Narrative.who(S, owner);
    if (me.money < price) return [`${J(Player.label(item, S.P), '을를')} 가리킨다.`, `${J(who, '이가')} 손가락 ${price}개를 펴 보인다. ……돈이 모자라다.`];
    me.money -= price;
    owner.money += price;
    m.stock[item]--;
    m.salesToday += price;
    Player.give(me, item);
    Rel.change(S, owner.id, 'player', { familiarity: 2 }, 'bought', true);
    return [`${J(Player.label(item, S.P), '을를')} 가리킨다.`, `${J(who, '이가')} 손가락 ${price}개를 펴 보인다. 동전을 건넨다.`];
  }

  function sell(S, item) {
    const { W } = S;
    const me = W.player;
    const loc = me.loc;
    const price = Math.max(1, Math.floor(Economy.priceOf(W, loc, item) * 0.6));
    const owner = W.npcs[Economy.merchantAt(W, loc)];
    const who = Narrative.who(S, owner);
    if (owner.money < price) return [`${J(who, '이가')} 고개를 젓는다. 지금은 살 돈이 없는 모양이다.`];
    owner.money -= price;
    me.money += price;
    Player.take(me, item);
    Economy.get(W, loc).stock[item] = (Economy.get(W, loc).stock[item] || 0) + 1;
    return [`${J(Player.label(item, S.P), '을를')} 내민다.`, `${J(who, '이가')} 이리저리 살펴보더니 동전 ${price}닢을 내준다.`];
  }

  // 가게 앞에서 고른다 (장면처럼 ui를 받는다)
  async function run(ui) {
    const { S } = ui;
    let out = ['가게 앞에 선다. 천막 아래에 물건이 늘어서 있다.'];
    while (open(S)) {
      await ui.page([...out, '', `주머니에는 동전 ${S.W.player.money}닢이 있다.`]);
      const w = wares(S), o = offers(S);
      const opts = [
        ...w.map((x) => ({ act: 'buy', item: x.item, label: `${J(Player.label(x.item, S.P), '을를')} 산다`, hint: `${x.price}닢` })),
        ...o.map((x) => ({ act: 'sell', item: x.item, label: `${J(Player.label(x.item, S.P), '을를')} 판다`, hint: `${x.price}닢` })),
        { act: 'leave', label: '그만둔다', sep: true },
      ];
      const { idx } = await ui.choose(opts);
      const c = opts[idx];
      if (c.act === 'leave') return 'ok';
      out = c.act === 'buy' ? buy(S, c.item) : sell(S, c.item);
    }
    await ui.page(['가게 주인이 천막을 걷고 있다. 오늘 장사는 끝난 모양이다.']);
    await ui.more();
    return 'ok';
  }

  return { open, wares, offers, buy, sell, run };
})();

if (typeof module !== 'undefined') module.exports = { Shop };
