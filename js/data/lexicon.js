// 언어 데이터 (언어 시스템 17·21·22절): 언어 목록, 단어, 뜻이 붙은 대사.
//
// 대사 표기 [확정]: 들리는 핵심 단어를 [[단어:임계값]]으로 감싼다. 임계값은 그 단어가 들리기 시작하는 이해도(%).
//   [[단어]]            임계값을 생략하면 단어 난이도 × 10
//   [[단어:30|오역]]    뜻을 어렴풋이 짐작하는 단계(확신 0.3~0.6)에서는 '오역'으로 잘못 알아듣는다
// 단어의 표면형(forms)이 같으면 같은 단어로 센다. 목록에 없는 단어는 표면형 자체를 단어로 쓴다.

const LANGUAGES = {
  common_aver: { name: '아베르어', type: 'spoken', difficulty: 1,
    regions: ['lumeris', 'caelvar', 'southern_confederation'], dialects: [] },
  silva: { name: '실바어', type: 'spoken', difficulty: 3, regions: ['sylvarenne'], dialects: ['ancient_silva'] },
  dorn: { name: '도르어', type: 'spoken', difficulty: 3, regions: ['dornak'], dialects: [] },
  mar: { name: '마르어', type: 'spoken', difficulty: 4, regions: ['demon_territories'],
    dialects: ['western_mar', 'northern_mar', 'urban_mar', 'ancient_mar'] },
  // [제안] 수인어 난이도와 지역은 명세에 없어 임시로 정했다 (부족마다 방언이 다르다)
  beast: { name: '수인어', type: 'spoken', difficulty: 3, regions: [], dialects: ['wolf', 'fox', 'bird', 'reptile'] },
  ancient: { name: '고대어', type: 'written', difficulty: 5, regions: [], dialects: [] },
  spirit: { name: '정령어', type: 'spoken', difficulty: 5, regions: [], dialects: [] },
};

// 예전 저장 파일의 언어 이름 → 지금 ID
const LEGACY_LANG_IDS = { avere: 'common_aver', dor: 'dorn' };

// 이름을 알기 전에 플레이어가 부르는 이름
const LANG_UNNAMED = { common_aver: '낯선 말', spirit: '소리가 아닌 말' };

// 아베르어 단어. text = 실제로 들리는 소리 (없으면 뜻에서 자동으로 만든다. 같은 뜻은 언제나 같은 소리다)
// frequency: 일상에서 자주 들리는 정도 (0~1)
const WORDS = [
  ['water', '물', ['물', '물을'], 'basic', 1, 0.9, '다라'],
  ['village', '마을', ['마을', '마을이야'], 'basic', 2, 0.7],
  ['stop', '멈춰', ['멈춰', '서'], 'basic', 1, 0.6],
  ['there', '거기', ['거기'], 'basic', 1, 0.7],
  ['here', '여기', ['여기가', '여기'], 'basic', 2, 0.7],
  ['where', '어디', ['어디'], 'basic', 3, 0.7],
  ['come', '오다', ['왔', '와', '오지'], 'basic', 3, 0.7],
  ['which', '어느', ['어느'], 'basic', 3, 0.5],
  ['you', '너', ['너'], 'basic', 2, 0.9],
  ['really', '정말', ['정말'], 'basic', 4, 0.5],
  ['nothing', '아무것도', ['아무것도'], 'basic', 4, 0.4],
  ['not_know', '모르다', ['몰라'], 'basic', 3, 0.6],
  ['how', '어떻게', ['어떻게'], 'basic', 4, 0.5],
  ['my', '내', ['내'], 'basic', 2, 0.8],
  ['name', '이름', ['이름을', '이름'], 'basic', 3, 0.5],
  ['what', '뭐', ['뭐'], 'basic', 2, 0.8],
  ['magic', '마법', ['마법'], 'special', 4, 0.2],
  ['first', '처음', ['처음'], 'basic', 3, 0.4],
  ['see', '보다', ['봐', '봤어'], 'basic', 3, 0.7],
  ['together', '같이', ['같이'], 'basic', 3, 0.5],
  ['go', '가다', ['가'], 'basic', 3, 0.8],
  ['understand', '알아듣다', ['알아듣는'], 'basic', 4, 0.3],
  ['is_it', '~인 거야', ['거야'], 'grammar', 4, 0.6],
  ['learn', '배우다', ['배웠'], 'basic', 4, 0.3],
  ['bitterleaf', '쓴잎', ['쓴잎'], 'nature', 3, 0.2],
  ['poison', '독', ['독'], 'basic', 2, 0.3],
  ['eat', '먹다', ['먹으면', '먹어'], 'basic', 4, 0.8],
  ['die', '죽다', ['죽어', '죽었어', '죽었대', '죽였대'], 'basic', 3, 0.4],
  ['dont', '~하지 마', ['마'], 'grammar', 3, 0.6],
  ['welcome', '어서', ['어서'], 'basic', 4, 0.4],
  ['who', '누구', ['누구'], 'basic', 2, 0.6],
  ['night', '밤', ['밤에는', '밤'], 'basic', 2, 0.7],
  ['forest', '숲', ['숲에', '숲에서', '숲의', '숲'], 'nature', 2, 0.6],
  ['enter', '들어가다', ['들어가지'], 'basic', 4, 0.5],
  ['woman', '여자', ['여자'], 'basic', 3, 0.5],
  ['cannot', '못', ['못'], 'grammar', 3, 0.6],
  ['stranger', '이방인', ['이방인이', '이방인'], 'social', 4, 0.2],
  ['help', '돕다', ['도왔대', '도와', '도와줘'], 'basic', 4, 0.5],
  ['person', '사람', ['사람을', '사람'], 'basic', 3, 0.8],
  ['danger', '위험', ['위험해', '위험한', '위험'], 'basic', 3, 0.5],
  ['hurt', '다치다', ['다쳤어', '다쳤'], 'basic', 3, 0.5],
  ['grandma', '할머니', ['할머니'], 'basic', 4, 0.4],  // 리아가 스승을 부르는 말 (스토리설계.md 단계 0~4 C)
  // 마을의 첫 저녁에 듣는 말 (스토리설계.md 단계 5 장면 문장 C) — 난이도·빈도는 [후보]
  ['meal', '밥', ['밥', '밥은'], 'basic', 2, 0.8],
  ['sleep', '자다', ['자', '잘', '자고'], 'basic', 3, 0.7],
  ['money', '돈', ['돈', '돈은'], 'basic', 2, 0.7],
  ['room', '방', ['방', '방은'], 'basic', 3, 0.5],
  ['work', '일', ['일', '일은'], 'basic', 2, 0.7],
  ['tomorrow', '내일', ['내일'], 'basic', 3, 0.6],
  ['today', '오늘', ['오늘은', '오늘'], 'basic', 3, 0.6],
  ['end', '끝', ['끝'], 'basic', 2, 0.5],
  ['ache', '아프다', ['아파', '아파요'], 'basic', 3, 0.5],
  ['okay', '괜찮다', ['괜찮아'], 'basic', 3, 0.7],
  ['thanks', '고맙다', ['고마워'], 'social', 3, 0.6],
  ['tree', '나무', ['나무'], 'nature', 1, 0.6],
  ['stone', '돌', ['돌'], 'nature', 1, 0.5],
  ['blood', '피', ['피'], 'basic', 2, 0.4],
  ['sky', '하늘', ['하늘'], 'nature', 2, 0.5],
  ['hand', '손', ['손'], 'basic', 1, 0.6],
  ['beast', '짐승', ['짐승이', '짐승'], 'nature', 3, 0.4],
].map(([id, meaning, forms, category, difficulty, frequency, text]) => ({
  id, lang: 'common_aver', meaning, forms, category, difficulty, frequency, text: text || null,
}));

// 가르쳐 줄 수 있는 것: 장소의 특징 → 가리키며 알려 주는 단어
const TEACHABLE = { water: 'water', trees: 'tree', rocks: 'stone', roots: 'tree', dense: 'tree' };
const TEACH_ALWAYS = ['sky', 'hand', 'blood']; // 어디서나 가리킬 수 있는 것

// 뜻이 붙은 대사 (언어 시스템 22절). tone = 말을 전혀 못 알아들을 때 플레이어가 짐작하는 분위기
const DIALOGUES = {
  call_name: { lang: 'common_aver', semantic: { intent: 'call', subject: '{target}' },
    text: '「[[{target}:0]]! [[{target}:0]]!」', tone: '누군가의 이름을 부르는 것 같다.' },
  challenge: { lang: 'common_aver', semantic: { intent: 'question', subject: 'identity', target: 'listener' },
    text: '「[[거기:15]] [[서:10]]! [[누구:20]]야!」', tone: '무언가를 따져 묻는 것 같다.' },
  ask_seen: { lang: 'common_aver', semantic: { intent: 'question', subject: '{target}' },
    text: '「[[{target}:0]]…… [[여자:25]]…… [[봤어:30]]?」', tone: '무언가를 묻는 것 같다. 누군가를 찾는 눈치다.' },
  warn_forest: { lang: 'common_aver', semantic: { intent: 'warning', subject: 'forest', danger: true },
    text: '「[[밤에는:25]] [[숲에:20]] [[들어가지:35]] [[마:30]].」', tone: '경고하는 것 같다.' },
  come_with: { lang: 'common_aver', semantic: { intent: 'request', subject: 'follow' },
    text: '「[[같이:30]]…… [[가:30]].」', tone: '따라오라는 것 같다.' },
  go_away: { lang: 'common_aver', semantic: { intent: 'threat', subject: 'leave' },
    text: '「[[가:30]]! [[오지:30]] [[마:30]]!」', tone: '쫓아내려는 것 같다.' },
  thanks: { lang: 'common_aver', semantic: { intent: 'thanks' },
    text: '「……[[고마워:35]].」', tone: '고맙다는 말 같다.' },
  grief: { lang: 'common_aver', semantic: { intent: 'grief', subject: '{target}' },
    text: '「[[{target}:0]]…… [[왜:30]]……」', tone: '울음 섞인 목소리다.' },
  are_you_ok: { lang: 'common_aver', semantic: { intent: 'question', subject: 'health', target: 'listener' },
    text: '「[[괜찮아:30]]? [[다쳤어:30]]?」', tone: '걱정하는 것 같다.' },
  // [임시] 첫마디 (경계하지 않는 사람 / 반가운 사람)
  greet: { lang: 'common_aver', semantic: { intent: 'greeting', target: 'listener' },
    text: '「[[어서:40]] [[와:40]]…… [[뭘:30]] [[찾아:35]]?」', tone: '말을 거는 것 같다. 경계하는 기색은 조금뿐이다.' },
  greet_warm: { lang: 'common_aver', semantic: { intent: 'greeting', target: 'listener', warm: true },
    text: '「[[왔어:30]]? [[괜찮아:30]]?」', tone: '반가워하는 것 같다.' },
  // 처음 만날 때의 사람별 첫마디 (스토리설계.md 단계 5 장면 문장 C)
  greet_innkeeper: { lang: 'common_aver', semantic: { intent: 'offer', subject: 'meal_room', target: 'listener' },
    text: '「[[어서:40]] [[와:40]]. [[밥:20]]? [[방:30]]?」', tone: '먹을 것과 잘 곳을 묻는 것 같다.' },
  greet_peer: { lang: 'common_aver', semantic: { intent: 'question', subject: 'origin', target: 'listener' },
    text: '「[[너:20]]…… [[숲에서:20]] [[왔어:30]]?」', tone: '숲 쪽을 가리키며 무언가 묻는다. 겁먹은 기색은 없다.' },
  greet_child: { lang: 'common_aver', semantic: { intent: 'question', subject: 'identity', target: 'listener' },
    text: '「[[누구:20]]야? [[누구:20]]?」', tone: '무언가를 묻는다. 같은 말을 두 번.' },
  greet_farmer: { lang: 'common_aver', semantic: { intent: 'question', subject: 'work', target: 'listener' },
    text: '「…… [[일:30]]?」', tone: '짧게 묻는다. 괭이를 들어 보인다.' },
  greet_merchant: { lang: 'common_aver', semantic: { intent: 'statement', subject: 'closed', target: 'listener' },
    text: '「[[내일:30]]. [[오늘은:30]] [[끝:20]].」', tone: '오늘은 끝났다는 것 같다.' },
  greet_herbalist: { lang: 'common_aver', semantic: { intent: 'statement', subject: 'stranger', target: 'listener' },
    text: '「[[숲의:20]]…… [[이방인:40]].」', tone: '묻는 것 같지 않다. 이미 알고 있다는 투다.' },
  greet_herbalist_unknown: { lang: 'common_aver', semantic: { intent: 'question', subject: 'identity', target: 'listener' },
    text: '「……[[누구:20]]?」', tone: '누구냐고 묻는 것 같다.' },
};

// 소문을 말로 옮길 때 (통합 명세 18절). 단계가 오를수록 전달되며 변형된 것이다.
// {actor} {target} {place} 는 말하는 사람이 아는 만큼 채워진다.
const RUMOR_SPEECH = {
  // 약재 부족 (시작마을.md 8절) [임시 문장]
  herb_scarce: [
    '「[[약초가:30]] [[없어:25]]. [[할머니:45]] [[상처에:40]] [[쓸:35]] [[것도:35]].」',
    '「[[약초가:30]] [[귀해졌대:40]].」',
    '「[[숲에서:20]] [[약초가:30]] [[다:25]] [[사라졌대:45]].」',
  ],
  herb_helped: [
    '「[[{actor}:0]]가 [[약초를:30]] [[구해:35]] [[왔어:30]].」',
    '「[[이방인이:40]] [[약초집을:35]] [[도왔대:40]].」',
    '「[[이방인이:40]] [[숲의:20]] [[약초를:30]] [[다:25]] [[캐 왔대:45]].」',
  ],
  helped: [
    '「[[{actor}:0]]가 [[물을:10]] [[줬어:30]]. [[상처도:35]] [[봐 줬고:35]].」',
    '「[[숲에서:20]] [[이방인이:40]] [[사람을:25]] [[도왔대:40]].」',
    '「[[숲에:20]] [[이상한:40]] [[힘을:45]] [[가진:45]] [[이방인이:40]] [[나타났대:45]].」',
  ],
  threatened: [
    '「[[숲에서:20]] [[이상한:40]] [[놈이:35]] [[날:25]] [[위협했어:45]].」',
    '「[[숲에:20]] [[위험한:30]] [[이방인이:40]] [[있대:30]].」',
    '「[[숲에서:20]] [[이방인이:40]] [[사람을:25]] [[죽이려:45]] [[했대:40]].」',
  ],
  attacked: [
    '「[[그놈이:35]] [[날:25]] [[공격했어:40]].」',
    '「[[숲에서:20]] [[이방인이:40]] [[{target}:0]]를 [[공격했대:40]].」',
    '「[[숲에:20]] [[사람을:25]] [[사냥하는:45]] [[이방인이:40]] [[있대:30]].」',
  ],
  stranger_seen: [
    '「[[숲에서:20]] [[말이:30]] [[안 통하는:45]] [[사람을:25]] [[만났어:35]].」',
    '「[[숲에:20]] [[이방인이:40]] [[있대:30]].」',
    '「[[숲에서:20]] [[이방인이:40]] [[나타났대:45]]. [[말도:30]] [[못:30]] [[한대:35]].」',
  ],
  died: [
    '「[[{target}:0]]가 [[죽었어:30]].」',
    '「[[{target}:0]]가 [[숲에서:20]] [[죽었대:30]].」',
    '「[[숲의:20]] [[괴물이:40]] [[{target}:0]]를 [[죽였대:35]].」',
  ],
  missing: [
    '「[[{target}:0]]가 [[돌아오지:35]] [[않았어:35]].」',
    '「[[{target}:0]]가 [[없어졌대:40]].」',
    '「[[숲이:20]] [[{target}:0]]를 [[삼켰대:45]].」',
  ],
  beast_seen: [
    '「[[숲에:20]] [[짐승이:30]] [[나왔어:35]].」',
    '「[[숲에:20]] [[짐승이:30]] [[나왔대:35]].」',
    '「[[숲에:20]] [[눈이:25]] [[셋인:40]] [[괴물이:40]] [[있대:30]].」',
  ],
  war_tension: [
    '「[[동쪽:30]] [[국경에:50]] [[군대가:45]] [[모였어:45]].」',
    '「[[동쪽:30]] [[제국이:50]] [[군대를:45]] [[모은대:45]].」',
    '「[[곧:30]] [[전쟁이:40]] [[난대:35]].」',
  ],
  trade_boom: [
    '「[[남쪽:30]] [[항구에:45]] [[배가:30]] [[많이:25]] [[들어와:40]].」',
    '「[[남쪽:30]] [[물건이:35]] [[싸졌대:45]].」',
    '「[[남쪽에서:30]] [[다들:35]] [[부자가:40]] [[됐대:35]].」',
  ],
  anomaly: [
    '「[[북쪽:30]] [[산에서:30]] [[이상한:40]] [[빛을:30]] [[봤어:30]].」',
    '「[[북쪽에서:30]] [[이상한:40]] [[빛이:30]] [[보였대:40]].」',
    '「[[북쪽에서:30]] [[옛날:40]] [[유적이:55]] [[깨어났대:50]].」',
  ],
  theft: [
    '「[[누가:30]] [[빵을:25]] [[훔쳐:40]] [[갔어:30]].」',
    '「[[가게에:35]] [[도둑이:40]] [[들었대:40]].」',
    '「[[마을에:20]] [[도둑이:40]] [[숨어:35]] [[있대:30]].」',
  ],
  beasts_rising: [
    '「[[요즘:30]] [[길에:25]] [[짐승이:30]] [[많아:30]].」',
    '「[[요즘:30]] [[짐승이:30]] [[많아졌대:40]].」',
    '「[[마물이:50]] [[몰려온대:45]].」',
  ],
  // [임시] 생활 시스템에서 생기는 소문
  rescued: [
    '「[[쓰러진:40]] [[이방인을:40]] [[내가:25]] [[돌봤어:40]].」',
    '「[[이방인이:40]] [[쓰러져:40]] [[있었대:35]].」',
    '「[[이방인이:40]] [[죽다:35]] [[살아났대:45]].」',
  ],
  worked: [
    '「[[그:20]] [[이방인:40]] [[일을:25]] [[잘해:30]].」',
    '「[[이방인이:40]] [[일을:25]] [[거든대:40]].」',
    '「[[이방인이:40]] [[혼자서:35]] [[밭을:30]] [[다:20]] [[갈았대:45]].」',
  ],
};

if (typeof module !== 'undefined') module.exports = { LANGUAGES, LEGACY_LANG_IDS, LANG_UNNAMED, WORDS, TEACHABLE, TEACH_ALWAYS, DIALOGUES, RUMOR_SPEECH };
