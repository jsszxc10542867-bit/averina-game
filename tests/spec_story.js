// 초반 장면 문장 수정 (스토리설계.md "단계 0~4 장면 문장", 2026-10-01 스토리 총괄)

// ST1 밤의 목소리를 따라간다 [결정 #6]: 쓰러지지 않고, 정신을 잃었다가 새벽 직전 낯선 자리에서 깨어난다
__pending.push((async () => {
  const name = 'ST1 밤의 목소리를 따라감 → 쓰러짐 없이 새벽 직전 낯선 자리에서 깨어나고, "정신을 잃는다"를 알게 된다';
  try {
    const run = async (script) => {
      const S = newGame();
      to(S, 1, 23);
      const from = S.W.player.loc;
      const hp0 = S.W.player.hp, f0 = S.W.player.surv.fatigue;
      const r = await Scenes.call(fakeUi(S, script));
      const W = S.W;
      return { r, from, to: W.player.loc, clock: Time.clock(W.time.t), day: Time.day(W.time.t), hp: W.player.hp, hp0,
        tired: W.player.surv.fatigue > f0, collapses: S.P.collapses, fact: !!S.P.knowledge.voice_lost, old: 'voice_kills' in S.P.knowledge };
    };
    const a = await run(['answer', '목소리 쪽으로 간다']);
    const b = await run(['look', '길을 따라간다']);
    const ok = [a, b].every((x) => x.r === 'shaken' && x.collapses === 0 && x.hp >= 1 && x.day === 2 && x.clock >= 5 * 60 && x.clock < 6 * 60
      && x.to !== x.from && x.tired && x.fact && !x.old);
    check(name, ok, [a, b].map((x) => `${x.r}: ${x.from}→${x.to}, 둘째 날 ${Math.floor(x.clock / 60)}:${String(x.clock % 60).padStart(2, '0')}, 체력 ${x.hp0}→${x.hp}, 쓰러짐 ${x.collapses}`).join(' / '));
  } catch (e) {
    check(name, false, String(e && e.stack || e));
  }
})());

// ST3 목소리를 따라가 낯선 자리에서 깨어나도, 리아에게 가는 길(둘째 날 아침의 피 냄새)은 막히지 않는다 — D5 첫 만남을 놓치지 않는다
(() => {
  const res = ['clearing', 'stream', 'hill', 'deep', 'downstream'].map((start) => {
    const S = newGame();
    to(S, 1, 23);
    Player.teleport(S, start);
    Collapse.lose(S);
    const woke = S.W.player.loc;
    to(S, 2, 7, 10);
    S.W.worldFlags.day2Acts = 3; // 깨어난 뒤 세 번 움직였다 (엔진의 passTime이 센다)
    const next = SceneOrder.candidates(S).map((c) => c.scene);
    return { start, woke, ok: woke !== 'hollow' && woke !== 'edge' && next.includes('teaser') && Npc.at(S.W, 'lia', 'hollow') };
  });
  check('ST3 목소리를 따라간 뒤 → 어디서 깨어나도 둘째 날 아침 피 냄새가 리아에게 이끈다', res.every((x) => x.ok),
    res.map((x) => `${x.start}→${x.woke} ${x.ok ? '✓' : '✗'}`).join(' / '));
})();

// ST2 예전 저장 파일의 "그 목소리를 따라가면, 죽는다"(voice_kills)는 새 사실(voice_lost)로 옮겨진다. 단서도 그대로 열린다
(() => {
  const S = newGame();
  const P = JSON.parse(JSON.stringify(S.P));
  P.knowledge.voice_kills = 1300;
  const s = Save.load({ v: 2, P, W: JSON.parse(JSON.stringify(S.W)) });
  check('ST2 예전 사실 이름 → voice_kills가 voice_lost로 옮겨지고, 단서 forest_voice가 새 이름을 본다', s.P.knowledge.voice_lost === 1300 && !('voice_kills' in s.P.knowledge)
    && RULES.clues.forest_voice.from.fact.includes('voice_lost') && !!KNOW.voice_lost && !KNOW.voice_kills,
    `옮긴 뒤 ${JSON.stringify(s.P.knowledge)}`);
})();
