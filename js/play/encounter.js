// 누군가와 마주친다 (리아의 첫 장면이 아닌 모든 만남). 장면 글이 따로 없는 사람도 세계 상태에 맞춰 반응한다.
// NPC의 태도는 관계(소문으로 들은 인상 포함)·성격·기억·지금 하는 일에서 나온다 (통합 명세 12·35절).
const Encounter = (() => {
  const K = (t) => ({ t, cls: 'know' });
  const J = (w, t) => w + Text.josa(w, t);
  const armed = (n) => Object.keys(n.inventory).some((k) => ITEM_DEFS[k] && ITEM_DEFS[k].category === 'weapon');
  const GIFTS = ['bread', 'dried_meat', 'waterskin', 'bandage', 'herb', 'berry'];

  // NPC의 첫마디: 무엇을 하던 중이었는지, 나를 어떻게 여기는지에 따라
  function opening(S, n) {
    const r = Rel.get(S.W, n.id, 'player');
    const search = Goals.get(n, 'search');
    if (search) return { id: 'ask_seen', vars: { target: S.W.npcs[search.target].identity.name } };
    if (r.hostility >= 50) return { id: 'go_away' };
    if (r.trust >= 40 && Player.bleeding(S.W)) return { id: 'are_you_ok' };
    if (r.trust >= 40) return { id: 'greet_warm' };
    // 지키는 사람이거나 나를 크게 의심하면 따져 묻고, 아니면 말을 건다
    if (n.identity.occupation === 'guard' || r.suspicion >= 60) return { id: 'challenge' };
    return { id: 'greet' };
  }

  function speak(S, n, d) {
    const r = Dialogue.process(S, { speakerId: n.id, listenerId: 'player', dialogueId: d.id, vars: d.vars });
    return r.tone && !r.fullyUnderstood ? [r.displayText, r.tone] : [r.displayText];
  }

  const ACTIVITY = {
    search: '무언가를 찾는 듯 사방을 두리번거린다.', gather: '허리를 굽혀 풀숲을 뒤지고 있다.', rest: '나무에 기대어 숨을 고르고 있다.',
    sleep: '웅크린 채 잠들어 있다.', flee: '무언가에 쫓기듯 서두르고 있다.', hide: '몸을 낮추고 있다.',
  };

  // 상대가 먼저 움직인다: 적의가 크고 용감하면 덤비고, 두려우면 달아난다
  function theirMove(S, n, out) {
    const r = Rel.get(S.W, n.id, 'player');
    const w = Narrative.who(S, n);
    if (r.hostility >= 60 && n.personality.bravery >= 50 && armed(n) && n.physical.health > 30) {
      Player.hurt(S, 3, `${w}에게 공격당했다`, n.id);
      Player.injure(S, 'stab', 30);
      out.push('', `${J(w, '이가')} 무기를 휘두른다. 피할 틈이 없다.`, '뜨거운 것이 옆구리를 가른다.');
      return true;
    }
    if (r.fear >= 60 && n.personality.bravery < 60) {
      Behavior.force(S, n, 'flee');
      S.W.worldFlags.feed.length = 0;
      out.push('', `${J(w, '이가')} 뒷걸음질 치더니, 몸을 돌려 달아난다.`);
      return true;
    }
    return false;
  }

  async function run(ui, id) {
    const { S, W, P, me } = ui;
    const n = W.npcs[id];
    ui.talker = id;
    const first = !Memory.has(n, 'player', 'met');
    Social.meet(S, id);
    const who = () => Narrative.who(S, n);
    const lines = [id === 'lia' ? '그녀다.' : `${J(first ? n.identity.desc : who(), '이가')} 있다.`];
    const act = n.currentAction && ACTIVITY[n.currentAction.type];
    if (act) lines.push(act);
    lines.push('', `${J(who(), '이가')} 나를 본다.`, ...speak(S, n, opening(S, n)), ...Narrative.describe(S, n));
    await ui.page(lines);

    while (true) {
      if (!n.alive || !Npc.present(W, n)) return 'ok';
      const r = Rel.get(W, id, 'player');
      const search = Goals.get(n, 'search');
      const weapon = Combat.weaponOf(me);
      const gift = GIFTS.find((k) => me.inv[k]);
      const word = LangKnowledge.heardWords(S, Lang.AVER).find((x) => x.confidence >= LangKnowledge.GUESS);
      const opts = [
        { id: 'look', label: '가만히 살펴본다' },
        { id: 'near', label: '다가간다' },
        { id: 'hands', label: '두 손을 펴 보인다' },
        { id: 'talk', label: '말을 걸어 본다' },
      ];
      if (word) opts.push({ id: 'say', label: '들은 말을 되풀이해 본다' });
      if (search && P.knowledge.girl_hollow) opts.push({ id: 'point', label: '움푹한 곳이 있는 쪽을 가리킨다', hint: '안다' });
      if (gift) opts.push({ id: 'give', label: `${J(Player.label(gift, P), '을를')} 내민다` });
      if (Companion.canAsk(S, n)) opts.push({ id: 'ask', label: '함께 가자고 손짓한다' });
      opts.push({ id: 'threat', label: '주먹을 쥐고 위협한다' });
      opts.push({ id: 'attack', label: weapon ? `${J(ITEM_DEFS[weapon].name, '을를')} 치켜들고 달려든다` : '달려든다' });
      opts.push({ id: 'leave', label: '물러선다', sep: true });
      const { idx, manner } = await ui.choose(opts);
      const a = opts[idx].id;
      const w = who();
      let out = [], min = 5;

      if (a === 'look') {
        const d = Narrative.describe(S, n);
        out = [`${J(w, '을를')} 가만히 살핀다.`, armed(n) ? '손에 무기를 쥐고 있다.' : '무기는 보이지 않는다.', ...(d.length ? d : ['무슨 생각을 하는지 알 수 없는 얼굴이다.'])];
      } else if (a === 'near') {
        if (r.suspicion >= 50 || r.fear >= 50) {
          if (n.personality.bravery >= 50 && armed(n)) {
            ui.relate(id, { suspicion: manner === 'careful' ? 2 : 6 }, 'approached');
            out = ['한 걸음 다가선다.', `${J(w, '이가')} 무기 끝을 나에게 겨눈다.`, ...speak(S, n, { id: 'challenge' })];
          } else {
            ui.relate(id, { fear: manner === 'careful' ? 3 : 8 }, 'approached');
            out = ['한 걸음 다가선다.', `${J(w, '이가')} 그만큼 물러선다.`];
          }
        } else {
          ui.relate(id, { familiarity: 3 }, 'approached');
          out = ['천천히 다가간다.', `${J(w, '은는')} 물러서지 않는다.`];
        }
      } else if (a === 'hands') {
        ui.relate(id, { suspicion: -10, fear: -5 }, 'showed_hands');
        out = ['두 손을 펴 보인다. 아무것도 들지 않았다는 것을.', r.suspicion >= 60 ? `${J(w, '은는')} 여전히 나를 노려본다. 그래도 조금은 누그러진 것 같다.` : `${J(w, '이가')} 작게 고개를 끄덕인다.`];
      } else if (a === 'talk') {
        Memory.add(S, n, { type: 'strange', subject: 'player', detail: 'unknown_language' });
        if (r.trust < 30) ui.relate(id, { suspicion: 3 }, 'strange_words');
        out = ['「저기요……」', '', `${J(w, '이가')} 얼굴을 찌푸린다.`, '「……?」', '', '말이 통하지 않는다.'];
      } else if (a === 'say') {
        const res = Dialogue.playerSays(S, id, word.id);
        const snd = LangRegistry.sound(word.id, word.id);
        out = ['들은 소리를 흉내 내어 본다.', `「${snd}.」`, ''];
        out.push(...(res.success ? [`${J(w, '이가')} 눈을 크게 뜬다.`, `「……${snd}?」`, K('……알아들었다.')] : [`${J(w, '이가')} 고개를 갸웃한다.`]));
      } else if (a === 'point') {
        // 말이 없어도 손짓은 통한다
        search.plan.splice(search.idx, 0, 'hollow');
        ui.relate(id, { trust: 8, suspicion: -8 }, 'pointed');
        out = ['숲 안쪽, 뿌리가 엉킨 움푹한 곳이 있는 쪽을 가리킨다.', `${J(w, '이가')} 내 손끝을 따라 그쪽을 본다.`, '잠시 망설이더니, 그쪽으로 발을 옮긴다.'];
        Behavior.interrupt(n);
      } else if (a === 'give') {
        if (gift === 'berry') {
          ui.relate(id, { suspicion: 5 }, 'berry');
          out = ['붉은 열매를 내민다.', `${J(w, '이가')} 질색하며 손사래를 친다.`, ui.speak('「[[독:15]]!」', id)];
          if (ui.learn('독')) out.push(K('……"독". 먹으면 안 된다는 말이다.'));
        } else {
          Player.take(me, gift);
          n.inventory[gift] = (n.inventory[gift] || 0) + 1;
          Social.help(S, 'player', id, 'gift', { trust: 6, suspicion: -6, affection: 2 });
          out = [`${J(Player.label(gift, P), '을를')} 내민다.`, `${J(w, '이가')} 머뭇거리다가 받아 든다.`, ...speak(S, n, { id: 'thanks' })];
        }
      } else if (a === 'ask') {
        out = ['나와 저편을 번갈아 가리키며, 함께 가자고 손짓한다.', ...Companion.ask(S, n)];
      } else if (a === 'threat') {
        Social.threaten(S, 'player', id);
        out = ['주먹을 쥐고 한 걸음 내딛는다.'];
        if (!theirMove(S, n, out)) out.push(`${J(w, '이가')} 무기를 고쳐 쥔다. 물러설 기색이 없다.`);
      } else if (a === 'attack') {
        ui.use('str');
        Social.attack(S, 'player', id, { weapon });
        const res = Combat.playerVsNpc(S, n, weapon);
        out = [weapon ? `${J(ITEM_DEFS[weapon].name, '을를')} 치켜들고 달려든다.` : '달려든다.', ''];
        if (!res.hit) out.push(`${J(w, '이가')} 몸을 비튼다. 허공을 가른다.`);
        else if (res.killed) out.push('……둔한 소리.', `${J(w, '이가')} 쓰러진다.`, '', '움직이지 않는다.');
        else out.push(`손에 둔한 감촉이 전해진다. ${J(w, '이가')} 비틀거린다.`);
        if (n.alive) theirMove(S, n, out);
        min = 5;
      } else if (a === 'leave') {
        n.flags.metAt = W.time.t;
        await ui.page(['눈을 피하고 물러선다.', `${J(w, '은는')} 나를 한동안 지켜보다가, 제 할 일로 돌아간다.`]);
        await ui.more();
        return 'ok';
      }

      W.worldFlags.feed.length = 0;
      out.push(...ui.pass(min, a === 'attack' ? { fight: true } : {}));
      if (me.hp <= 0) { await ui.page([...out, '', '눈앞이 어두워진다.']); await ui.more(); return 'die'; }
      if (n.alive && Npc.present(W, n)) out.push('', ...Narrative.describe(S, n));
      else if (n.alive) out.push('', `${J(w, '은는')} 이제 보이지 않는다.`);
      await ui.page(out);
      if (!n.alive || !Npc.present(W, n)) { n.flags.metAt = W.time.t; await ui.more(); return 'ok'; }
    }
  }

  return { run, opening };
})();

if (typeof module !== 'undefined') module.exports = { Encounter };
