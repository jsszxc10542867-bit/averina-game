// 상태: 유지 상태(죽어도 남는 것)와 회차 상태(죽으면 초기화되는 것)를 분리한다.
const MIN_DAY = 1440;
const START_MINUTE = 15 * 60; // 첫날 오후 3시에 눈을 뜬다

// 유지 상태: 이름, 지식, 언어 이해도, 배운 단어, 기억 조각
function newPersistent() {
  return {
    name: null,
    deaths: 0,
    rewinds: 0, // 되감은 횟수 (죽음 + 1장 끝에서 스스로 되감기)
    language: { avere: 0, silva: 0, dor: 0, mar: 0, beast: 0, ancient: 0, spirit: 0 },
    words: {},     // 뜻을 알아낸 아베르어 단어. 예: { 물: true }
    knowledge: {}, // 예: { smoke: true, fresh_prints: true }
    memory: {
      identity: true, name: false, family: 'unknown',
      previousLocation: 'unknown', lastMoment: 'unknown', worldKnowledge: 0,
    },
  };
}

// 회차 상태: 죽으면 처음 눈을 뜬 시점으로 초기화된다 (능력치, 소지품, 시간, 위치, 관계 포함)
function newRun() {
  return {
    t: START_MINUTE, // 1일차 0시부터 흐른 분
    loc: 'clearing',
    inv: {},
    seen: {},   // 한 번만 나오는 장면 표시
    counts: {}, // 반복 행동 횟수
    day2Acts: 0,
    // 몸
    hp: 10, thirst: 40, hunger: 30, starve: 0, feel: {},
    stats: { str: 3, agi: 3, vit: 3, int: 3, sen: 3, wil: 3 },
    grasp: { str: 0, agi: 0, vit: 0, int: 0, sen: 0, wil: 0 }, // 몸을 쓴 횟수 (능력치 이해도)
    status: { unlocked: false, points: 0, known: {} },
    notes: [],   // 행동 뒤에 덧붙일 짧은 알림
    pending: [], // 다음 화면에서 벌어질 장면
    girl: null,  // 첫 번째 NPC (둘째 날 새벽에 생긴다)
    end: null,
    cause: null, // 마지막으로 다친 까닭 (죽으면 죽음 화면에 보인다)
  };
}

const clockOf = (t) => t % MIN_DAY;
const dayOf = (t) => Math.floor(t / MIN_DAY) + 1;

function periodOf(t) {
  const h = clockOf(t) / 60;
  if (h >= 6 && h < 11) return 'morning';
  if (h >= 11 && h < 15) return 'day';
  if (h >= 15 && h < 18) return 'afternoon';
  if (h >= 18 && h < 20) return 'evening';
  return 'night';
}

const PERIOD_KO = { morning: '아침', day: '낮', afternoon: '오후', evening: '저녁', night: '밤' };
const DAY_KO = ['', '', '둘째 날', '셋째 날', '넷째 날', '다섯째 날', '여섯째 날', '일곱째 날'];

// 세이브/로드. 저장소를 못 쓰는 환경(사생활 보호 창 등)에서도 게임은 그대로 돌아간다.
const Save = {
  KEY: 'avernia_save_v1',
  write(P, R) {
    try { localStorage.setItem(this.KEY, JSON.stringify({ v: 1, P, R })); } catch (e) { /* 저장 불가 */ }
  },
  read() {
    try {
      const s = JSON.parse(localStorage.getItem(this.KEY));
      return s && s.v === 1 && s.P && s.R ? s : null;
    } catch (e) { return null; }
  },
  clear() {
    try { localStorage.removeItem(this.KEY); } catch (e) { /* 무시 */ }
  },
};

if (typeof module !== 'undefined') {
  module.exports = { MIN_DAY, START_MINUTE, newPersistent, newRun, clockOf, dayOf, periodOf, PERIOD_KO, DAY_KO, Save };
}
