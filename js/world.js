// 숲의 지형, 행동, 시간에 따른 사건 (이야기 내용). 화면과 무관한 순수 데이터/로직이다.
// 각 행동의 run(g)은 출력할 줄 배열을 반환한다.
// g = { W(세계), P(되감아도 남는 것), me(플레이어의 몸), period(시간대), dark(어두운가), first, give, know, use }
// 아이템 이름과 성질은 data/items.js에 있다.

// 시간대별 하늘 (시간대는 core/time.js)
const SKY = {
  dawn: '이른 빛이 가지 사이로 가늘게 내려온다.',
  morning: '머리 위에서 햇빛이 쏟아지지만, 잎이 두꺼워 바닥은 반쯤 그늘이다.',
  afternoon: '빛이 비스듬하다. 그림자가 길어지고 있다.',
  evening: '숲이 붉게 물들었다. 그림자들이 서로 이어져 하나가 되어 간다.',
  night: '하늘은 검고, 나무의 윤곽만 겨우 보인다.',
  late_night: '하늘은 검고, 나무의 윤곽만 겨우 보인다.',
};

const LOCS = {
  clearing: {
    name: '공터',
    desc: (g) => [
      '이끼 낀 바위와 쓰러진 고목 사이의 작은 공터다.',
      '내가 처음 눈을 뜬 곳이다.',
      SKY[g.period],
    ],
    exits: [
      { to: 'stream', label: '물소리가 나는 쪽으로 간다', min: 15, kw: ['물소리', '계곡', '개울', '물가'],
        text: ['물소리를 따라 풀숲을 헤치고 나간다.'], hint: ['fresh_prints', '발자국이 있던 곳'] },
      { to: 'hill', label: '비탈을 올라간다', min: 30, kw: ['비탈', '언덕', '높은', '올라'],
        text: ['비탈이 가파르다. 숨이 차오르고 종아리가 당긴다.'], hint: ['smoke', '연기를 봤던 곳'], use: 'vit' },
      { to: 'deep', label: '숲 안쪽으로 들어간다', min: 15, kw: ['안쪽', '깊', '숲으로'],
        text: ['나무 사이로 들어선다.'],
        block: (g) => (g.dark
          ? { min: 5, lines: ['안쪽은 어둠이 너무 짙다.', '몇 걸음 가지 못하고 돌아선다.'] } : null) },
    ],
    actions: [
      { id: 'look', label: '주변을 조사한다', kw: ['조사', '주변', '살펴'], min: 10,
        run: (g) => {
          g.use('int');
          if (g.first('look_clearing')) {
            g.know('no_trail');
            return [
              '내가 누워 있던 자리를 살펴본다.',
              '눌린 풀이 사람 하나 크기만큼 남아 있다.',
              '그런데…… 이상하다. 이곳으로 이어지는 발자국이 없다.',
              '어딘가에서 걸어온 것이 아니라, 그냥 여기서 시작된 것 같다.',
            ];
          }
          return ['다시 둘러보지만 새로운 것은 없다.'];
        } },
      { id: 'tree', label: '고목을 살펴본다', kw: ['나무', '고목', '가지'], min: 10,
        run: (g) => {
          g.use('str');
          const n = g.W.worldFlags.counts.branch || 0;
          if (g.first('tree')) {
            g.give('branch', 5);
            return [
              '쓰러진 고목의 껍질을 만져 본다. 처음 보는 무늬다. 결이 나선으로 감겨 있다.',
              '마른 가지가 몇 개 부러져 나와 있다. 하나를 꺾어 든다.',
              '……나뭇가지를 얻었다.',
            ];
          }
          if (n >= 5) return ['쓸 만한 가지는 이제 충분하다.'];
          g.give('branch', 5);
          return ['마른 가지를 하나 더 꺾는다.'];
        } },
      { id: 'rock', label: '바위를 살펴본다', kw: ['바위', '돌'], min: 10,
        run: (g) => {
          g.use('str');
          const n = g.W.worldFlags.counts.stone || 0;
          if (g.first('rock')) {
            g.give('stone', 3);
            return [
              '이끼가 두껍다. 한쪽 면이 쪼개져서 날이 선 돌 조각이 떨어져 있다.',
              '손에 쥐어 본다. 묵직하고 모서리가 날카롭다.',
              '……날카로운 돌을 얻었다.',
            ];
          }
          if (n >= 3) return ['쓸 만한 돌은 이미 챙겼다.'];
          g.give('stone', 3);
          return ['조금 작은 돌 조각을 하나 더 줍는다.'];
        } },
    ],
  },

  stream: {
    name: '계곡',
    desc: (g) => [
      '돌 사이로 얕은 개울이 흐른다. 물은 맑고 차갑다.',
      '바닥의 자갈이 물빛 속에서 반짝인다.',
      SKY[g.period],
    ],
    exits: [
      { to: 'clearing', label: '공터로 돌아간다', min: 15, kw: ['공터', '돌아'], text: ['풀숲을 헤치고 돌아간다.'] },
      { to: 'downstream', label: '계곡을 따라 내려간다', min: 20, kw: ['따라', '내려', '아래'], text: ['물길을 따라 걷는다.'] },
    ],
    actions: [
      { id: 'drink', label: '물을 마신다', kw: ['물', '마시'], min: 10,
        run: (g) => {
          g.me.surv.thirst = 0;
          if (g.first('drink')) {
            return [
              '두 손으로 물을 떠 입에 댄다. 이가 시릴 만큼 차갑다.',
              '삼키자 목이 열리는 것 같다.',
              '몸이 얼마나 말라 있었는지, 그제야 안다.',
            ];
          }
          return ['다시 물을 마신다. 조금 더 괜찮아진다.'];
        } },
      { id: 'prints', label: '진흙의 자국을 살펴본다', kw: ['발자국', '자국', '진흙', '흔적'], min: 10,
        run: (g) => {
          g.know('fresh_prints');
          g.use('int');
          if (g.first('prints')) {
            return [
              '개울가 진흙에 무언가 찍혀 있다.',
              '사람의 발자국 같기도 하다. 그런데 앞쪽이 이상하다. 눌린 자국이 둘로 갈라져 있다.',
              '짐승의 것이 겹친 걸까. 아니면……',
              '진흙은 아직 축축하다. 오래된 흔적은 아니다.',
            ];
          }
          return ['자국은 그대로다. 어디로 이어지는지는 알 수 없다. 풀숲에서 끊겨 있다.'];
        } },
    ],
  },

  downstream: {
    name: '계곡 아래',
    desc: (g) => [
      '계곡이 넓어지는 곳이다. 물가에 덤불이 무성하다.',
      '덤불에 붉은 열매가 달려 있고, 바닥에는 잎이 넓은 풀이 깔려 있다.',
      SKY[g.period],
    ],
    exits: [
      { to: 'stream', label: '계곡을 따라 올라간다', min: 20, kw: ['올라', '위', '따라'], text: ['물길을 거슬러 걷는다.'] },
    ],
    actions: [
      { id: 'berry_look', label: '붉은 열매를 살펴본다', kw: ['열매', '살펴'], min: 10,
        run: (g) => {
          if (g.first('berry_look')) {
            return [
              '붉고 작은 열매다. 껍질이 매끈하고 달콤한 냄새가 난다.',
              '새 한 마리가 가지에 앉아 쪼아 먹고 있다……가, 내가 다가가자 날아가 버린다.',
              '새가 먹는다고 해서 사람도 먹어도 되는 걸까. 알 수 없다.',
            ];
          }
          return ['열매는 여전히 붉고 달콤한 냄새가 난다. 먹어도 되는지는 알 수 없다.'];
        } },
      { id: 'berry_pick', label: '열매를 딴다', kw: ['열매', '딴다', '따'], min: 10,
        run: (g) => {
          const n = g.W.worldFlags.counts.berry || 0;
          if (n >= 6) return ['더 딸 필요는 없을 것 같다.'];
          g.give('berry', 6, 3);
          return ['손바닥 가득 열매를 딴다. 먹지는 않았다.'];
        } },
      { id: 'herb_look', label: '잎이 넓은 풀을 살펴본다', kw: ['풀', '잎', '약초'], min: 10,
        run: (g) => {
          if (g.first('herb_look')) {
            return [
              '잎맥이 붉다. 코를 가까이 대자 쓴 냄새가 코를 찌른다.',
              '약이 될 것 같기도 하고, 독 같기도 하다.',
            ];
          }
          return ['쓴 냄새가 코끝에 남는다.'];
        } },
      { id: 'herb_pick', label: '풀을 뜯는다', kw: ['뜯', '풀'], min: 10,
        run: (g) => {
          const n = g.W.worldFlags.counts.herb || 0;
          if (n >= 4) return ['이 정도면 충분하다.'];
          g.give('herb', 4, 2);
          return ['풀을 몇 장 뜯어 챙긴다. 손에서 쓴 냄새가 난다.'];
        } },
    ],
  },

  hill: {
    name: '비탈 위',
    desc: (g) => [
      '비탈 꼭대기다. 평평한 바위 위에서 숲이 내려다보인다.',
      SKY[g.period],
    ],
    exits: [
      { to: 'clearing', label: '공터로 내려간다', min: 20, kw: ['내려', '공터'], text: ['조심스럽게 비탈을 내려간다.'] },
      { to: 'edge', label: '연기가 오르는 쪽으로 간다', min: 240, kw: ['연기'], use: 'vit',
        show: (g) => g.P.knowledge.smoke,
        text: ['연기가 오르던 방향을 눈에 새기고 비탈을 내려간다.', '해를 등지고, 몇 번이고 방향을 확인하며 걷는다.'],
        block: (g) => (g.period === 'evening' || g.dark || Time.clock(g.W.time.t) >= 15 * 60
          ? { min: 5, lines: ['지금 출발하면 도착하기 전에 해가 진다.', '밤의 숲을 걸을 자신은 없다.'] } : null) },
    ],
    actions: [
      { id: 'overlook', label: '주변을 둘러본다', kw: ['둘러', '보', '내려다'], min: 10,
        run: (g) => {
          if (g.dark) return ['어둠뿐이다. 아무것도 보이지 않는다.'];
          if (g.period === 'evening') {
            return g.P.knowledge.smoke
              ? ['연기가 있던 쪽을 본다. 이미 어두워져서 보이지 않는다.']
              : ['숲은 끝이 보이지 않는다. 해가 기울어 멀리는 흐릿하다.'];
          }
          if (g.first('overlook')) {
            g.know('smoke');
            return [
              '사방이 숲이다. 끝이 보이지 않는다. 사람의 흔적은 어디에도 없다.',
              '……그런데 아주 먼 곳에서, 가느다란 연기 한 줄기가 오르고 있다.',
              '걸어서 몇 시간은 걸릴 거리다.',
            ];
          }
          return ['연기는 아직 그 자리에서 오르고 있다. 아주 멀다.'];
        } },
    ],
  },

  deep: {
    name: '숲 안쪽',
    desc: (g) => [
      '숲이 짙어진다. 나무가 빽빽하고 빛이 줄어든다.',
      '공기가 눅눅하고, 발밑이 푹신하다.',
      g.period === 'evening' ? '이곳은 벌써 밤에 가깝다.' : SKY[g.period],
    ],
    exits: [
      { to: 'clearing', label: '공터로 돌아간다', min: 15, kw: ['공터', '돌아', '나간'], text: ['왔던 길을 되짚는다.'] },
    ],
    actions: [
      { id: 'branch', label: '꺾인 가지를 살펴본다', kw: ['가지', '꺾', '부러'], min: 10,
        run: (g) => {
          g.know('broken_branch');
          g.use('int');
          if (g.first('branch_look')) {
            return [
              '낮은 가지들이 꺾여 있다. 사람 허리쯤의 높이다.',
              '꺾인 단면이 아직 희다. 마르지 않았다.',
              '누군가, 혹은 무언가가 최근 이 길로 지나갔다.',
            ];
          }
          return ['단면은 여전히 희다. 그리 오래된 흔적이 아니다.'];
        } },
      { id: 'further', label: '더 깊이 들어간다', kw: ['더', '깊이'], min: 10,
        run: (g) => {
          g.W.worldFlags.counts.further = (g.W.worldFlags.counts.further || 0) + 1;
          g.use('wil');
          return [
            '한 걸음 더 내딛는다.',
            '그러자 어디선가 소리가 멎는다. 새도, 벌레도.',
            '발이 더 나가지 않는다. 지금은 아니다. 그런 느낌이 든다.',
          ];
        } },
    ],
  },
};

LOCS.hollow = {
  name: '움푹한 곳',
  desc: (g) => [
    '나무뿌리가 엉켜 움푹 꺼진 곳이다. 이끼가 짓눌려 있다.',
    SKY[g.period],
  ],
  exits: [
    { to: 'stream', label: '계곡으로 간다', min: 15, kw: ['계곡', '물'], text: ['물소리가 나는 쪽으로 걷는다.'] },
    { to: 'clearing', label: '공터로 간다', min: 20, kw: ['공터'], text: ['눈에 익은 쪽으로 걷는다.'] },
  ],
  actions: [
    { id: 'hollow_look', label: '주변을 조사한다', kw: ['조사', '주변', '살펴', '피'], min: 10,
      run: (g) => {
        const G = g.W.npcs.lia;
        g.use('int');
        if (G && !G.alive && G.death.location === 'hollow') return ['그녀가 기대어 있던 나무 아래에 검게 굳은 피가 고여 있다.', '……더 보고 싶지 않다.'];
        return [
          '나무 밑동에 검붉은 얼룩이 번져 있다. 피다. 아직 마르지 않았다.',
          '짓눌린 이끼 위로, 무언가를 끌고 간 자국이 숲 바깥쪽으로 이어진다.',
          '누군가 여기 있다가, 떠났다.',
        ];
      } },
  ],
};

// 숲을 벗어나는 곳 (지금 만든 부분의 끝)
LOCS.edge = { name: '숲의 가장자리', desc: () => [], exits: [], actions: [] };

// 알아낸 것 (되감기 뒤에도 남는다). 수첩에 이 문장으로 기록된다.
const KNOW = {
  no_trail: '내가 눈을 뜬 자리에는, 이어지는 발자국이 없었다.',
  fresh_prints: '개울가 진흙에 앞이 갈라진 발자국이 있었다.',
  smoke: '비탈 위에서 보면, 먼 곳에 연기가 오른다.',
  broken_branch: '숲 안쪽에 누군가 최근 지나간 흔적이 있었다.',
  beast_seen: '풀숲에 이상한 짐승이 있다. 눈이 셋이다.',
  beast_water: '그 짐승은 물가로는 오지 않는다.',
  light_watches: '해 질 녘 숲에 떠 있는 빛은, 나를 보고 있었다.',
  light_touched: '그 빛은 따뜻했다. 그리고 무언가를 속삭였다.',
  night_cry: '밤이 되면 멀리서 무언가가 운다.',
  name_call: '밤에, 내 이름을 부르는 목소리가 있다.',
  night_path: '밤이 되면 낮에 없던 길이 생긴다.',
  voice_kills: '그 목소리를 따라가면, 죽는다.',
  berry_poison: '붉은 열매는 먹으면 안 된다.',
  herb_heals: '쓴 냄새가 나는 풀은 피를 멎게 한다.',
  girl_hollow: '둘째 날 아침, 숲 속 움푹한 곳에 다친 여자가 있다.',
  girl_wound: '그녀의 팔 상처는 세 갈래 발톱 자국이었다.',
  lang_barrier: '그녀는 내 말을 모른다. 내가 그녀의 말을 모르는 것처럼.',
  girl_name: '그녀의 이름은 리아다.',
  magic_seen: '그녀가 손을 대자, 손끝이 빛나며 상처가 아물었다.',
  village: '그녀는 연기 쪽을 가리키며 "마을"이라고 했다.',
};

// 어느 장소에서나 할 수 있는 행동
const GLOBAL_ACTIONS = {
  listen: { label: '소리를 듣는다', kw: ['소리', '듣', '귀'], min: 10 },
  bag: { label: '소지품을 확인한다', kw: ['소지품', '가방', '주머니'], min: 0 },
  rest: { kw: ['쉰', '쉬', '앉', '기다', '눕', '잔다'] },
};

function listenLines(g) {
  const p = g.period;
  if (g.me.loc === 'deep') return ['숲이 숨을 죽인 것 같다.', '내 숨소리가 가장 크다.'];
  if (g.dark) {
    g.use('sen');
    return ['귀를 기울인다.', '나무 사이를 지나는 바람. 그 너머로 무언가 발밑을 스치는 소리.', '가만히 있으면, 숲이 나를 듣고 있는 것 같다.'];
  }
  if (p === 'evening') return ['새 소리가 줄어 있다.', '그 자리를 벌레 소리가 채우고 있다.'];
  return [
    '귀를 기울인다. 물소리. 바람에 스치는 잎. 새 소리.',
    '그 사이로 무언가 작게 움직이는 소리가 지나간다.',
    '그러다 멎는다.',
  ];
}

function bagLines(S) {
  const me = S.W.player;
  const list = Object.entries(me.inv).filter(([, n]) => n > 0);
  if (!list.length) return ['주머니를 뒤져 본다. 비어 있다.', '아무것도 없다.'];
  const lines = ['가진 것을 확인한다.', ...list.map(([k, n]) => `· ${Player.label(k, S.P)} ${n > 1 ? '× ' + n : ''}`.trim())];
  if (Player.weight(me) > Player.carryLimit(me)) lines.push('……짐이 무겁다. 걸을 때마다 어깨가 짓눌린다.');
  return lines;
}

// 시계가 넘어가는 순간의 사건 (저녁, 밤, 새벽). 월드 틱이 시간을 흘리기 전에 부른다.
// 첫날 밤 23시의 목소리는 무엇을 하든 그 시각에 끼어든다 (시간이 거기서 멈추고 장면이 열린다).
// 둘째 날 새벽의 리아 습격은 이야기가 아니라 세계 사건이다 (sim/events.js).
const Story = (() => {
  function clock(S, from, to) {
    const { W, P } = S;
    const seen = W.worldFlags.seen;
    const lines = [];
    const events = [];
    for (let d = Math.max(0, Time.day(from) - 2); d <= Time.day(to) - 1; d++) {
      const b = d * Time.DAY;
      events.push({ at: b + 18 * 60, id: 'evening', d });
      events.push({ at: b + 20 * 60, id: 'night', d });
      events.push({ at: b + 23 * 60, id: 'call', d });
      events.push({ at: b + Time.DAY + 6 * 60, id: 'dawn', d });
    }
    events.sort((a, b) => a.at - b.at);
    for (const e of events) {
      if (!(from < e.at && to >= e.at)) continue;
      if (e.id === 'evening') {
        lines.push(...(seen.evening
          ? ['해가 기울고 있다.']
          : ['해가 지기 시작한다.', '숲의 색이 달라진다.', '새들의 소리가 줄어든다.']));
        seen.evening = true;
      } else if (e.id === 'night') {
        if (!seen.night) {
          lines.push('완전히 어두워졌다.', '그리고……', '낮에는 듣지 못했던 소리가 들리기 시작한다.',
            '멀리서 무언가가 운다. 길고 낮은 소리다.', '짐승의 것 같기도, 사람의 것 같기도 하다.');
          P.knowledge.night_cry = true;
        } else lines.push('다시 밤이 왔다.');
        seen.night = true;
      } else if (e.id === 'call') {
        if (e.d === 0 && !seen.call) {
          seen.call = true;
          W.worldFlags.pending.push('call');
          return { lines, stopAt: e.at }; // 여기서 시간이 멈춘다
        }
      } else if (e.id === 'dawn') {
        if (!seen.dawn) {
          lines.push('새벽이 밝아 온다.', '숲은 다시 조용해졌다.', '어젯밤의 일이 꿈이었던 것처럼 느껴진다.',
            '하지만……', '손에 묻은 흙은 그대로다.');
          W.worldFlags.pending.push('status');
        } else lines.push('동이 튼다.');
        seen.dawn = true;
      }
    }
    return { lines, stopAt: null };
  }
  return { clock };
})();

if (typeof module !== 'undefined') {
  module.exports = { SKY, LOCS, KNOW, GLOBAL_ACTIONS, listenLines, bagLines, Story };
}
