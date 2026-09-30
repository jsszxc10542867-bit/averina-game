// 개발자 전용 디버그 화면 (통합 명세 38절). 주소 끝에 ?debug 를 붙였을 때만 나타난다. 일반 플레이어에게는 보이지 않는다.
// 보여 주는 것: 시간·날씨, NPC의 위치·행동·목표·욕구·관계·기억·언어, 소문, 사건, 세력 관계, 경제, 플레이어 언어, 세계 상태 전체
// 명령: 시간 흘리기, 날씨, 플레이어 이동, NPC 이동, 관계 바꾸기, NPC 죽이기, 사건 만들기 — 모두 실제 시스템을 거친다.
(() => {
  if (typeof document === 'undefined' || !/[?&]debug\b/.test(location.search)) return;
  const S = () => window.__dev.state();
  const esc = (s) => String(s).replace(/[&<>]/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;' })[c]);
  const r0 = (n) => Math.round(n);
  const clock = (t) => `${Time.dayLabel(t)} ${String(Math.floor(Time.clock(t) / 60)).padStart(2, '0')}:${String(Time.clock(t) % 60).padStart(2, '0')}`;

  const style = document.createElement('style');
  style.textContent = `
    #dbgBtn{position:fixed;right:12px;bottom:44px;z-index:50;font:12px monospace;background:#223;color:#cde;border:1px solid #456;border-radius:6px;padding:6px 9px;cursor:pointer}
    #dbg{position:fixed;top:0;right:0;bottom:0;width:min(560px,100vw);z-index:49;background:#0b0f14f2;color:#cdd6e0;font:12px/1.5 Consolas,monospace;overflow:auto;padding:10px 12px 60px;border-left:1px solid #345;display:none}
    #dbg.on{display:block} #dbg h3{margin:10px 0 4px;color:#9cf;font-size:12px} #dbg .tabs button,#dbg .cmd button{margin:2px;font:11px monospace;background:#1b2530;color:#cde;border:1px solid #345;border-radius:4px;padding:3px 7px;cursor:pointer}
    #dbg .tabs button.on{background:#2d4a66} #dbg select,#dbg input{font:11px monospace;background:#111820;color:#cde;border:1px solid #345;margin:2px}
    #dbg pre{white-space:pre-wrap;word-break:break-all;margin:0} #dbg .dim{color:#789} #dbg .warn{color:#fb8}`;
  document.head.appendChild(style);

  const btn = document.createElement('button');
  btn.id = 'dbgBtn'; btn.textContent = 'DEBUG';
  const panel = document.createElement('div');
  panel.id = 'dbg';
  document.body.append(btn, panel);
  let tab = 'world';
  const TABS = { world: '세계', npc: 'NPC', social: '소문·사건', faction: '세력·경제', lang: '언어', json: 'WorldState' };

  function opts(list, sel) { return list.map((x) => `<option value="${esc(x)}"${x === sel ? ' selected' : ''}>${esc(x)}</option>`).join(''); }

  function commands(s) {
    const npcs = Object.keys(s.W.npcs), locs = Object.keys(PLACE_DATA);
    return `<div class="cmd">
      <button data-c="t60">시간 +1시간</button><button data-c="t360">+6시간</button><button data-c="t1440">+1일</button>
      날씨 <select id="dW">${opts(['clear', 'cloudy', 'rain', 'fog'], s.W.weather.kind)}</select><button data-c="weather">변경</button><br>
      플레이어 이동 <select id="dP">${opts(Object.keys(LOCS), s.W.player.loc)}</select><button data-c="tp">이동</button><br>
      NPC <select id="dN">${opts(npcs)}</select> → <select id="dL">${opts(locs)}</select><button data-c="move">강제 이동</button><button data-c="kill" class="warn">사망</button><br>
      관계 <select id="dA">${opts(npcs)}</select>→<select id="dB">${opts(['player', ...npcs])}</select>
      <select id="dX">${opts(Rel.AXES)}</select><input id="dV" type="number" value="50" style="width:48px"><button data-c="rel">설정</button><br>
      사건 <select id="dE">${opts(['missing', 'beast_attack', ...Object.keys(WORLD_EVENT_TYPES)])}</select> 대상 <select id="dT">${opts(npcs)}</select><button data-c="event">생성</button>
    </div>`;
  }

  function npcBlock(s, n) {
    const W = s.W;
    const rels = Object.entries(W.relationships).filter(([k]) => k.startsWith(n.id + '>'))
      .map(([k, r]) => `  ${k.split('>')[1]}: ` + Rel.AXES.filter((a) => r[a] >= 1).map((a) => `${a} ${r0(r[a])}`).join(', '));
    const act = n.currentAction ? `${n.currentAction.type} (~${clock(n.currentAction.until)})` : '-';
    const loc = n.location.transit ? `${n.location.loc} → ${n.location.path.join('→')} (도착 ${clock(n.location.nextAt)})` : n.location.loc + (n.location.hidden ? ' [숨음]' : '');
    return `<h3>${esc(n.id)} ${n.alive ? '' : '<span class="warn">[사망: ' + esc(n.death.cause) + ']</span>'}</h3><pre>${esc([
      `위치 ${loc}  |  지역 ${Places.regionOf(n.location.loc)}  |  행동 ${act}`,
      `몸 체력 ${r0(n.physical.health)} 출혈 ${n.physical.bleed.toFixed(3)} 충격 ${r0(n.physical.shock)} 통증 ${r0(n.physical.pain)} | 마음 두려움 ${r0(n.mental.fear)} 스트레스 ${r0(n.mental.stress)} 기분 ${r0(n.mental.mood)}`,
      `욕구 ` + Object.entries(n.needs).map(([k, v]) => `${k} ${r0(v)}`).join(' '),
      `목표 ` + n.goals.map((g) => `${g.id}(${r0(g.priority)})`).join(' '),
      `돈 ${r0(n.money)}  소지품 ` + JSON.stringify(n.inventory) + (n.magic ? `  마력 ${n.magic.mana}/${n.magic.maxMana}` : ''),
      `언어 ` + Object.entries(n.languages).map(([k, v]) => `${k} ${v.understanding}/${v.speaking}/${v.reading}/${v.writing}`).join(' '),
      `관계`, ...rels,
      `기억 ` + n.memories.map((m) => `${m.type}:${m.subject}(${m.emotionalImpact},${r0(m.importance)})`).join(' '),
      `소문 ` + Object.entries(n.knowledge.rumors).map(([id, h]) => `${W.rumors[id] ? W.rumors[id].type : id}@L${h.level}`).join(' '),
      `표시 ` + JSON.stringify(n.flags),
    ].join('\n'))}</pre>`;
  }

  function render() {
    const s = S();
    const W = s.W;
    let body = '';
    if (tab === 'world') {
      body = `<pre>${esc([
        `시각 ${clock(W.time.t)} (${Time.KO[Time.band(W.time.t)]})  회차 ${W.run}  날씨 ${Weather.KO[W.weather.kind]} ${Weather.temp(W).toFixed(1)}℃`,
        `플레이어 ${W.player.loc}  HP ${W.player.hp}/${hpMax(W.player)}  ` + Object.entries(W.player.surv).filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k} ${r0(v)}`).join(' '),
        `부상 ${JSON.stringify(W.player.surv.injuries.map((x) => x.kind))}  병 ${JSON.stringify(W.player.surv.illness.map((x) => x.kind))}`,
        `지역 ` + Object.entries(W.regions).map(([k, r]) => `${k}:${r.level} 위협${r0(r.threat)} 경계${r0(r.alert)}`).join(' | '),
        `짐승 ` + Object.values(W.creatures).map((c) => `${c.id}@${c.loc}${c.hp != null ? ` hp${c.hp} 두려움${r0(c.fear)}` : ''}${c.shy ? ' [피함]' : ''}`).join(' | '),
        `예정 사건 ` + W.events.scheduled.map((e) => `${e.type}@${clock(e.at)}${e.done ? '✓' : ''}`).join(' '),
        `진행 중 ` + JSON.stringify(W.events.active),
        `기록 ` + JSON.stringify(W.history.slice(-5)),
        `흔적 ` + Object.entries(W.locations).filter(([, v]) => v.traces.length).map(([k, v]) => `${k}:${v.traces.map((x) => x.kind).join(',')}`).join(' | '),
      ].join('\n'))}</pre><h3>최근 이벤트 버스</h3><pre class="dim">${esc(Bus.recent.slice(-25).reverse().map((e) => `${clock(e.t)} ${e.type} ${JSON.stringify(Object.fromEntries(Object.entries(e).filter(([k]) => k !== 'type' && k !== 't')))}`).join('\n'))}</pre>`;
    } else if (tab === 'npc') {
      body = Object.values(W.npcs).map((n) => npcBlock(s, n)).join('');
    } else if (tab === 'social') {
      body = `<h3>소문</h3><pre>${esc(Object.values(W.rumors).map((r) => {
        const holders = Object.values(W.npcs).filter((n) => n.knowledge.rumors[r.id]).map((n) => `${n.id}@L${n.knowledge.rumors[r.id].level}`);
        return `${r.id} ${r.type} (${r.subject || '-'}→${r.target || '-'}) 중요도${r.importance}\n  "${Rumor.plain(W, r, 0)}"\n  아는 사람: ${holders.join(' ')}${s.P.found.rumors[r.id] ? '  [플레이어가 들음]' : ''}`;
      }).join('\n') || '(없음)')}</pre><h3>세계 사건 (최근 40)</h3><pre>${esc(W.events.log.slice(-40).reverse().map((e) => `${clock(e.t)} ${e.type} @${e.loc || '-'} 목격:${e.witnesses.join(',') || '-'} ${JSON.stringify(e.data)}`).join('\n'))}</pre>`;
    } else if (tab === 'faction') {
      const v = W.economy.markets.village_square;
      body = `<h3>세력 관계 (긴장 ${r0(W.politics.tension)})</h3><pre>${esc(Object.entries(W.politics.relations).map(([k, r]) => `${k.padEnd(40)} 외교${r0(r.diplomacy)} 무역${r0(r.trade)} 적대${r0(r.hostility)} 신뢰${r0(r.trust)}`).join('\n'))}</pre>
        <h3>먼 곳의 소식</h3><pre>${esc(W.politics.news.map((x) => `${clock(x.t)} ${x.type}`).join('\n') || '(없음)')}</pre>
        <h3>마을 가게 (${Economy.open(W, 'village_square') ? '열림' : '닫힘'})</h3><pre>${esc(`재고 ${JSON.stringify(v.stock)}\n값 ${JSON.stringify(v.price)}\n오가는 사람 ${v.traffic.toFixed(2)}  장사 안 된 날 ${v.lowDays}\n기록 ${JSON.stringify(v.history.slice(-7))}`)}</pre>`;
    } else if (tab === 'lang') {
      const L = s.P.lang;
      body = `<pre>${esc([
        ...Object.entries(L.languageKnowledge).map(([k, v]) => `${k.padEnd(12)} 이해 ${v.understanding} 말하기 ${v.speaking} 읽기 ${v.reading} 쓰기 ${v.writing}`),
        '', '단어 (확신 / 들은 횟수)',
        ...Object.entries(L.knownWords).flatMap(([lang, ws]) => Object.entries(ws).map(([id, r]) => `  ${lang}:${id.padEnd(12)} ${r.confidence.toFixed(2)} ×${r.encounters}  「${LangRegistry.sound(id, id)}」`)),
        '', `이정표 ${JSON.stringify(L.languageMilestones)}`,
      ].join('\n'))}</pre>`;
    } else {
      body = `<pre class="dim">${esc(JSON.stringify(W, null, 1))}</pre>`;
    }
    panel.innerHTML = `<div class="tabs">${Object.entries(TABS).map(([k, v]) => `<button data-tab="${k}" class="${k === tab ? 'on' : ''}">${v}</button>`).join('')}</div>${commands(s)}${body}`;
  }

  function run(c) {
    const s = S();
    const W = s.W;
    const val = (id) => panel.querySelector('#' + id).value;
    if (c.startsWith('t')) { World.tick(s, +c.slice(1)); }
    else if (c === 'weather') Weather.set(s, val('dW'));
    else if (c === 'tp') Player.teleport(s, val('dP'));
    else if (c === 'move') Npc.place(s, W.npcs[val('dN')], val('dL'));
    else if (c === 'kill') Npc.kill(s, W.npcs[val('dN')], '(디버그) 강제로 죽었다', null);
    else if (c === 'rel') Rel.set(s, val('dA'), val('dB'), val('dX'), +val('dV'));
    else if (c === 'event') {
      const e = val('dE'), n = W.npcs[val('dT')];
      if (e === 'missing') { n.expectedHome = W.time.t - 1; n.flags.missingResolved = false; WorldEvents.checkMissing(s); }
      else if (e === 'beast_attack') Combat.creatureVsNpc(s, W.creatures.thornback, n);
      else Factions.trigger(s, e);
    }
    window.__dev.refresh();
    render();
  }

  btn.onclick = () => { panel.classList.toggle('on'); if (panel.classList.contains('on')) render(); };
  panel.addEventListener('click', (e) => {
    const t = e.target;
    if (t.dataset.tab) { tab = t.dataset.tab; render(); }
    else if (t.dataset.c) run(t.dataset.c);
  });
  // 선택 상자를 고르는 중에는 다시 그리지 않는다
  setInterval(() => { if (panel.classList.contains('on') && !panel.contains(document.activeElement)) render(); }, 1500);
  // 게임 키 입력(숫자 선택)이 디버그 화면 입력과 섞이지 않게
  panel.addEventListener('keydown', (e) => e.stopPropagation());
})();
