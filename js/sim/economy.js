// 경제 (통합 명세 27절). 재고, 사고팔기, 값, 돈, 수요와 공급, 지역 물가.
// 연쇄: 숲이 위험하다는 소문 → 오가는 사람이 줄고 밭일·채집이 줄어든다 → 들어오는 식량이 줄어 값이 오른다
//       → 장사가 안 되는 날이 이어지면 상인이 마을을 떠난다.
const Economy = (() => {
  const round = (n) => Math.round(n * 10) / 10;
  const BASE = (item) => (ITEM_DEFS[item] ? ITEM_DEFS[item].value : 1);

  function market(stock, demand, supply) {
    const price = {};
    Object.keys(stock).forEach((k) => { price[k] = BASE(k); });
    return { stock, price, demand, supply, traffic: 1, salesToday: 0, lowDays: 0, history: [] };
  }

  function create() {
    return {
      markets: {
        // 마을 광장의 가게. 이름 없는 주민들의 수요와 밭에서 나는 공급을 뭉뚱그려 계산한다
        village_square: market(
          { bread: 24, dried_meat: 8, herb: 4, bandage: 4, salt: 2, waterskin: 2 },
          { bread: 6, dried_meat: 2, herb: 1, bandage: 1, salt: 0.5 },
          { bread: 6, dried_meat: 2 }),
        far_town: market(
          { bread: 200, dried_meat: 80, herb: 30, bandage: 40, salt: 60, waterskin: 20 },
          { bread: 40, dried_meat: 15, herb: 5, bandage: 6, salt: 8 },
          { bread: 40, dried_meat: 15, herb: 5, bandage: 6, salt: 10 }),
      },
    };
  }

  const get = (W, loc) => W.economy.markets[loc] || null;

  // 가게를 보는 사람 (마을 가게는 상인이 일하는 동안만 열린다)
  function merchantAt(W, loc) {
    const m = Object.values(W.npcs).find((n) => n.alive && n.identity.occupation === 'merchant' && !n.location.transit
      && n.location.loc === loc && n.currentAction && n.currentAction.type === 'work');
    return m ? m.id : null;
  }
  function open(W, loc) {
    if (!get(W, loc)) return false;
    if (loc === 'far_town') { const h = Time.hour(W.time.t); return h >= 8 && h < 18; }
    return !!merchantAt(W, loc);
  }
  const priceOf = (W, loc, item) => { const m = get(W, loc); return m ? (m.price[item] || BASE(item)) : BASE(item); };

  // 가게 주인의 돈 (먼 도시의 가게는 돈이 넉넉하다고 본다)
  function till(W, loc) { const id = merchantAt(W, loc); return id ? W.npcs[id] : null; }

  function buy(S, n, loc, item, qty = 1) {
    const { W } = S;
    const m = get(W, loc);
    if (!m || !open(W, loc) || (m.stock[item] || 0) < qty) return false;
    const cost = priceOf(W, loc, item) * qty;
    if (n.money < cost) return false;
    n.money -= cost;
    m.stock[item] -= qty;
    m.salesToday += cost;
    const owner = till(W, loc);
    if (owner) owner.money += cost;
    return true;
  }

  // 가게가 물건을 사 준다 (값의 60%)
  function sell(S, n, loc, item, qty = 1) {
    const { W } = S;
    const m = get(W, loc);
    if (!m || !open(W, loc) || (n.inventory[item] || 0) < qty) return false;
    const pay = round(priceOf(W, loc, item) * 0.6 * qty);
    const owner = till(W, loc);
    if (owner && owner.money < pay) return false;
    if (owner) owner.money -= pay;
    n.money += pay;
    n.inventory[item] -= qty;
    if (n.inventory[item] <= 0) delete n.inventory[item];
    m.stock[item] = (m.stock[item] || 0) + qty;
    return true;
  }

  // 팔 것이 있거나 살 것이 있는가
  function hasBusiness(W, n, loc) {
    if (!get(W, loc)) return false;
    const trip = Goals.get(n, 'trade_trip');
    if (trip && trip.target === loc && !n.flags.tripDone) return true;
    const surplus = (n.inventory.herb || 0) > 3 || (n.inventory.dried_meat || 0) > 1 || (n.inventory.bandage || 0) > 3;
    const hungry = !Object.keys(n.inventory).some((k) => ITEM_DEFS[k] && ITEM_DEFS[k].category === 'food') && n.needs.hunger > 40;
    return surplus || (hungry && n.money >= priceOf(W, loc, 'bread'));
  }

  function trade(S, n, loc) {
    const { W } = S;
    const trip = Goals.get(n, 'trade_trip');
    if (trip && trip.target === loc && !n.flags.tripDone) {
      // 행상: 가져온 것을 넘기고 이 마을에서 나는 것을 사 간다
      ['bread', 'bandage', 'salt'].forEach((k) => { while ((n.inventory[k] || 0) > 1 && sell(S, n, loc, k)) { /* 판다 */ } });
      buy(S, n, loc, 'herb', Math.min(2, get(W, loc).stock.herb || 0));
      n.flags.tripDone = true;
      n.flags.lastTrip = W.time.t;
      return;
    }
    if ((n.inventory.herb || 0) > 3) sell(S, n, loc, 'herb', n.inventory.herb - 3);
    if ((n.inventory.dried_meat || 0) > 1) sell(S, n, loc, 'dried_meat', n.inventory.dried_meat - 1);
    if ((n.inventory.bandage || 0) > 3) sell(S, n, loc, 'bandage', n.inventory.bandage - 3);
    const hasFood = Object.keys(n.inventory).some((k) => ITEM_DEFS[k] && ITEM_DEFS[k].category === 'food');
    if (!hasFood && n.needs.hunger > 40 && buy(S, n, loc, 'bread')) n.inventory.bread = (n.inventory.bread || 0) + 1;
  }

  // 주인이 자리를 비운 가게 (훔칠 기회)
  function unattended(W, loc, n) {
    const m = get(W, loc);
    if (!m || loc === 'far_town' || open(W, loc)) return null;
    return (m.stock.bread || 0) > 0 ? m : null;
  }
  function steal(S, n, loc) {
    const { W } = S;
    const m = unattended(W, loc, n);
    if (!m) return false;
    m.stock.bread--;
    n.inventory.bread = (n.inventory.bread || 0) + 1;
    WorldEvents.record(S, 'theft', { loc, actors: [n.id], data: { subject: n.id, item: 'bread' } });
    return true;
  }

  // 하루에 한 번 (새벽 6시)
  function daily(S) {
    const { W } = S;
    const v = get(W, 'village_square');
    const threat = W.regions.village.threat;
    const southTrade = Factions.rel(W, 'lumeris', 'southern_confederation').trade;
    v.traffic = Math.max(0.1, Math.min(1.5, 1 - threat / 100 * 0.8 + (southTrade - 70) / 200));
    const owner = Object.values(W.npcs).find((n) => n.alive && n.identity.occupation === 'merchant' && n.location.home === 'village_homes');
    // 이름 없는 주민들이 사 간다 (오가는 사람이 줄면 덜 팔린다)
    let sales = v.salesToday;
    Object.entries(v.demand).forEach(([k, d]) => {
      const want = d * (0.7 + 0.3 * v.traffic);
      const sold = Math.min(v.stock[k] || 0, Math.round(want));
      v.stock[k] = (v.stock[k] || 0) - sold;
      sales += sold * (v.price[k] || BASE(k));
    });
    if (owner) owner.money += sales - v.salesToday;
    // 밭과 사냥에서 들어오는 것 (숲이 무서우면 덜 나가고, 리아가 없으면 고기가 준다)
    const lia = W.npcs.lia;
    const hunter = lia && lia.alive && Npc.atHome(lia) ? 1 : 0.5;
    v.stock.bread = (v.stock.bread || 0) + Math.round(v.supply.bread * (1 - threat / 120));
    v.stock.dried_meat = (v.stock.dried_meat || 0) + Math.round(v.supply.dried_meat * (1 - threat / 80) * hunter);
    // 모자라면 값이 오르고, 남으면 내린다
    Object.keys(v.demand).forEach((k) => {
      const d = v.demand[k];
      const ratio = 1 + (d * 3 - (v.stock[k] || 0)) / (d * 6);
      v.price[k] = round(BASE(k) * Math.max(0.6, Math.min(2.5, ratio)));
    });
    v.price.salt = round(BASE('salt') * Math.max(0.6, Math.min(2, 1 + (60 - southTrade) / 100)));
    // 장사가 안 되는 날이 이어지면 상인은 떠날 궁리를 한다
    v.lowDays = sales < 12 ? v.lowDays + 1 : 0;
    v.history.push({ day: Time.day(W.time.t), sales: round(sales), traffic: round(v.traffic), threat: Math.round(threat), bread: v.price.bread });
    if (v.history.length > 30) v.history.shift();
    v.salesToday = 0;
    if (owner && v.lowDays >= 3 && owner.money < 120 && !owner.flags.leaving) leaveTown(S, owner);
  }

  // 상인이 마을을 떠난다 (NPC 이주)
  function leaveTown(S, n) {
    n.flags.leaving = true;
    n.location.home = 'far_town';
    n.schedule = JSON.parse(JSON.stringify(SCHEDULES.traveler));
    WorldEvents.record(S, 'merchant_left', { loc: n.location.loc, actors: [n.id], data: { subject: n.id } });
    Npc.startMove(S, n, 'far_town');
  }

  return { create, get, merchantAt, open, priceOf, buy, sell, hasBusiness, trade, unattended, steal, daily, leaveTown };
})();

if (typeof module !== 'undefined') module.exports = { Economy };
