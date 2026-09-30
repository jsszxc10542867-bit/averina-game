// 숲의 지형, 행동, 시간에 따른 사건. 화면과 무관한 순수 데이터/로직이다.
// 각 행동의 Run(g)은 출력할 줄 목록을 반환한다.
using System;
using System.Collections.Generic;
using System.Linq;

namespace Avernia
{
    // 행동과 장소 묘사가 받는 문맥
    public class Ctx
    {
        public RunState R;
        public PersistentState P;
        public Period Period => Clock.PeriodOf(R.t);

        public Ctx(RunState r, PersistentState p) { R = r; P = p; }

        // 처음 한 번만 true
        public bool First(string key)
        {
            if (R.Seen(key)) return false;
            R.Mark(key);
            return true;
        }

        // 아이템을 n개 얻는다. 이 회차에 얻을 수 있는 양(cap)을 넘지 않는다.
        public bool Give(string item, int cap, int n = 1)
        {
            int had = R.counts.Get(item);
            if (had >= cap) return false;
            int add = Math.Min(n, cap - had);
            R.counts.Set(item, had + add);
            R.inv.Add(item, add);
            return true;
        }

        public void Know(string id) => P.Know(id);
        public void Use(Stat s) => Body.Use(R, s);
    }

    public class Block
    {
        public int Min;
        public List<Line> Lines;
    }

    public class ExitDef
    {
        public string To, Label;
        public int Min;
        public string[] Kw = new string[0];
        public string[] Text = new string[0];
        public string HintKnow, HintText; // 이 지식이 있으면 힌트를 보여 준다
        public string FixedHint;          // 항상 보이는 힌트
        public Stat? Use;
        public Func<Ctx, bool> Show;
        public Func<Ctx, Block> Block;
    }

    public class ActionDef
    {
        public string Id, Label;
        public string[] Kw = new string[0];
        public int Min;
        public Func<Ctx, List<Line>> Run;
    }

    public class LocationDef
    {
        public string Name;
        public Func<Ctx, List<Line>> Desc;
        public List<ExitDef> Exits = new List<ExitDef>();
        public List<ActionDef> Actions = new List<ActionDef>();
    }

    public static class World
    {
        public static List<Line> L(params Line[] xs) => new List<Line>(xs);

        public static readonly Dictionary<string, string> Items = new Dictionary<string, string>
        {
            { "branch", "나뭇가지" },
            { "stone", "날카로운 돌" },
            { "berry", "붉은 열매 (먹어도 되는지 모른다)" },
            { "herb", "쓴 냄새가 나는 풀" },
        };

        public static string Sky(Period p)
        {
            switch (p)
            {
                case Period.Morning: return "이른 빛이 가지 사이로 가늘게 내려온다.";
                case Period.Day: return "머리 위에서 햇빛이 쏟아지지만, 잎이 두꺼워 바닥은 반쯤 그늘이다.";
                case Period.Afternoon: return "빛이 비스듬하다. 그림자가 길어지고 있다.";
                case Period.Evening: return "숲이 붉게 물들었다. 그림자들이 서로 이어져 하나가 되어 간다.";
                default: return "하늘은 검고, 나무의 윤곽만 겨우 보인다.";
            }
        }

        // 알아낸 것 (되감기 뒤에도 남는다). 수첩에 이 문장으로, 이 순서로 기록된다.
        public static readonly KeyValuePair<string, string>[] Know =
        {
            K("no_trail", "내가 눈을 뜬 자리에는, 이어지는 발자국이 없었다."),
            K("fresh_prints", "개울가 진흙에 앞이 갈라진 발자국이 있었다."),
            K("smoke", "비탈 위에서 보면, 먼 곳에 연기가 오른다."),
            K("broken_branch", "숲 안쪽에 누군가 최근 지나간 흔적이 있었다."),
            K("beast_seen", "풀숲에 이상한 짐승이 있다. 눈이 셋이다."),
            K("beast_water", "그 짐승은 물가로는 오지 않는다."),
            K("light_watches", "해 질 녘 숲에 떠 있는 빛은, 나를 보고 있었다."),
            K("light_touched", "그 빛은 따뜻했다. 그리고 무언가를 속삭였다."),
            K("night_cry", "밤이 되면 멀리서 무언가가 운다."),
            K("name_call", "밤에, 내 이름을 부르는 목소리가 있다."),
            K("night_path", "밤이 되면 낮에 없던 길이 생긴다."),
            K("voice_kills", "그 목소리를 따라가면, 죽는다."),
            K("berry_poison", "붉은 열매는 먹으면 안 된다."),
            K("herb_heals", "쓴 냄새가 나는 풀은 피를 멎게 한다."),
            K("girl_hollow", "둘째 날 아침, 숲 속 움푹한 곳에 다친 여자가 있다."),
            K("girl_wound", "그녀의 팔 상처는 세 갈래 발톱 자국이었다."),
            K("lang_barrier", "그녀는 내 말을 모른다. 내가 그녀의 말을 모르는 것처럼."),
            K("girl_name", "그녀의 이름은 리아다."),
            K("magic_seen", "그녀가 손을 대자, 손끝이 빛나며 상처가 아물었다."),
            K("village", "그녀는 연기 쪽을 가리키며 \"마을\"이라고 했다."),
        };
        static KeyValuePair<string, string> K(string id, string text) => new KeyValuePair<string, string>(id, text);

        public static readonly Dictionary<string, LocationDef> Locs = BuildLocations();

        static Dictionary<string, LocationDef> BuildLocations()
        {
            var locs = new Dictionary<string, LocationDef>();

            locs["clearing"] = new LocationDef
            {
                Name = "공터",
                Desc = g => L("이끼 낀 바위와 쓰러진 고목 사이의 작은 공터다.", "내가 처음 눈을 뜬 곳이다.", Sky(g.Period)),
                Exits =
                {
                    new ExitDef { To = "stream", Label = "물소리가 나는 쪽으로 간다", Min = 15, Kw = new[] { "물소리", "계곡", "개울", "물가" },
                        Text = new[] { "물소리를 따라 풀숲을 헤치고 나간다." }, HintKnow = "fresh_prints", HintText = "발자국이 있던 곳" },
                    new ExitDef { To = "hill", Label = "비탈을 올라간다", Min = 30, Kw = new[] { "비탈", "언덕", "높은", "올라" },
                        Text = new[] { "비탈이 가파르다. 숨이 차오르고 종아리가 당긴다." }, HintKnow = "smoke", HintText = "연기를 봤던 곳", Use = Stat.Vit },
                    new ExitDef { To = "deep", Label = "숲 안쪽으로 들어간다", Min = 15, Kw = new[] { "안쪽", "깊", "숲으로" },
                        Text = new[] { "나무 사이로 들어선다." },
                        Block = g => g.Period == Period.Night
                            ? new Block { Min = 5, Lines = L("안쪽은 어둠이 너무 짙다.", "몇 걸음 가지 못하고 돌아선다.") } : null },
                },
                Actions =
                {
                    new ActionDef { Id = "look", Label = "주변을 조사한다", Kw = new[] { "조사", "주변", "살펴" }, Min = 10, Run = g =>
                    {
                        g.Use(Stat.Int);
                        if (g.First("look_clearing"))
                        {
                            g.Know("no_trail");
                            return L("내가 누워 있던 자리를 살펴본다.",
                                "눌린 풀이 사람 하나 크기만큼 남아 있다.",
                                "그런데…… 이상하다. 이곳으로 이어지는 발자국이 없다.",
                                "어딘가에서 걸어온 것이 아니라, 그냥 여기서 시작된 것 같다.");
                        }
                        return L("다시 둘러보지만 새로운 것은 없다.");
                    } },
                    new ActionDef { Id = "tree", Label = "고목을 살펴본다", Kw = new[] { "나무", "고목", "가지" }, Min = 10, Run = g =>
                    {
                        g.Use(Stat.Str);
                        int n = g.R.counts.Get("branch");
                        if (g.First("tree"))
                        {
                            g.Give("branch", 5);
                            return L("쓰러진 고목의 껍질을 만져 본다. 처음 보는 무늬다. 결이 나선으로 감겨 있다.",
                                "마른 가지가 몇 개 부러져 나와 있다. 하나를 꺾어 든다.",
                                "……나뭇가지를 얻었다.");
                        }
                        if (n >= 5) return L("쓸 만한 가지는 이제 충분하다.");
                        g.Give("branch", 5);
                        return L("마른 가지를 하나 더 꺾는다.");
                    } },
                    new ActionDef { Id = "rock", Label = "바위를 살펴본다", Kw = new[] { "바위", "돌" }, Min = 10, Run = g =>
                    {
                        g.Use(Stat.Str);
                        int n = g.R.counts.Get("stone");
                        if (g.First("rock"))
                        {
                            g.Give("stone", 3);
                            return L("이끼가 두껍다. 한쪽 면이 쪼개져서 날이 선 돌 조각이 떨어져 있다.",
                                "손에 쥐어 본다. 묵직하고 모서리가 날카롭다.",
                                "……날카로운 돌을 얻었다.");
                        }
                        if (n >= 3) return L("쓸 만한 돌은 이미 챙겼다.");
                        g.Give("stone", 3);
                        return L("조금 작은 돌 조각을 하나 더 줍는다.");
                    } },
                },
            };

            locs["stream"] = new LocationDef
            {
                Name = "계곡",
                Desc = g => L("돌 사이로 얕은 개울이 흐른다. 물은 맑고 차갑다.", "바닥의 자갈이 물빛 속에서 반짝인다.", Sky(g.Period)),
                Exits =
                {
                    new ExitDef { To = "clearing", Label = "공터로 돌아간다", Min = 15, Kw = new[] { "공터", "돌아" }, Text = new[] { "풀숲을 헤치고 돌아간다." } },
                    new ExitDef { To = "downstream", Label = "계곡을 따라 내려간다", Min = 20, Kw = new[] { "따라", "내려", "아래" }, Text = new[] { "물길을 따라 걷는다." } },
                },
                Actions =
                {
                    new ActionDef { Id = "drink", Label = "물을 마신다", Kw = new[] { "물", "마시" }, Min = 10, Run = g =>
                    {
                        g.R.thirst = 0;
                        if (g.First("drink"))
                            return L("두 손으로 물을 떠 입에 댄다. 이가 시릴 만큼 차갑다.", "삼키자 목이 열리는 것 같다.", "몸이 얼마나 말라 있었는지, 그제야 안다.");
                        return L("다시 물을 마신다. 조금 더 괜찮아진다.");
                    } },
                    new ActionDef { Id = "prints", Label = "진흙의 자국을 살펴본다", Kw = new[] { "발자국", "자국", "진흙", "흔적" }, Min = 10, Run = g =>
                    {
                        g.Know("fresh_prints");
                        g.Use(Stat.Int);
                        if (g.First("prints"))
                            return L("개울가 진흙에 무언가 찍혀 있다.",
                                "사람의 발자국 같기도 하다. 그런데 앞쪽이 이상하다. 눌린 자국이 둘로 갈라져 있다.",
                                "짐승의 것이 겹친 걸까. 아니면……",
                                "진흙은 아직 축축하다. 오래된 흔적은 아니다.");
                        return L("자국은 그대로다. 어디로 이어지는지는 알 수 없다. 풀숲에서 끊겨 있다.");
                    } },
                },
            };

            locs["downstream"] = new LocationDef
            {
                Name = "계곡 아래",
                Desc = g => L("계곡이 넓어지는 곳이다. 물가에 덤불이 무성하다.", "덤불에 붉은 열매가 달려 있고, 바닥에는 잎이 넓은 풀이 깔려 있다.", Sky(g.Period)),
                Exits =
                {
                    new ExitDef { To = "stream", Label = "계곡을 따라 올라간다", Min = 20, Kw = new[] { "올라", "위", "따라" }, Text = new[] { "물길을 거슬러 걷는다." } },
                },
                Actions =
                {
                    new ActionDef { Id = "berry_look", Label = "붉은 열매를 살펴본다", Kw = new[] { "열매", "살펴" }, Min = 10, Run = g =>
                    {
                        if (g.First("berry_look"))
                            return L("붉고 작은 열매다. 껍질이 매끈하고 달콤한 냄새가 난다.",
                                "새 한 마리가 가지에 앉아 쪼아 먹고 있다……가, 내가 다가가자 날아가 버린다.",
                                "새가 먹는다고 해서 사람도 먹어도 되는 걸까. 알 수 없다.");
                        return L("열매는 여전히 붉고 달콤한 냄새가 난다. 먹어도 되는지는 알 수 없다.");
                    } },
                    new ActionDef { Id = "berry_pick", Label = "열매를 딴다", Kw = new[] { "열매", "딴다", "따" }, Min = 10, Run = g =>
                    {
                        if (g.R.counts.Get("berry") >= 6) return L("더 딸 필요는 없을 것 같다.");
                        g.Give("berry", 6, 3);
                        return L("손바닥 가득 열매를 딴다. 먹지는 않았다.");
                    } },
                    new ActionDef { Id = "herb_look", Label = "잎이 넓은 풀을 살펴본다", Kw = new[] { "풀", "잎", "약초" }, Min = 10, Run = g =>
                    {
                        if (g.First("herb_look"))
                            return L("잎맥이 붉다. 코를 가까이 대자 쓴 냄새가 코를 찌른다.", "약이 될 것 같기도 하고, 독 같기도 하다.");
                        return L("쓴 냄새가 코끝에 남는다.");
                    } },
                    new ActionDef { Id = "herb_pick", Label = "풀을 뜯는다", Kw = new[] { "뜯", "풀" }, Min = 10, Run = g =>
                    {
                        if (g.R.counts.Get("herb") >= 4) return L("이 정도면 충분하다.");
                        g.Give("herb", 4, 2);
                        return L("풀을 몇 장 뜯어 챙긴다. 손에서 쓴 냄새가 난다.");
                    } },
                },
            };

            locs["hill"] = new LocationDef
            {
                Name = "비탈 위",
                Desc = g => L("비탈 꼭대기다. 평평한 바위 위에서 숲이 내려다보인다.", Sky(g.Period)),
                Exits =
                {
                    new ExitDef { To = "clearing", Label = "공터로 내려간다", Min = 20, Kw = new[] { "내려", "공터" }, Text = new[] { "조심스럽게 비탈을 내려간다." } },
                    new ExitDef { To = "edge", Label = "연기가 오르는 쪽으로 간다", Min = 240, Kw = new[] { "연기" }, Use = Stat.Vit,
                        Show = g => g.P.Knows("smoke"),
                        Text = new[] { "연기가 오르던 방향을 눈에 새기고 비탈을 내려간다.", "해를 등지고, 몇 번이고 방향을 확인하며 걷는다." },
                        Block = g => g.Period == Period.Evening || g.Period == Period.Night || Clock.ClockOf(g.R.t) >= 15 * 60
                            ? new Block { Min = 5, Lines = L("지금 출발하면 도착하기 전에 해가 진다.", "밤의 숲을 걸을 자신은 없다.") } : null },
                },
                Actions =
                {
                    new ActionDef { Id = "overlook", Label = "주변을 둘러본다", Kw = new[] { "둘러", "보", "내려다" }, Min = 10, Run = g =>
                    {
                        if (g.Period == Period.Night) return L("어둠뿐이다. 아무것도 보이지 않는다.");
                        if (g.Period == Period.Evening)
                            return g.P.Knows("smoke")
                                ? L("연기가 있던 쪽을 본다. 이미 어두워져서 보이지 않는다.")
                                : L("숲은 끝이 보이지 않는다. 해가 기울어 멀리는 흐릿하다.");
                        if (g.First("overlook"))
                        {
                            g.Know("smoke");
                            return L("사방이 숲이다. 끝이 보이지 않는다. 사람의 흔적은 어디에도 없다.",
                                "……그런데 아주 먼 곳에서, 가느다란 연기 한 줄기가 오르고 있다.",
                                "걸어서 몇 시간은 걸릴 거리다.");
                        }
                        return L("연기는 아직 그 자리에서 오르고 있다. 아주 멀다.");
                    } },
                },
            };

            locs["deep"] = new LocationDef
            {
                Name = "숲 안쪽",
                Desc = g => L("숲이 짙어진다. 나무가 빽빽하고 빛이 줄어든다.", "공기가 눅눅하고, 발밑이 푹신하다.",
                    g.Period == Period.Evening ? "이곳은 벌써 밤에 가깝다." : Sky(g.Period)),
                Exits =
                {
                    new ExitDef { To = "clearing", Label = "공터로 돌아간다", Min = 15, Kw = new[] { "공터", "돌아", "나간" }, Text = new[] { "왔던 길을 되짚는다." } },
                },
                Actions =
                {
                    new ActionDef { Id = "branch", Label = "꺾인 가지를 살펴본다", Kw = new[] { "가지", "꺾", "부러" }, Min = 10, Run = g =>
                    {
                        g.Know("broken_branch");
                        g.Use(Stat.Int);
                        if (g.First("branch_look"))
                            return L("낮은 가지들이 꺾여 있다. 사람 허리쯤의 높이다.", "꺾인 단면이 아직 희다. 마르지 않았다.", "누군가, 혹은 무언가가 최근 이 길로 지나갔다.");
                        return L("단면은 여전히 희다. 그리 오래된 흔적이 아니다.");
                    } },
                    new ActionDef { Id = "further", Label = "더 깊이 들어간다", Kw = new[] { "더", "깊이" }, Min = 10, Run = g =>
                    {
                        g.R.counts.Add("further");
                        g.Use(Stat.Wil);
                        return L("한 걸음 더 내딛는다.", "그러자 어디선가 소리가 멎는다. 새도, 벌레도.", "발이 더 나가지 않는다. 지금은 아니다. 그런 느낌이 든다.");
                    } },
                },
            };

            locs["hollow"] = new LocationDef
            {
                Name = "움푹한 곳",
                Desc = g => L("나무뿌리가 엉켜 움푹 꺼진 곳이다. 이끼가 짓눌려 있다.", Sky(g.Period)),
                Exits =
                {
                    new ExitDef { To = "stream", Label = "계곡으로 간다", Min = 15, Kw = new[] { "계곡", "물" }, Text = new[] { "물소리가 나는 쪽으로 걷는다." } },
                    new ExitDef { To = "clearing", Label = "공터로 간다", Min = 20, Kw = new[] { "공터" }, Text = new[] { "눈에 익은 쪽으로 걷는다." } },
                },
                Actions =
                {
                    new ActionDef { Id = "hollow_look", Label = "주변을 조사한다", Kw = new[] { "조사", "주변", "살펴", "피" }, Min = 10, Run = g =>
                    {
                        g.Use(Stat.Int);
                        if (g.R.HasGirl && !g.R.girl.alive) return L("그녀가 기대어 있던 나무 아래에 검게 굳은 피가 고여 있다.", "……더 보고 싶지 않다.");
                        return L("나무 밑동에 검붉은 얼룩이 번져 있다. 피다. 아직 마르지 않았다.",
                            "짓눌린 이끼 위로, 무언가를 끌고 간 자국이 숲 바깥쪽으로 이어진다.",
                            "누군가 여기 있다가, 떠났다.");
                    } },
                },
            };

            // 숲을 벗어나는 곳 (지금 만든 부분의 끝)
            locs["edge"] = new LocationDef { Name = "숲의 가장자리", Desc = g => new List<Line>() };
            return locs;
        }

        // 어느 장소에서나 할 수 있는 행동의 키워드
        public static readonly string[] ListenKw = { "소리", "듣", "귀" };
        public static readonly string[] BagKw = { "소지품", "가방", "주머니" };
        public static readonly string[] RestKw = { "쉰", "쉬", "앉", "기다", "눕", "잔다" };

        public static List<Line> ListenLines(Ctx g)
        {
            var p = g.Period;
            if (g.R.loc == "deep") return L("숲이 숨을 죽인 것 같다.", "내 숨소리가 가장 크다.");
            if (p == Period.Night)
            {
                g.Use(Stat.Sen);
                return L("귀를 기울인다.", "나무 사이를 지나는 바람. 그 너머로 무언가 발밑을 스치는 소리.", "가만히 있으면, 숲이 나를 듣고 있는 것 같다.");
            }
            if (p == Period.Evening) return L("새 소리가 줄어 있다.", "그 자리를 벌레 소리가 채우고 있다.");
            return L("귀를 기울인다. 물소리. 바람에 스치는 잎. 새 소리.", "그 사이로 무언가 작게 움직이는 소리가 지나간다.", "그러다 멎는다.");
        }

        public static List<Line> BagLines(RunState r)
        {
            if (!r.inv.Any) return L("주머니를 뒤져 본다. 비어 있다.", "아무것도 없다.");
            var lines = L("가진 것을 확인한다.");
            foreach (var e in r.inv.items)
                lines.Add(("· " + (Items.TryGetValue(e.id, out var nm) ? nm : e.id) + " " + (e.n > 1 ? "× " + e.n : "")).Trim());
            return lines;
        }

        struct DayEvent { public int At, D; public string Id; }

        // 시간을 흘리고, 그 사이에 넘은 시각(저녁, 밤, 새벽)의 사건 줄을 반환한다.
        // 첫날 밤 23시의 목소리는 무엇을 하든 그 시각에 끼어든다 (시간이 거기서 멈추고 장면이 열린다).
        public static List<Line> Advance(RunState r, PersistentState p, int min)
        {
            int from = r.t, to = from + min;
            r.t = to;
            var lines = new List<Line>();
            var events = new List<DayEvent>();
            for (int d = Math.Max(0, Clock.DayOf(from) - 2); d <= Clock.DayOf(to) - 1; d++)
            {
                int b = d * Clock.MinDay;
                events.Add(new DayEvent { At = b + 18 * 60, Id = "evening", D = d });
                events.Add(new DayEvent { At = b + 20 * 60, Id = "night", D = d });
                events.Add(new DayEvent { At = b + 23 * 60, Id = "call", D = d });
                events.Add(new DayEvent { At = b + Clock.MinDay + 6 * 60, Id = "dawn", D = d });
            }
            events = events.OrderBy(e => e.At).ToList();
            foreach (var e in events)
            {
                if (!(from < e.At && to >= e.At)) continue;
                if (e.Id == "evening")
                {
                    if (r.Seen("evening")) lines.Add("해가 기울고 있다.");
                    else lines.AddRange(L("해가 지기 시작한다.", "숲의 색이 달라진다.", "새들의 소리가 줄어든다."));
                    r.Mark("evening");
                }
                else if (e.Id == "night")
                {
                    if (!r.Seen("night"))
                    {
                        lines.AddRange(L("완전히 어두워졌다.", "그리고……", "낮에는 듣지 못했던 소리가 들리기 시작한다.",
                            "멀리서 무언가가 운다. 길고 낮은 소리다.", "짐승의 것 같기도, 사람의 것 같기도 하다."));
                        p.Know("night_cry");
                    }
                    else lines.Add("다시 밤이 왔다.");
                    r.Mark("night");
                }
                else if (e.Id == "call")
                {
                    if (e.D == 0 && !r.Seen("call"))
                    {
                        r.Mark("call");
                        r.t = e.At; // 여기서 시간이 멈춘다
                        r.pending.Add("call");
                        break;
                    }
                }
                else if (e.Id == "dawn")
                {
                    if (!r.Seen("dawn"))
                    {
                        lines.AddRange(L("새벽이 밝아 온다.", "숲은 다시 조용해졌다.", "어젯밤의 일이 꿈이었던 것처럼 느껴진다.", "하지만……", "손에 묻은 흙은 그대로다."));
                        r.pending.Add("status");
                        // 그녀는 이 무렵 숲 속 움푹한 곳에 몸을 숨긴다. 플레이어와 상관없이 그녀의 시간이 흐르기 시작한다.
                        if (!r.HasGirl) r.girl = Npc.NewGirl(e.At + 60);
                    }
                    else lines.Add("동이 튼다.");
                    r.Mark("dawn");
                }
            }
            return lines;
        }

        // 밤을 넘기는 데 걸리는 분 (다음 아침 6시까지)
        public static int MinutesUntilDawn(RunState r)
        {
            int c = Clock.ClockOf(r.t);
            int d = Clock.DayOf(r.t) - 1;
            int target = c >= 20 * 60 ? (d + 1) * Clock.MinDay + 6 * 60 : d * Clock.MinDay + 6 * 60;
            return Math.Max(1, target - r.t);
        }
    }
}
