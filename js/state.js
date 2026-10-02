// 플레이어가 아는 것 (P)과 저장/불러오기.
// P: 이름, 쓰러진 횟수, 기억 조각, 알아낸 사실, 발견한 장소·사람·사건·소문, 단서, 언어, 마법에 대한 이해 — 모두 쌓인다
// W: 세계 상태 (core/world.js). 둘 다 저장된다. (되감기는 폐기되었다: 스토리_재설계.md 0절)
const Persist = (() => {
  function create() {
    return {
      v: 2,
      name: null,
      collapses: 0, // 쓰러진 횟수 (엔딩 변수로 쓸 수 있다)
      memory: {
        identity: true, name: false, family: 'unknown',
        previousLocation: 'unknown', lastMoment: 'unknown', worldKnowledge: 0,
      },
      knowledge: {},              // 알아낸 사실 (수첩). world.js의 KNOW
      found: Knowledge.create(),  // 발견한 장소·사람·사건·소문 (통합 명세 19·20절)
      lang: LangStore.create(),   // 언어 지식 (언어 시스템 35절)
      magic: { understanding: {} },
      clues: {},                  // 모은 단서 { id: { t, from } } (play/clues.js)
      threads: {},                // 열린 단서 갈래 { thread: t }
    };
  }
  return { create };
})();

// 저장 (통합 명세 32절): P와 W를 통째로. 불러오면 같은 세계가 이어진다 (난수 씨앗도 W 안에 있다).
// 칸: 'auto'(장면 밖에서 다음 행동을 고를 때마다 저절로)와 손으로 저장하는 1~SLOTS.
// 손 저장은 엔진이 안전하다고 할 때만 된다 (Avernia.save). "처음부터"는 자동 칸만 지운다.
const Save = (() => {
  const KEY = 'avernia_save_v2';
  const OLD = 'avernia_save_v1';
  const SLOTS = 3;
  const keyOf = (slot) => (slot == null || slot === 'auto' ? KEY : `${KEY}:${slot}`);
  const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);

  // 저장한 뒤에 코드가 새 칸을 더했어도 비어 있지 않게 채운다 (없는 칸만. 있는 값은 건드리지 않는다)
  function fill(target, defaults) {
    Object.keys(defaults).forEach((k) => {
      if (target[k] === undefined) target[k] = JSON.parse(JSON.stringify(defaults[k]));
      else if (plain(target[k]) && plain(defaults[k])) fill(target[k], defaults[k]);
    });
    return target;
  }

  // 저장했으면 true
  function write(S, slot) {
    try { localStorage.setItem(keyOf(slot), JSON.stringify({ v: 2, P: S.P, W: S.W, savedAt: Date.now() })); return true; } catch (e) { return false; /* 저장할 수 없는 환경 */ }
  }

  // { P, W, migrated } 또는 null
  function read(slot) {
    try {
      const s = JSON.parse(localStorage.getItem(keyOf(slot)));
      if (s && s.v === 2 && s.P && s.W) return load(s);
      if (keyOf(slot) !== KEY) return null;
      const old = JSON.parse(localStorage.getItem(OLD));
      if (old && old.v === 1 && old.P) return fromV1(old);
    } catch (e) { /* 깨진 저장 파일은 없는 것으로 본다 */ }
    return null;
  }

  // 없는 칸만 더한다. 안으로 들어가지 않는다.
  function shallow(target, defaults) {
    if (!plain(target) || !plain(defaults)) return;
    Object.keys(defaults).forEach((k) => { if (target[k] === undefined) target[k] = JSON.parse(JSON.stringify(defaults[k])); });
  }

  // 세계는 "구조"만 채운다. 소지품·관계·소문·흔적 같은 목록은 채우지 않는다
  // (먹어 없앤 빵이나 잊힌 소문이 되살아나면 안 된다)
  function fillWorld(W) {
    const d = World.create();
    shallow(W, d);
    ['time', 'weather', 'worldFlags', 'events', 'economy', 'politics'].forEach((k) => shallow(W[k], d[k]));
    shallow(W.player, d.player);
    ['surv', 'acc', 'status', 'magic', 'life'].forEach((k) => shallow(W.player[k], d.player[k]));
    Object.keys(d.npcs).forEach((id) => {
      if (!W.npcs[id]) { W.npcs[id] = d.npcs[id]; return; } // 새로 생긴 사람
      shallow(W.npcs[id], d.npcs[id]);
      ['physical', 'mental', 'needs', 'location', 'knowledge'].forEach((k) => shallow(W.npcs[id][k], d.npcs[id][k]));
      Npc.refresh(W.npcs[id], NPC_DEFS[id]); // 이름·역할·집·일정은 지금의 데이터를 따른다
    });
    Object.keys(d.creatures).forEach((id) => { if (!W.creatures[id]) W.creatures[id] = d.creatures[id]; else shallow(W.creatures[id], d.creatures[id]); });
    Object.keys(d.regions).forEach((id) => { if (!W.regions[id]) W.regions[id] = d.regions[id]; else shallow(W.regions[id], d.regions[id]); });
    Object.keys(d.locations).forEach((id) => { if (!W.locations[id]) W.locations[id] = d.locations[id]; });
    return W;
  }

  // 이름이 바뀐 사실: 예전 저장 파일의 것을 새 이름으로 옮긴다
  const RENAMED_FACTS = { voice_kills: 'voice_lost' };
  function migrateP(P) {
    Object.entries(RENAMED_FACTS).forEach(([from, to]) => {
      if (P.knowledge[from] && !P.knowledge[to]) P.knowledge[to] = P.knowledge[from];
      delete P.knowledge[from];
    });
  }

  function load(s) {
    fill(s.P, Persist.create());
    migrateP(s.P);
    LangStore.migrate(s.P);
    fillWorld(s.W);
    Incidents.restore(s.W);
    return { P: s.P, W: s.W, migrated: false };
  }

  // 예전 저장 파일: 이름·지식·배운 말은 옮기고, 세계는 처음 눈을 뜬 순간부터 다시 시작한다 (구조가 달라 이어 붙일 수 없다)
  function fromV1(old) {
    const P = fill(old.P, Persist.create());
    migrateP(P);
    LangStore.migrate(P);
    P.v = 2;
    return { P, W: World.create(), migrated: true };
  }

  // slot을 주면 그 칸만, 안 주면 자동 칸(과 예전 파일)을 지운다
  function clear(slot) {
    try {
      if (slot != null && slot !== 'auto') { localStorage.removeItem(keyOf(slot)); return; }
      localStorage.removeItem(KEY); localStorage.removeItem(OLD);
    } catch (e) { /* 무시 */ }
  }

  // 칸마다 요약: { slot, empty } 또는 { slot, name, t, loc, savedAt }. 세계를 다시 짓지 않고 읽기만 한다
  function list() {
    return ['auto', ...Array.from({ length: SLOTS }, (_, i) => i + 1)].map((slot) => {
      try {
        const s = JSON.parse(localStorage.getItem(keyOf(slot)));
        if (s && s.v === 2 && s.P && s.W) return { slot, name: s.P.name, t: s.W.time.t, loc: s.W.player.loc, savedAt: s.savedAt || null };
      } catch (e) { /* 깨진 칸은 빈 칸으로 */ }
      return { slot, empty: true };
    });
  }

  return { KEY, SLOTS, fill, write, read, load, clear, list };
})();

if (typeof module !== 'undefined') module.exports = { Persist, Save };
