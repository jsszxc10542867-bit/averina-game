// 장면: 선택이 여러 번 오가는 사건들. 화면 도구(ui)를 받아 진행하고 결과를 돌려준다.
// 결과: 'ok' (탐색으로 돌아감) | 'die' | 'end:with' (그녀와 함께 숲을 나섬) | 'leave' (그녀를 두고 떠남)
// ui = { S, P, W, me, page(lines), say(lines), choose(opts) -> { idx, manner }, more(), pass(min, opt) -> lines,
//        speak(str, by), learn(word), knows(word), know(id), use(k), chance(p), pick(arr), hurt(n, cause, by),
//        npc(id), rel(id), relate(id, delta, cause) }
// 장면은 결과만 정한다. 관계·기억·소문은 Social(돕기·위협·공격)과 이벤트 버스를 거쳐 세계에 남는다.

const Scenes = (() => {
  const K = (t) => ({ t, cls: 'know' }); // 지식으로 알아챈 줄
  const J = (w, t) => w + Text.josa(w, t);

  function movePlayer(ui, to) {
    const from = ui.me.loc;
    ui.me.loc = to;
    Bus.emit(ui.S, 'PLAYER_MOVED', { from, to });
  }

  // ---------- 첫 번째 위험: 풀숲의 짐승 ----------
  async function beast(ui) {
    const { S, W, P, me } = ui;
    W.worldFlags.seen.beast = true;
    const B = W.creatures.thornback; // 짐승의 몸(체력, 두려움)은 세계에 남는다
    const F = { looked: 0, noticed: true, climbed: 0 }; // 이번 싸움의 형편
    const atWater = Places.has(me.loc, 'water');
    const lines = ['……', '풀숲이 움직인다.'];
    if (P.knowledge.beast_seen) lines.push(K('……이 움직임을 안다.'));
    if (me.stats.sen >= 5 || P.knowledge.beast_seen) {
      F.noticed = false;
      lines.push('이번에는 내가 먼저 알아챘다. 그것은 아직 나를 보지 못했다.');
    } else {
      lines.push('바람이 아니다. 무언가가 낮게, 풀을 가르며 다가온다.', '풀숲 사이로 눈이 번뜩인다.');
    }
    await ui.page(lines);
    WorldEvents.record(S, 'beast_encounter', { loc: me.loc, actors: [B.id, 'player'], data: { subject: B.id, target: 'player' } });

    while (true) {
      const weapon = Combat.weaponOf(me);
      const wname = weapon ? ITEM_DEFS[weapon].name : null;
      const opts = [
        { id: 'look', label: '관찰한다' },
        { id: 'hit', label: weapon ? `${J(wname, '으로')} 공격한다` : '맨손으로 덤빈다' },
      ];
      if (me.inv.stone) opts.push({ id: 'throw', label: '돌을 던진다' });
      if (atWater) opts.push({ id: 'water', label: '물속으로 들어간다', hint: P.knowledge.beast_water ? '안다' : null });
      if (Places.has(me.loc, 'rocks')) opts.push({ id: 'climb', label: '바위 위로 올라간다' });
      opts.push({ id: 'hide', label: '숨는다' });
      opts.push({ id: F.noticed ? 'flee' : 'sneak', label: F.noticed ? '도망친다' : '조용히 물러난다' });
      const { idx } = await ui.choose(opts);
      const a = opts[idx].id;
      const out = [];
      let done = false, counter = F.noticed, hurtIt = false;
      const str = me.stats.str - 3;
      // 성공 가능성은 몸 상태, 어둠, 날씨, 지형, 그것의 두려움이 정한다 (play/combat.js)
      const can = (act) => ui.chance(Combat.chance(S, act, B, { noticed: F.noticed }));

      if (a === 'look') {
        F.looked++;
        if (F.looked === 1) {
          ui.use('sen');
          out.push('숨을 죽이고 본다.', '', { t: '[???]', cls: 'sys' }, '작은 짐승처럼 보인다.', '하지만…… 뭔가 이상하다.');
          if (!F.noticed) counter = false;
        } else if (F.looked === 2) {
          ui.use('sen');
          ui.know('beast_seen');
          out.push('개만 한 몸집. 털 대신, 가시 같은 것이 등에 빽빽하게 돋아 있다.', '눈이…… 셋이다.', '가운데 눈만 깜빡이지 않는다.');
          if (!F.noticed && ui.chance(0.5)) { F.noticed = true; out.push('', '가운데 눈이 나를 향한다.'); }
          counter = false;
        } else {
          ui.use('int');
          ui.know('beast_water');
          out.push('그것은 나를 노리면서도, 젖은 자갈이나 물웅덩이는 한 번도 밟지 않는다.', '돌아서 온다. 일부러.', '……물을 싫어하는 걸까.');
        }
      } else if (a === 'hit') {
        ui.use('str');
        const dmg = (weapon ? 1 : ui.chance(0.5) ? 1 : 0) + (str >= 2 ? 1 : 0) + (F.noticed ? 0 : 1);
        if (!F.noticed || can('hit')) {
          B.hp -= dmg;
          out.push(weapon ? `${J(wname, '을를')} 힘껏 내리친다.` : '주먹을 휘두른다.',
            dmg > 0 ? '둔한 감촉. 그것이 날카롭게 운다.' : '가시에 손이 찢긴다. 그것은 꿈쩍도 하지 않는다.');
          if (!weapon && dmg === 0) ui.hurt(1, '풀숲의 짐승에게 당했다', B.id);
          if (weapon && Player.wear(me, weapon)) out.push(`……${J(wname, '이가')} 뚝 부러진다.`);
          if (dmg > 0) { hurtIt = true; Combat.scare(B, 25); }
        } else out.push('헛손질이다. 그것이 옆으로 튄다.');
        F.noticed = true;
      } else if (a === 'throw') {
        ui.use('agi');
        Player.take(me, 'stone');
        if (can('throw')) {
          B.hp -= 1;
          hurtIt = true;
          Combat.scare(B, 20);
          out.push('돌이 그것의 옆구리에 맞는다.', '그것이 움찔 물러선다.');
          if (ui.chance(0.5)) counter = false;
        } else out.push('돌이 빗나가 풀숲에 떨어진다.');
        F.noticed = true;
      } else if (a === 'water') {
        ui.know('beast_water');
        me.surv.wet = 100;
        out.push('개울로 뛰어든다. 차가운 물이 무릎까지 차오른다.', '', '그것이 물가에서 멈춘다.',
          '낮게 으르렁거리며 물가를 따라 몇 번이고 오간다.', '하지만 발을 들이지 않는다.', '', '……이윽고 그것은 풀숲으로 사라진다.');
        done = true; counter = false;
      } else if (a === 'climb') {
        ui.use('agi');
        if (can('climb')) {
          F.climbed++;
          out.push('이끼 낀 바위를 기어오른다. 손톱이 들린다.', '그것이 바위 아래를 맴돈다. 뛰어오르려다, 미끄러진다.');
          if (F.climbed >= 2 || ui.chance(0.5)) { out.push('', '한참을 맴돌던 그것이 흥미를 잃은 듯 돌아선다.'); done = true; }
          counter = false;
        } else out.push('이끼에 손이 미끄러진다. 바위에서 떨어진다.');
      } else if (a === 'hide') {
        ui.use('sen');
        if (can('hide')) {
          out.push('고목 뒤에 몸을 붙이고 숨을 참는다.', '킁킁거리는 소리가 바로 옆을 지나간다.', '……멀어진다.');
          done = true; counter = false;
        } else {
          out.push('덤불 뒤로 몸을 숨긴다.', '킁킁거리는 소리가 멈춘다.', '그리고 덤불이 갈라진다.');
          F.noticed = true; counter = true;
        }
      } else if (a === 'flee' || a === 'sneak') {
        ui.use('agi');
        if (can(a)) {
          const exit = LOCS[me.loc].exits[0];
          out.push(a === 'sneak' ? '발끝으로 한 걸음씩 물러난다. 그것은 끝내 돌아보지 않는다.' : '돌아서서 달린다. 가지가 얼굴을 할퀸다. 뒤를 돌아보지 않는다.');
          if (a === 'flee') { movePlayer(ui, exit.to); out.push('', `정신을 차려 보니 ${LOCS[exit.to].name}이다. 따라오는 소리는 없다.`); }
          done = true; counter = false;
        } else {
          out.push('달리려는 순간 뿌리에 발이 걸린다.');
          F.noticed = true; counter = true;
        }
      }

      if (B.hp <= 0 && !done) {
        ui.know('beast_seen');
        out.push('', '그것이 비틀거린다.', '찢어지는 소리를 내지르며 풀숲 속으로 달아난다.', '',
          '풀 위에 검은 피가 점점이 떨어져 있다.', '……피에서, 희미하게 빛이 난다.');
        Places.addTrace(W, me.loc, 'blood', { quiet: true });
        done = true; counter = false;
      } else if (B.fear >= 80 && !done) {
        // 겁을 먹으면 싸움을 그만둔다
        out.push('', '그것이 멈칫한다.', '가시를 곤두세운 채 뒷걸음질 치더니, 풀숲 속으로 사라진다.');
        done = true; counter = false;
      }
      if (counter && !done && can('counter')) {
        if (can('dodge')) out.push('', '그것이 뛰어든다. 몸을 비틀어 겨우 피한다.');
        else {
          ui.hurt(2, '풀숲의 짐승에게 당했다', B.id);
          Player.injure(S, 'bite', 30);
          out.push('', ui.pick(['그것이 뛰어든다. 종아리에 이빨이 박힌다.', '가시가 팔을 긁고 지나간다. 뜨거운 것이 흘러내린다.', '어깨를 물린다. 비명이 새어 나온다.']));
        }
      }
      out.push(...ui.pass(5, { fight: true }));
      if (me.hp <= 0) {
        await ui.page([...out, '', '다리에 힘이 빠진다.', '풀 위로 쓰러진다. 흙 냄새가 난다.', '가시 돋친 그림자가, 천천히 다가온다.']);
        await ui.more();
        return 'die';
      }
      const f = Player.hpFeeling(me);
      if (f && !done) out.push('', f);
      await ui.page(out);
      if (done) {
        // 다치거나 겁을 먹은 짐승은 이 낯선 것을 피해 다닌다. 제 영역 깊은 곳으로 물러난다.
        if (hurtIt || B.hp <= 0 || B.fear >= 80 || F.climbed) { B.shy = true; B.loc = 'deep'; }
        B.hp = Math.max(1, B.hp);
        await ui.more();
        return 'ok';
      }
    }
  }

  // ---------- 첫 번째 이상현상: 떠 있는 빛 ----------
  async function light(ui) {
    const { S, W, P } = ui;
    W.worldFlags.seen.light = true;
    const lines = ['나무 사이에 무언가 떠 있다.', '빛이다. 작고, 희미하게 푸르다.',
      '반딧불처럼 보인다. 하지만 반딧불은 저렇게 움직이지 않는다.',
      '그것은 흔들리지도 않고 한 자리에 가만히 떠서……', '……나를 바라보는 것 같다.'];
    if (P.knowledge.light_watches) lines.push(K('……또 만났다.'));
    await ui.page(lines);
    let watched = false, near = 0;
    while (true) {
      const opts = [{ id: 'near', label: '다가간다' }, { id: 'watch', label: '가만히 지켜본다' }];
      if (watched || P.knowledge.light_watches) opts.push({ id: 'touch', label: '손을 뻗는다' });
      opts.push({ id: 'away', label: '눈을 돌린다' });
      const { idx } = await ui.choose(opts);
      const a = opts[idx].id;
      let out, done = true;
      if (a === 'near') {
        near++;
        if (near === 1) { out = ['한 걸음 다가선다.', '빛이 스르르 물러난다. 꼭 내가 다가선 만큼.']; done = false; }
        else out = ['다시 다가선다.', '빛은 꺼지듯 사라진다.', '눈을 깜빡이는 사이, 그것은 어디에도 없다.'];
      } else if (a === 'watch') {
        ui.use('sen');
        ui.know('light_watches');
        watched = true; done = false;
        out = ['숨을 고르고, 가만히 지켜본다.', '빛이 천천히 맥동한다. 숨을 쉬는 것처럼.',
          '내가 숨을 들이쉬면 밝아지고, 내쉬면 어두워진다.', '……나를 따라 하고 있다.'];
      } else if (a === 'touch') {
        ui.use('wil');
        ui.know('light_touched');
        Lang.sense(S, 'spirit', 5);
        Magic.observe(S, 'light', 2);
        out = ['손을 천천히 뻗는다.', '빛이 머뭇거리다가, 손끝에 내려앉는다.', '……따뜻하다.',
          '귓가에서, 소리가 아닌 무언가가 스친다.', '「……○△…… ○○……」',
          '무슨 뜻인지는 모른다. 싫은 느낌은 아니었다.', '', '빛은 사라졌다. 손끝에 온기가 남아 있다.'];
      } else {
        out = ['눈을 돌린다.', '다시 봤을 때, 빛은 없다.'];
      }
      out.push(...ui.pass(5));
      await ui.page(out);
      if (done) { await ui.more(); return 'ok'; }
    }
  }

  // ---------- 첫날 밤, 이름을 부르는 목소리 ----------
  async function call(ui) {
    const { P, me } = ui;
    const lines = ['……어디선가 목소리가 들린다.', '「……{이름}……」', '바람 소리였을까.', '',
      '아니다. 다시 들린다. 이번엔 조금 더 가깝다.', '「……{이름}.」', '그 소리는 분명, 내 이름의 모양을 하고 있다.'];
    if (P.knowledge.voice_kills) lines.push('', K('……이 목소리를 안다.'), K('따라가면 어떻게 되는지도.'));
    await ui.page(lines);
    ui.know('name_call');
    const opts = [
      { id: 'answer', label: '「……누구야?」 대답한다' },
      { id: 'look', label: '소리가 나는 쪽을 본다' },
      { id: 'ears', label: '귀를 막고 웅크린다' },
    ];
    if (P.knowledge.voice_kills) opts.push({ id: 'silent', label: '숨을 죽인다. 절대 대답하지 않는다', hint: '안다' });
    const { idx } = await ui.choose(opts);
    const a = opts[idx].id;
    const deathBy = async (pre) => {
      ui.know('voice_kills');
      me.cause = '밤의 목소리를 따라갔다';
      await ui.page([...pre, '', '몇 걸음. 몇 걸음 더.', '목소리가 멎는다.', '', '뒤에서 누군가 내 어깨에 손을 얹는다.',
        '차갑다.', '돌아본다.', '', '거기에는……']);
      await ui.more();
      return 'die';
    };
    if (a === 'answer') {
      await ui.page(['「……누구야?」', '', '목소리가 멎는다.', '그리고, 아주 가까이에서.', '「이쪽이야, {이름}.」', '', '……내 목소리다.']);
      const r = await ui.choose([{ label: '목소리 쪽으로 간다' }, { label: '뒤로 물러선다' }]);
      if (r.idx === 0) return deathBy(['나무 사이로 발을 옮긴다.', '낮에 없던 길이 나 있다. 희미하게 빛나는 길이다.']);
      ui.use('wil');
      await ui.page(['뒷걸음질 친다. 발밑에서 가지가 부러진다.', '목소리가 뚝 끊긴다.', '',
        '그 뒤로 한참 동안, 아무 소리도 없다.', '무언가가 어둠 속에서 나를 보고 있다는 느낌만 남는다.',
        ...ui.pass(30)]);
    } else if (a === 'look') {
      ui.know('night_path');
      await ui.page(['어둠 속, 나무 사이에 길이 하나 나 있다.', '낮에는 분명 없던 길이다.',
        '길 끝에서 희미한 빛이 흔들린다.', '목소리는 그 끝에서 들린다.', '「{이름}. 이리 와.」']);
      const r = await ui.choose([{ label: '길을 따라간다' }, { label: '눈을 질끈 감는다' }]);
      if (r.idx === 0) return deathBy(['홀린 듯 발을 옮긴다.', '길은 발밑에서 부드럽게 빛난다.']);
      ui.use('wil');
      await ui.page(['눈을 감는다. 숫자를 센다. 하나, 둘, 셋……', '백을 넘겼을 때 눈을 뜬다.', '길은 없다. 원래 그랬던 것처럼.', ...ui.pass(30)]);
    } else {
      ui.use('wil');
      if (a === 'silent') ui.use('wil');
      await ui.page(a === 'silent'
        ? ['입을 틀어막는다. 숨소리조차 내지 않는다.', '목소리는 몇 번 더 내 이름을 부르다가……', '……포기한 듯 멀어진다.', ...ui.pass(30)]
        : ['귀를 막는다.', '목소리는 손가락 사이로 스며든다.', '「{이름}…… {이름}……」', '이를 악문다. 대답하지 않는다.', '',
          '……얼마나 지났을까.', '목소리는 사라졌다.', ...ui.pass(40)]);
    }
    await ui.more();
    return 'ok';
  }

  // ---------- 상태창 해금 (첫 밤을 넘긴 새벽) ----------
  async function status(ui) {
    const { P, me } = ui;
    Player.unlockStatus(me);
    const again = P.knowledge.status_seen;
    P.knowledge.status_seen = true;
    await ui.page(again
      ? ['몸을 일으킨다.', '……또 이 감각이다.', '내 몸의 상태가, 숫자로 느껴진다.', '']
      : ['몸을 일으킨다. 밤새 굳은 팔다리가 삐걱거린다.', '손을 쥐었다, 편다.', '', '……이상하다.',
        '분명 처음 보는 몸인데……', '내 몸의 상태가, 숫자로 느껴진다.', '']);
    await ui.say(Player.statusLines(me, P.name));
    await ui.say(['', '대부분은 아직 흐릿하다.', '하지만 어딘가에 힘을 더 실을 수 있을 것 같다.'], { pace: 700 });
    const { idx } = await ui.choose([{ label: '지금 정한다' }, { label: '나중에 정한다', hint: '언제든 몸 상태를 확인할 수 있다' }]);
    if (idx === 0) await allocate(ui);
    return 'ok';
  }

  // 능력치 배분. 포인트는 회차마다 다시 받는다.
  async function allocate(ui) {
    const { P, me } = ui;
    while (me.status.points > 0) {
      await ui.page(['현재 능력치를 확인한다.', '', ...Player.statusLines(me, P.name)], { pace: 60 });
      const opts = STAT_KEYS.map((k) => ({
        k, label: `${STAT_KO[k]}에 힘을 싣는다`, disabled: me.stats[k] >= STAT_MAX,
        hint: me.status.known[k] ? String(me.stats[k]) : '?',
      }));
      opts.push({ k: null, label: '여기까지만 한다', sep: true });
      const { idx } = await ui.choose(opts);
      const k = opts[idx].k;
      if (!k) break;
      me.stats[k]++;
      me.status.points--;
      if (k === 'vit') Player.heal(me, 1);
    }
    await ui.page(me.status.points > 0
      ? ['남은 힘은 아껴 둔다.', '']
      : ['몸 안에서 무언가가 자리를 잡는다.', '']);
    await ui.say(Player.statusLines(me, P.name), { pace: 60 });
    await ui.more();
  }

  // 만난 사람을 떠올린다. 관계는 숫자가 아니라 인상으로.
  function peopleLines(ui) {
    const { S, W, P } = ui;
    return Object.keys(P.found.npcs).filter((id) => W.npcs[id]).map((id) => {
      const n = W.npcs[id];
      const name = P.found.npcs[id].name || n.identity.desc;
      const sawDeath = !n.alive && W.events.log.some((e) => e.type === 'death_witnessed' && e.data.target === id && e.witnesses.includes('player'));
      if (sawDeath) return { t: `· ${name} — ……죽었다.`, cls: 'note' };
      const r = Rel.peek(W, id, 'player');
      const word = !r ? '잘 모르겠다' : r.hostility >= 50 ? '나를 미워한다' : r.fear >= 50 ? '나를 두려워한다'
        : r.trust >= 40 ? '나를 조금 믿는 것 같다' : r.gratitude >= 20 ? '고마워하는 것 같다' : r.suspicion >= 60 ? '나를 경계한다' : '잘 모르겠다';
      return { t: `· ${name} — ${word}`, cls: 'note' };
    });
  }

  // 몸 상태를 확인한다 (상태창이 열린 뒤 언제든). 능력치, 언어, 아는 곳, 만난 사람 (통합 명세 37절)
  async function checkBody(ui) {
    const { S, P, me } = ui;
    const f = Player.hpFeeling(me);
    const lines = ['눈을 감고 몸에 집중한다.', '', ...Player.statusLines(me, P.name), '', f || '몸은 아직 괜찮다.'];
    const langs = LangUI.languageLines(S);
    if (langs.length) lines.push('', ...langs);
    const places = Explore.mapLines(S);
    if (places.length) lines.push('', '아는 곳', ...places);
    const people = peopleLines(ui);
    if (people.length) lines.push('', '만난 사람', ...people);
    await ui.page(lines);
    if (me.status.points > 0) {
      const { idx } = await ui.choose([{ label: '남은 힘을 싣는다' }, { label: '그만둔다' }]);
      if (idx === 0) await allocate(ui);
    } else await ui.more();
  }

  // ---------- 첫 번째 인간: 다친 여자 ----------
  function girlLook(ui, G) {
    const r = Rel.get(ui.W, 'lia', 'player');
    const l = [];
    if (G.physical.bleed === 0) l.push('팔에 짓이긴 풀이 덮여 있다. 피는 멎었다.');
    else if (G.physical.health >= 30) l.push('그녀는 나무에 기대어 앉아 있다. 팔을 감싼 손가락 사이로 피가 배어 나온다.');
    else l.push('그녀의 얼굴이 창백하다. 숨이 얕고 빠르다. 팔에서 피가 계속 흐른다.');
    if (G.flags.close) l.push('그녀는 이제 나보다 숲 쪽을 더 살핀다.');
    else if (G.mental.fear >= 50 || r.suspicion >= 60) l.push('손은 여전히 단검 자루 위에 있다.');
    else l.push('단검은 무릎 옆에 내려놓여 있다.');
    return l;
  }

  async function magicScene(ui) {
    const { W, P } = ui;
    const G = W.npcs.lia;
    G.flags.magicSeen = true;
    ui.know('magic_seen');
    P.memory.worldKnowledge++;
    await ui.page(['그녀가 눈을 감는다. 다친 팔 위에 다른 손을 얹는다.', '입술이 무언가를 낮게 중얼거린다.', '',
      '……손끝이 빛난다.', '희미한, 물빛 같은 빛.', '빛이 닿은 자리에서, 찢어진 살이 천천히 오므라든다.', '',
      '숨을 쉬는 것도 잊는다.', '「……방금, 뭐 한 거예요?」', '', '그녀가 눈을 뜬다.', ui.speak('「[[뭐:20]]가?」'),
      '내 얼굴을 한참 들여다보더니, 무언가 알겠다는 듯 눈을 가늘게 뜬다.', ui.speak('「[[마법:45]]…… [[처음:30]] [[봐:30]]?」'), '',
      '뜻은 모른다.', '하지만 그 눈빛은, 이상한 것을 보는 눈빛이다.', '이 세계에서 이상한 건, 나다.']);
    await ui.more();
  }

  async function invite(ui) {
    const { S, W, P } = ui;
    const G = W.npcs.lia;
    G.flags.invited = true;
    const lines = ['그녀가 나무를 짚고 일어선다. 휘청이지만 쓰러지지 않는다.', '단검을 칼집에 꽂고, 숲 저편을 가리킨다.'];
    if (P.knowledge.smoke) lines.push('……비탈 위에서 봤던, 연기가 오르던 쪽이다.');
    lines.push(ui.speak('「[[마을:20]].」'), '그녀가 걷는 시늉을 하고, 나를 가리키고, 다시 저편을 가리킨다.', ui.speak('「[[같이:30]]…… [[가:30]].」'));
    if (ui.learn('마을')) lines.push('', K('……"마을". 사람이 모여 사는 곳을 말하는 것 같다.'));
    ui.know('village');
    await ui.page(lines);
    const { idx } = await ui.choose([{ label: '그녀를 따라간다' }, { label: '고개를 젓는다' }]);
    if (idx === 0) return 'end:with';
    // 그녀는 혼자 마을로 간다. 기다려 주지 않는다.
    G.physical.shock = Math.min(G.physical.shock, 15);
    Goals.add(G, { id: 'return_home', type: 'personal', priority: 90 }, W.time.t);
    Npc.startMove(S, G, G.location.home);
    await ui.page(['고개를 젓는다.', '그녀는 잠시 나를 보더니, 어깨를 으쓱한다.', '그리고 걸어간다.', '돌아보지 않는다.']);
    W.worldFlags.feed.length = 0;
    await ui.more();
    return 'ok';
  }

  // 그녀에게서 들은 말 가운데 따라 해 볼 만한 것 (뜻을 어렴풋이라도 짐작하는 말)
  function sayable(ui) {
    const w = LangKnowledge.heardWords(ui.S, Lang.AVER).find((x) => x.confidence >= LangKnowledge.GUESS);
    return w ? { id: w.id, sound: LangRegistry.sound(w.id, w.id) } : null;
  }

  async function girl(ui) {
    const { S, W, P, me } = ui;
    const G = W.npcs.lia;
    ui.talker = 'lia';
    const R = () => Rel.get(W, 'lia', 'player');
    if (!G.flags.met) {
      G.flags.met = true;
      G.flags.heardStop = (G.flags.heardStop || 0) + 1;
      Social.meet(S, 'lia');
      ui.know('girl_hollow');
      const l = ['나무뿌리가 엉킨 움푹한 곳.', '거기, 사람이 있다.', '',
        '젊은 여자다. 나무에 등을 기대고 앉아 있다.', '옷이 피로 젖어 있다. 한쪽 팔을 다른 손으로 꽉 부여잡고 있다.', '',
        '마른 가지가 발밑에서 부러진다.', '그녀의 고개가 번쩍 들린다.', '팔을 쥐고 있던 손이, 허리춤의 단검으로 향한다.', '',
        ui.speak('「[[거기:15]]…… [[멈춰:10]].」'), '낮고 갈라진 목소리다.'];
      if (ui.knows('멈춰')) l.push(K('……"멈춰". 이 말을 안다.'));
      else l.push('무슨 말인지 모른다.', '……하지만 그 눈빛이 무엇을 말하는지는 안다.');
      if (P.deaths > 0 && P.knowledge.girl_name) l.push('', K('……그녀다.'), K('그녀는 나를 모른다.'));
      await ui.page(l);
    } else {
      await ui.page(['그녀는 아직 그 자리에 있다.', ...girlLook(ui, G)]);
    }

    let unread = false; // 방금 보여 준 결과를 아직 넘기지 않았다
    while (true) {
      const pi = W.worldFlags.pending.indexOf('magic:lia');
      const inviteReady = !G.flags.invited && G.flags.magicSeen && R().trust >= 40 && G.physical.health >= 15;
      // 다음 장면이 화면을 지우기 전에, 방금 일어난 일을 읽을 틈을 준다
      if (unread && (!G.alive || !Npc.present(W, G) || pi >= 0 || inviteReady)) await ui.more();
      unread = false;
      if (!G.alive) {
        await ui.page(['그녀가 더는 움직이지 않는다.', '몇 번을 불러도, 대답이 없다.']);
        await ui.more();
        return 'ok';
      }
      if (!Npc.present(W, G)) return 'ok';
      if (pi >= 0) { W.worldFlags.pending.splice(pi, 1); await magicScene(ui); }
      if (!G.flags.invited && G.flags.magicSeen && R().trust >= 40 && G.physical.health >= 15) {
        const r = await invite(ui);
        if (r !== 'ok') return r;
        continue;
      }

      Save.write(S);
      const F = G.flags;
      const knowsName = P.knowledge.girl_name && !F.named && !F.calledName;
      const weapon = Combat.weaponOf(me);
      const wname = weapon ? ITEM_DEFS[weapon].name : null;
      const word = sayable(ui);
      const opts = [];
      if (ui.knows('멈춰') && !F.stopped && !F.close && !F.named && R().trust < 25) opts.push({ id: 'stop', label: '멈춰 선다. 두 손을 펴 보인다', hint: '말을 안다' });
      if (!F.close) opts.push({ id: 'near', label: '다가간다' });
      if (!F.gotWater) opts.push({ id: 'water', label: '개울물을 떠다 건넨다' });
      opts.push({ id: 'wound', label: '상처를 살펴본다' });
      opts.push({ id: 'talk', label: '말을 걸어 본다' });
      if (word) opts.push({ id: 'say', label: '들은 말을 되풀이해 본다' });
      if (F.talked >= 2 && !F.named) opts.push({ id: 'name', label: '나를 가리키며 이름을 말한다' });
      if (knowsName) opts.push({ id: 'callname', label: '「……리아?」 이름을 불러 본다', hint: '안다' });
      if (me.inv.herb && !F.gotHerb) {
        opts.push(P.knowledge.herb_heals
          ? { id: 'herb', label: '쓴 풀을 짓이겨 상처에 대어 준다', hint: '안다' }
          : { id: 'herb', label: '쓴 냄새가 나는 풀을 건넨다' });
      }
      if (me.inv.berry && !F.sawBerry) opts.push({ id: 'berry', label: '붉은 열매를 건넨다' });
      opts.push({ id: 'wait', label: '거리를 두고 기다린다' });
      opts.push({ id: 'threat', label: me.inv.stone ? '돌을 쥐고 위협한다' : '주먹을 쥐고 위협한다' });
      opts.push({ id: 'attack', label: weapon ? `${J(wname, '을를')} 치켜들고 달려든다` : '그녀에게 달려든다' });
      opts.push({ id: 'leave', label: '그냥 지나간다', sep: true });
      const { idx, manner } = await ui.choose(opts);
      const a = opts[idx].id;
      let out = [], min = 5;

      if (a === 'stop') {
        F.stopped = true;
        ui.relate('lia', { trust: 15, suspicion: -15, respect: 10 }, 'stopped');
        out = ['그 말을 안다.', '발을 멈춘다. 천천히 두 손을 펴 보인다.', '',
          '그녀의 눈이 조금 커진다.', ui.speak('「……[[알아듣는:40]] [[거야:40]]?」'), '단검을 쥔 손에서, 힘이 조금 빠진다.'];
      } else if (a === 'near') {
        if (R().trust >= 25 || F.named) {
          F.close = true;
          ui.relate('lia', { trust: 5, familiarity: 5 }, 'close');
          out = ['천천히 다가간다.', '그녀는 나를 한 번 올려다보고, 단검에서 손을 뗀다.'];
        } else {
          F.heardStop = (F.heardStop || 0) + 1;
          F.approach = (F.approach || 0) + 1;
          // 조심스럽게 다가가면 덜 놀란다 (자유 입력의 "조심스럽게", 통합 명세 34절)
          ui.relate('lia', manner === 'careful' ? { fear: 5, suspicion: 5 } : { fear: 10, suspicion: 10 }, 'approached');
          out = [manner === 'careful' ? '몸을 낮추고, 아주 천천히 한 걸음 다가선다.' : '한 걸음 다가선다.',
            '단검이 칼집에서 반쯤 빠져나온다.', ui.speak('「[[멈춰:10]]! [[멈춰:10]]!」')];
          if (F.heardStop >= 2 && ui.learn('멈춰')) {
            out.push('', K('……아까부터 같은 말을 반복하고 있다.'), K('아마, "멈춰"라는 뜻인 것 같다.'));
          }
          if (F.approach >= 3) {
            ui.hurt(2, '그녀의 단검에 베였다', 'lia');
            Player.injure(S, 'cut', 20);
            ui.relate('lia', { hostility: 10 }, 'cornered');
            out.push('', '한 걸음 더 내딛는 순간, 칼끝이 팔을 스친다.', '뜨겁다. 피가 흐른다.', '그녀는 숨을 몰아쉬며 나를 노려본다.');
          }
        }
      } else if (a === 'water') {
        min = 20;
        F.gotWater = true;
        me.surv.thirst = 0; // 개울에 간 김에 나도 마신다
        Social.help(S, 'player', 'lia', 'water', { trust: 10, suspicion: -5 }); // 그녀의 갈증과 충격은 도움 이벤트가 덜어 준다
        out = ['개울까지 가서, 넓은 잎을 접어 물을 담아 온다.', '돌아오는 사이 반은 흘렀다.', '',
          '그녀 앞 땅바닥에 잎을 내려놓고, 뒤로 물러선다.', '그녀는 한참 나를 노려보다가…… 잎을 집어 든다.', '단숨에 마신다.', '',
          ui.speak('「……[[물:10]].」'), '그녀가 빈 잎을 들어 보이며 같은 소리를 한 번 더 낸다.', '그리고 개울 쪽을 가리킨다.'];
        if (ui.learn('물')) out.push('', K('……물.'), K('아마 물을 뜻하는 말이다.'));
      } else if (a === 'wound') {
        ui.use('int');
        ui.know('girl_wound');
        out = F.close
          ? ['곁에 앉아 상처를 본다. 그녀가 팔을 조금 내밀어 준다.', '팔 위쪽이 깊게 찢겨 있다. 나란히 난 세 줄.',
            '살이 벌어져 있다. 이대로는 피가 멎지 않을 것이다.']
          : ['거리를 둔 채 눈으로만 살핀다.', '팔 위쪽이 깊게 찢겨 있다. 칼에 베인 상처가 아니다.', '나란히 난 세 줄.',
            '……세 갈래.'];
        if (P.knowledge.fresh_prints) out.push(K('개울가 진흙의, 앞이 갈라진 발자국이 떠오른다.'));
        if (!F.close) ui.relate('lia', { suspicion: 5 }, 'stared');
      } else if (a === 'talk') {
        F.talked = (F.talked || 0) + 1;
        if (F.talked === 1) {
          ui.know('lang_barrier');
          Memory.add(S, G, { type: 'strange', subject: 'player', detail: 'unknown_language' });
          out = ['「저기요…… 괜찮아요?」', '', '그녀의 눈썹이 찌푸려진다.', '「……?」', '',
            '그녀가 무언가를 되묻는다.', ui.speak('「[[어디:30]]서 [[왔:30]]어? [[어느:35]] [[마을:20]]?」'),
            '……알아들을 수 없다.', '', '고개를 젓자, 그녀의 얼굴에 묘한 표정이 떠오른다.',
            '경계가 아니다. 이해할 수 없는 것을 보는 얼굴이다.', '', '……그녀는 내 말을 모른다.', '내가 그녀의 말을 모르는 것처럼.'];
        } else if (F.talked === 2) {
          ui.relate('lia', { trust: 3 }, 'talked');
          out = ['다시 말을 걸어 본다. 이번엔 천천히, 손짓을 섞어서.', '', '그녀가 한숨을 쉰다.',
            '그리고 자기 가슴을 두 번 두드린다.', '「리아.」', '한 번 더.', '「리아.」'];
        } else {
          out = ['손짓 발짓으로 무언가를 전해 보려 한다.', ui.speak('「[[너:25]]…… [[정말:40]] [[아무것도:40]] [[몰라:30]]?」'),
            '그녀는 알 수 없는 말을 중얼거리며 고개를 젓는다.'];
        }
      } else if (a === 'say') {
        const r = Dialogue.playerSays(S, 'lia', word.id);
        out = ['그녀에게서 들은 소리를 흉내 내어 본다.', `「${word.sound}.」`, ''];
        if (r.success) out.push('그녀의 눈이 커진다.', `「……${word.sound}.」`, '그녀가 같은 소리를 천천히 되받는다. 고개를 끄덕인다.', K('……통했다.'));
        else out.push('그녀가 고개를 갸웃한다.', '……발음이 틀렸거나, 뜻이 틀렸다.');
      } else if (a === 'name') {
        F.named = true;
        ui.know('girl_name');
        ui.relate('lia', { trust: 10, affection: 5 }, 'named');
        G.knowledge.facts.playerName = true;
        Memory.add(S, G, { type: 'heard_name', subject: 'player', detail: P.name });
        Knowledge.learnName(S, 'lia');
        out = ['내 가슴을 가리킨다.', '「{이름}.」', '', '그녀가 눈을 깜빡인다.', '「……{이름}?」',
          '발음이 조금 이상하다. 하지만 분명 내 이름이다.', '', '그녀가 다시 자기 가슴을 두드린다.', '「리아.」', '「……리아.」', '',
          '그녀의 입꼬리가, 아주 조금 올라간다.'];
      } else if (a === 'callname') {
        F.calledName = true;
        ui.relate('lia', { suspicion: 25, fear: 15, trust: -5 }, 'knew_name');
        Memory.add(S, G, { type: 'strange', subject: 'player', detail: 'knew_my_name' });
        out = ['「……리아?」', '', '그녀의 몸이 굳는다.', '단검이 완전히 뽑혀 나온다.',
          ui.speak('「[[어떻게:40]]…… [[내:25]] [[이름을:35]]……?」'), '',
          '……아차.', '이번의 그녀는, 나에게 이름을 알려 준 적이 없다.'];
      } else if (a === 'herb') {
        F.gotHerb = true;
        Player.take(me, 'herb');
        G.physical.bleed = 0;
        if (P.knowledge.herb_heals) {
          Social.help(S, 'player', 'lia', 'herb', { trust: 20, respect: 10 });
          out = ['쓴 풀을 두 손으로 비벼 짓이긴다.', '그녀의 팔을 가리키고, 내 손을 보여 준다.', '',
            '그녀가 망설이다가, 팔을 내민다.', '짓이긴 풀을 상처에 꾹 누른다. 그녀가 이를 악문다.', '……피가 멎는다.', '',
            ui.speak('「……[[어디:30]]서 [[배웠:40]]어?」'), '그녀가 신기하다는 듯 나를 본다.'];
        } else {
          ui.know('herb_heals');
          Social.help(S, 'player', 'lia', 'herb', { trust: 15, respect: 5 });
          out = ['쓴 냄새가 나는 풀을 꺼내 내민다.', '그녀의 눈이 풀에 멎는다.', ui.speak('「……[[쓴잎:30]]?」'), '',
            '그녀가 풀을 낚아챈다. 입에 넣고 씹더니, 짓이긴 것을 상처에 꾹 누른다.', '이를 악문 얼굴이 조금씩 풀린다.', '',
            '……피가 멎는다.', K('그 풀은, 피를 멎게 하는 풀이었다.')];
        }
      } else if (a === 'berry') {
        F.sawBerry = true;
        ui.relate('lia', { trust: 3 }, 'berry');
        out = ['붉은 열매를 내민다.', '그녀가 내 손을 쳐낸다. 열매가 흙바닥에 흩어진다.', '',
          ui.speak('「[[독:15]]! [[먹으면:40]] [[죽어:30]]!」'), '그녀가 목을 움켜쥐고, 토하는 시늉을 한다.'];
        if (ui.learn('독')) out.push('', K('……"독". 먹으면 안 된다는 말이다.'));
        if (me.ateBerry) out.push('……어제 배가 뒤집혔던 게 그것 때문이었다.');
        ui.know('berry_poison');
        delete me.inv.berry;
      } else if (a === 'wait') {
        min = 15;
        ui.relate('lia', { suspicion: -5 }, 'waited');
        out = ['나무 하나를 사이에 두고 앉는다.', '그녀도 나도 말이 없다.', '새소리. 그녀의 얕은 숨소리.'];
        if (G.mental.fear < 45) out.push('그녀의 어깨에서 힘이 조금 빠진다.');
      } else if (a === 'threat') {
        // 협박: 공포와 적의가 오르고 신뢰가 무너진다. 그녀는 달아난다 (통합 명세 36절)
        const strong = G.physical.health >= 25;
        Social.threaten(S, 'player', 'lia', { hostility: 50, trust: -30, fear: 20 });
        if (strong) {
          ui.hurt(3, '그녀를 위협했다가 되레 쓰러졌다', 'lia');
          out = [me.inv.stone ? '돌을 쥐고 그녀를 노려본다.' : '주먹을 쥐고 한 걸음 내딛는다.', '',
            '그녀가 먼저 움직인다. 다친 사람의 움직임이 아니다.', '단검 자루가 명치에 꽂힌다. 숨이 막힌다.',
            ui.speak('「[[오지:30]] [[마:30]]!」'), '', '고개를 들었을 때, 그녀는 이미 숲 속으로 사라진 뒤다.'];
        } else {
          out = ['한 걸음 내딛는다.', '그녀의 눈에 공포가 스친다.', '그녀는 다친 팔을 끌어안고, 기다시피 숲 속으로 달아난다.',
            '핏자국이 풀 위로 길게 이어진다.'];
          Places.addTrace(W, me.loc, 'blood', { quiet: true });
        }
        Behavior.force(S, G, 'flee');
        W.worldFlags.feed.length = 0;
        out.push(...ui.pass(5));
        await ui.page(out);
        await ui.more();
        return me.hp <= 0 ? 'die' : 'ok';
      } else if (a === 'attack') {
        // 공격: 정답도 오답도 아니다. 다만 세계는 그것을 기억한다.
        const strong = G.physical.health >= 25;
        ui.use('str');
        Social.attack(S, 'player', 'lia', { weapon });
        const res = Combat.playerVsNpc(S, G, weapon);
        out = [weapon ? `${J(wname, '을를')} 치켜들고 달려든다.` : '주먹을 쥐고 달려든다.', ''];
        if (!res.hit) out.push('그녀가 몸을 비튼다. 허공을 가른다.');
        else if (res.killed) out.push('……둔한 소리.', '그녀의 몸이 나무뿌리 위로 무너진다.', '단검이 손에서 미끄러진다.', '', '움직이지 않는다.');
        else out.push('손에 둔한 감촉이 전해진다. 그녀가 비틀거린다.');
        if (G.alive) {
          if (strong) {
            ui.hurt(4, '그녀에게 달려들었다가 칼에 찔렸다', 'lia');
            Player.injure(S, 'stab', 40);
            out.push('', '그녀의 단검이 번뜩인다.', '옆구리가 뜨겁다. 무릎이 꺾인다.');
          }
          Behavior.force(S, G, 'flee');
          Places.addTrace(W, me.loc, 'blood', { quiet: true });
          out.push('', '고개를 들었을 때, 그녀는 피를 흘리며 숲 속으로 사라지고 있다.');
        }
        W.worldFlags.feed.length = 0;
        out.push(...ui.pass(5, { fight: true }));
        await ui.page(out);
        await ui.more();
        return me.hp <= 0 ? 'die' : 'ok';
      } else if (a === 'leave') {
        G.flags.lastSawPlayer = W.time.t;
        movePlayer(ui, 'stream');
        return 'leave';
      }

      out.push(...ui.pass(min));
      if (me.hp <= 0) { await ui.page([...out, '', '눈앞이 어두워진다.']); await ui.more(); return 'die'; }
      if (Npc.present(W, G) && G.alive) out.push('', ...girlLook(ui, G));
      await ui.page(out);
      unread = true;
    }
  }

  return { beast, light, call, status, allocate, checkBody, girl, peopleLines };
})();

if (typeof module !== 'undefined') module.exports = { Scenes };
