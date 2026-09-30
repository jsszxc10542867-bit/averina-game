// 일 (품삯) — 스토리_재설계.md 6절 "생활". 일을 거들면 돈, 그 사람의 호감, 직업 경향, 소문이 남는다.
// 일거리는 data/rules.js의 RULES.jobs. 일을 주는 사람이 그 시각에 그곳에 있어야 하고, 나를 그만큼 믿어야 한다.
// 말이 통하지 않아도 일은 손짓으로 통한다.
const Work = (() => {
  const J = (w, t) => w + Text.josa(w, t);

  // 지금 이 자리에서 거들 수 있는 일
  function available(S) {
    const { W } = S;
    const h = Time.hour(W.time.t);
    return Object.entries(RULES.jobs).filter(([, j]) => {
      if (j.lodgingOnly) return false; // 잠자리 값으로만 하는 일 (lodging.js)
      if (j.at !== W.player.loc || h < j.hours[0] || h >= j.hours[1]) return false;
      const giver = W.npcs[j.giver];
      if (!giver || !Npc.present(W, giver)) return false;
      const r = Rel.get(W, j.giver, 'player');
      return r.trust >= j.minTrust && r.hostility < 30 && r.suspicion < 70;
    }).map(([id, job]) => ({ id, job }));
  }

  // 일을 한다. 흐른 시간의 줄은 pass(min, opt)가 만든다 (engine의 passTime)
  function perform(S, id, pass) {
    const { W } = S;
    const job = RULES.jobs[id];
    const giver = W.npcs[job.giver];
    const who = Narrative.who(S, giver);
    const me = W.player;
    const lines = [`${J(who, '이가')} 손짓으로 할 일을 보여 준다.`, '', ...job.lines];
    Player.use(S, job.stat);
    Player.use(S, job.stat);
    lines.push(...pass(job.min, { work: job.fatigue / job.min }));
    if (!giver.alive || me.hp <= 0) return lines;
    // 품삯: 돈이 모자라면 먹을 것으로 준다
    let paid = job.pay;
    if (giver.money >= paid) { giver.money -= paid; me.money += paid; lines.push('', `일이 끝나자 ${J(who, '이가')} 동전 ${paid}닢을 손에 쥐여 준다.`); }
    else { paid = 0; Player.give(me, 'bread'); lines.push('', `${J(who, '이가')} 동전 대신 빵 한 덩이를 내민다.`); }
    me.tendency[job.tendency] = (me.tendency[job.tendency] || 0) + job.min;
    Rel.change(S, job.giver, 'player', { trust: 3, familiarity: 5, respect: 2 }, 'worked');
    // 같은 사람과 하루에 한 번만 기억과 소문이 된다 (매번 부풀지 않게)
    const today = Time.day(W.time.t);
    if (giver.flags.workedDay !== today) {
      giver.flags.workedDay = today;
      Memory.add(S, giver, { type: 'worked_with', subject: 'player', detail: id });
      WorldEvents.record(S, 'player_worked', { loc: me.loc, actors: ['player', giver.id], witnesses: [giver.id],
        data: { subject: 'player', target: giver.id, job: id } });
    }
    // 일이 마을을 조금 바꾼다
    const v = W.economy.markets.village_square;
    if (id === 'field') v.stock.bread = (v.stock.bread || 0) + 1;
    if (id === 'errand') v.salesToday += 2;
    if (id === 'watch') W.regions.village.alert = Math.max(W.regions.village.alert, 40);
    if (id === 'herbs' && giver.inventory.herb > 0) { giver.inventory.herb--; giver.inventory.bandage = (giver.inventory.bandage || 0) + 1; }
    Bus.emit(S, 'PLAYER_WORKED', { job: id, giver: giver.id, paid });
    const thanks = Dialogue.process(S, { speakerId: giver.id, listenerId: 'player', dialogueId: 'thanks' });
    lines.push(thanks.displayText);
    return lines;
  }

  // 가장 많이 해 온 일 (직업 경향. 숫자는 보여 주지 않는다)
  function tendencyLines(S) {
    const t = S.W.player.tendency;
    const top = Object.entries(t).filter(([, m]) => m >= 60).sort((a, b) => b[1] - a[1]);
    return top.map(([k, m]) => ({ t: `· ${RULES.tendencyKo[k] || k} — ${m >= 600 ? '손에 익었다' : m >= 240 ? '조금 익숙하다' : '해 본 적 있다'}`, cls: 'note' }));
  }

  return { available, perform, tendencyLines };
})();

if (typeof module !== 'undefined') module.exports = { Work };
