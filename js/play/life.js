// 생활 선택지 모음 — 지금 이 자리에서 할 수 있는 일(품삯), 잠자리, 잠, 가게, 동행과 헤어지기.
// 탐색 화면(engine.js)이 장소의 행동 다음에 붙인다. pass(min, opt)는 시간을 흘리고 그 사이의 줄을 돌려준다.
const Life = (() => {
  const J = (w, t) => w + Text.josa(w, t);

  function options(S, pass) {
    const { W } = S;
    const opts = [];
    Work.available(S).forEach(({ id, job }) => opts.push({ label: job.label, hint: '품삯', life: true, run: () => Work.perform(S, id, pass) }));
    // 잠자리: 어느 길이 나은지 알려 주지 않는다 (값만 적는다)
    Lodging.offers(S).forEach(({ id, l }) => opts.push({
      label: Lodging.label(id), hint: l.price ? `하룻밤 ${l.price}닢` : null, life: true,
      run: () => { const lines = Lodging.take(S, id, pass); return l.work ? lines : [...lines, ...pass(5)]; },
    }));
    if (Lodging.canSleep(S)) opts.push({ label: '잠을 잔다', kw: ['잔다', '잠', '자자', '눕'], life: true, run: () => Lodging.sleep(S, pass) });
    if (Shop.open(S)) opts.push({ label: '가게를 둘러본다', kw: ['가게', '사', '팔', '물건'], life: true, scene: 'shop' });
    Companion.list(W).filter((n) => Npc.present(W, n)).forEach((n) => {
      const who = Narrative.who(S, n);
      opts.push({ label: `${J(who, '과와')} 헤어진다`, life: true, run: () => {
        Companion.leave(S, n.id, 'parted');
        return [`${who}에게 손을 들어 보인다.`, `${J(who, '은는')} 고개를 끄덕이고 제 갈 길로 간다.`, ...pass(5)];
      } });
    });
    return opts;
  }

  return { options };
})();

if (typeof module !== 'undefined') module.exports = { Life };
