// 되감아도 남는 것 (P)과 저장/불러오기.
// P: 이름, 죽음과 되감기 횟수, 기억 조각, 알아낸 사실, 발견한 장소·사람·사건·소문, 언어, 마법에 대한 이해
// W: 세계 상태 (core/world.js). 죽으면 처음 눈을 뜬 순간의 세계로 되돌아간다.
const Persist = (() => {
  function create() {
    return {
      v: 2,
      name: null,
      deaths: 0,
      rewinds: 0, // 되감은 횟수 (죽음 + 1장 끝에서 스스로 되감기)
      memory: {
        identity: true, name: false, family: 'unknown',
        previousLocation: 'unknown', lastMoment: 'unknown', worldKnowledge: 0,
      },
      knowledge: {},              // 알아낸 사실 (수첩). world.js의 KNOW
      found: Knowledge.create(),  // 발견한 장소·사람·사건·소문 (통합 명세 19·20절)
      lang: LangStore.create(),   // 언어 지식 (언어 시스템 35절)
      magic: { understanding: {} },
    };
  }
  return { create };
})();

// 저장 (통합 명세 32절): P와 W를 통째로. 불러오면 같은 세계가 이어진다 (난수 씨앗도 W 안에 있다).
const Save = (() => {
  const KEY = 'avernia_save_v2';
  const OLD = 'avernia_save_v1';
  const plain = (o) => o && typeof o === 'object' && !Array.isArray(o);

  // 저장한 뒤에 코드가 새 칸을 더했어도 비어 있지 않게 채운다 (없는 칸만. 있는 값은 건드리지 않는다)
  function fill(target, defaults) {
    Object.keys(defaults).forEach((k) => {
      if (target[k] === undefined) target[k] = JSON.parse(JSON.stringify(defaults[k]));
      else if (plain(target[k]) && plain(defaults[k])) fill(target[k], defaults[k]);
    });
    return target;
  }

  function write(S) {
    try { localStorage.setItem(KEY, JSON.stringify({ v: 2, P: S.P, W: S.W })); } catch (e) { /* 저장할 수 없는 환경 */ }
  }

  // { P, W, migrated } 또는 null
  function read() {
    try {
      const s = JSON.parse(localStorage.getItem(KEY));
      if (s && s.v === 2 && s.P && s.W) return load(s);
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
    const d = World.create(W.run || 0);
    shallow(W, d);
    ['time', 'weather', 'worldFlags', 'events', 'economy', 'politics'].forEach((k) => shallow(W[k], d[k]));
    shallow(W.player, d.player);
    ['surv', 'acc', 'status', 'magic'].forEach((k) => shallow(W.player[k], d.player[k]));
    Object.keys(d.npcs).forEach((id) => {
      if (!W.npcs[id]) { W.npcs[id] = d.npcs[id]; return; } // 새로 생긴 사람
      shallow(W.npcs[id], d.npcs[id]);
      ['physical', 'mental', 'needs', 'location', 'knowledge'].forEach((k) => shallow(W.npcs[id][k], d.npcs[id][k]));
    });
    Object.keys(d.creatures).forEach((id) => { if (!W.creatures[id]) W.creatures[id] = d.creatures[id]; else shallow(W.creatures[id], d.creatures[id]); });
    Object.keys(d.regions).forEach((id) => { if (!W.regions[id]) W.regions[id] = d.regions[id]; else shallow(W.regions[id], d.regions[id]); });
    Object.keys(d.locations).forEach((id) => { if (!W.locations[id]) W.locations[id] = d.locations[id]; });
    return W;
  }

  function load(s) {
    fill(s.P, Persist.create());
    LangStore.migrate(s.P);
    fillWorld(s.W);
    return { P: s.P, W: s.W, migrated: false };
  }

  // 예전 저장 파일: 이름·지식·배운 말은 옮기고, 세계는 처음 눈을 뜬 순간부터 다시 시작한다 (구조가 달라 이어 붙일 수 없다)
  function fromV1(old) {
    const P = fill(old.P, Persist.create());
    LangStore.migrate(P);
    P.v = 2;
    return { P, W: World.create(P.rewinds || 0), migrated: true };
  }

  function clear() {
    try { localStorage.removeItem(KEY); localStorage.removeItem(OLD); } catch (e) { /* 무시 */ }
  }

  return { KEY, fill, write, read, load, clear };
})();

if (typeof module !== 'undefined') module.exports = { Persist, Save };
