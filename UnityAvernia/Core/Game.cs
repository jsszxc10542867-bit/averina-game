// 게임 흐름: 시작 연출 → 기억 → 이름 → 숲 자유 탐색 → (죽음과 되감기) → 1장 끝.
// 화면은 IGameView, 저장은 ISaveStore를 통해서만 다룬다.
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using static Avernia.World;

namespace Avernia
{
    public partial class Game
    {
        public PersistentState P = new PersistentState();
        public RunState R = new RunState();
        public bool DevSkipIntro; // 개발용: 시작 연출과 이름 입력을 건너뛴다

        readonly IGameView view;
        readonly ISaveStore store;
        public static Random Rng = new Random();

        public Game(IGameView view, ISaveStore store)
        {
            this.view = view;
            this.store = store;
        }

        public static bool Chance(double p) => Rng.NextDouble() < Math.Max(0, Math.Min(1, p));
        public static T Pick<T>(IList<T> a) => a[Rng.Next(a.Count)];
        static Line Kn(string t) => new Line(t, "know"); // 지식으로 알아챈 줄

        // ---------- 화면 도구 ----------
        List<Line> Format(IList<Line> lines, string cls)
        {
            var vars = new Dictionary<string, string> { { "이름", P.name } };
            var outp = new List<Line>(lines.Count);
            foreach (var l in lines) outp.Add(new Line(TextTools.Fmt(l.T, vars), l.Cls ?? cls));
            return outp;
        }

        public Task Say(IList<Line> lines, int pace = 520, string cls = null) => view.Say(Format(lines, cls), pace);

        public async Task Page(IList<Line> lines, int pace = 520)
        {
            view.Clear();
            SetHud();
            await Say(lines, pace);
        }

        public Task More() => view.More();

        public async Task<int> Choose(IList<Option> opts) => (await view.Choose(opts, false)).Index;

        static List<Option> Opts(params string[] labels) => labels.Select(l => new Option(l)).ToList();

        // 그녀의 말. 이해도와 배운 단어에 따라 가려진다.
        public string Speak(string str) => TextTools.Mask(str, P.language.avere, null, P.words);

        // 새 단어의 뜻을 알아내면 이해도가 오른다. 이미 알던 단어면 false.
        public bool Learn(string word)
        {
            if (P.HasWord(word)) return false;
            P.words.Add(word);
            P.language.avere = Math.Min(100, P.language.avere + 5);
            return true;
        }

        public void Know(string id) => P.Know(id);
        public void Use(Stat s) => Body.Use(R, s);
        Ctx NewCtx() => new Ctx(R, P);

        void SetHud()
        {
            int d = Clock.DayOf(R.t);
            string loc = Locs.TryGetValue(R.loc, out var l) ? l.Name : "";
            view.SetHud((d > 1 ? Clock.DayKo(d) + " " : "") + Clock.PeriodKo(Clock.PeriodOf(R.t)) + " · " + loc);
        }

        // ---------- 시작 연출 ----------
        async Task Blackout(List<Line> lines, int pace)
        {
            view.SetBlack(true);
            view.SetHud("");
            view.Clear();
            await Say(lines, pace, "center");
            await More();
            view.Clear();
            await Say(L("눈을 뜬다."), 520, "center");
            await view.Wait(1400);
            view.SetBlack(false);
            view.Clear();
            await view.Wait(1600);
        }

        async Task Intro()
        {
            if (DevSkipIntro) { P.name = "민준"; return; }
            await Blackout(L("어둡다.", "", "춥다.", "", "몸이 젖어 있다.", "", "흙 냄새가 난다.", "", "그리고 어디선가 물 흐르는 소리가 들린다."), 1100);
            await Say(L("나무가 있다. 아주 높다.", "가지 사이로 조각난 하늘이 보인다.", "풀 사이로 작은 계곡의 물빛이 어른거린다.",
                "이끼 낀 바위. 이름을 모르는 식물들.", "", "……"), 800);
            await More();
            view.Clear();
            await MemoryScene();
        }

        async Task MemoryScene()
        {
            await Say(L("……여기가 어디지?", "나는……", "누구지?"), 900);
            var used = new HashSet<string>();
            var menu = new List<Option>
            {
                new Option("내 이름을 떠올린다.", "name"),
                new Option("마지막으로 기억나는 순간을 떠올린다.", "last"),
                new Option("가족을 떠올린다.", "family"),
                new Option("내가 있던 장소를 떠올린다.", "place"),
                new Option("아무것도 생각하지 않는다.", "none"),
            };
            var fragments = new Dictionary<string, List<Line>>
            {
                { "last", L("마지막으로 기억나는 순간을 더듬는다.", "……문이 닫히는 소리. 어딘가로 가고 있었다. 누군가에게 무언가를 말하려 했다.", "거기서, 뚝 끊겨 있다.") },
                { "family", L("가족을 떠올린다.", "……누군가의 얼굴이 스친다. 얼굴만. 이름은 나오지 않는다.", "그런데 이상하게, 가슴이 먹먹하다.") },
                { "place", L("내가 있던 곳을 떠올린다.", "……익숙한 방. 창으로 들어오는 아침빛. 멀리서 들리던 소음.", "하지만 어디였는지는 떠오르지 않는다.") },
            };
            while (true)
            {
                var opts = menu.Where(m => !used.Contains(m.Id)).ToList();
                string id = opts[await Choose(opts)].Id;
                view.Clear();
                if (id == "name" || id == "none")
                {
                    if (id == "none") await Say(L("눈을 감고 머리를 비운다.", "바람 소리. 물소리. 내 숨소리.", "……조금 진정된다.", "그래도, 이름은 떠올려야 한다."));
                    else await Say(L("이름을 떠올려 본다.", "……그래."));
                    await Say(L("내 이름은……"), 600);
                    P.name = await view.AskName();
                    P.memory.name = true;
                    view.Clear();
                    await Say(L("……{이름}.", "적어도 이것 하나는 기억난다.", "내 이름.", "", "주변에는 아무도 없다.", "혼자다.", "", "일단, 움직여야 한다."), 800);
                    await More();
                    return;
                }
                used.Add(id);
                if (id == "last") P.memory.lastMoment = "fragment";
                if (id == "family") P.memory.family = "fragment";
                if (id == "place") P.memory.previousLocation = "fragment";
                await Say(fragments[id], 750);
                await Say(L("", "……여기까지다. 더는 떠오르지 않는다."), 700);
            }
        }

        // 죽은 뒤 다시 눈을 뜨는 장면. 처음 이세계에 왔던 시점으로 돌아온다.
        async Task RewindIntro()
        {
            bool first = P.rewinds == 1;
            await Blackout(first
                ? L("차가운 것이 뺨에 닿는다.", "젖은 흙이다.", "", "……이 감촉을 안다.")
                : L("젖은 흙.", "", "……또."), 1100);
            await Say(first ? L("같은 나무. 같은 하늘. 같은 물소리.", "", "이번에는, 안다.") : L("같은 숲이다."), 800);
            await More();
            view.Clear();
        }

        // ---------- 숲 탐색 ----------
        // 시간이 흐른다: 하루의 사건, 몸의 변화, 그녀의 행동이 함께 진행된다.
        public List<Line> PassTime(int min, bool rest = false)
        {
            if (min <= 0) return TakeNotes();
            int before = R.t;
            var ev = Advance(R, P, min);
            int spent = R.t - before; // 목소리가 끼어들면 덜 흐른다
            if (Clock.DayOf(R.t) >= 2 && Clock.ClockOf(R.t) >= 6 * 60) R.day2Acts++;
            var body = Body.Tick(R, spent, rest);
            if (R.HasGirl)
            {
                var o = Npc.Tick(R, spent, R.loc == "hollow");
                if (o.Magic) R.pending.Add("magic");
            }
            var outp = new List<Line>();
            if (ev.Count > 0) { outp.Add(""); outp.AddRange(ev); }
            if (body.Count > 0) { outp.Add(""); outp.AddRange(body); }
            outp.AddRange(TakeNotes());
            return outp;
        }

        List<Line> TakeNotes()
        {
            if (R.Notes.Count == 0) return new List<Line>();
            var n = new List<Line> { "" };
            n.AddRange(R.Notes);
            R.Notes.Clear();
            return n;
        }

        static List<Line> Cat(params IEnumerable<Line>[] parts)
        {
            var l = new List<Line>();
            foreach (var p in parts) l.AddRange(p);
            return l;
        }

        List<Line> DoAction(ActionDef a) => Cat(a.Run(NewCtx()), PassTime(a.Min));

        List<Line> DoMove(ExitDef e)
        {
            var g = NewCtx();
            var blocked = e.Block?.Invoke(g);
            if (blocked != null) return Cat(blocked.Lines, PassTime(blocked.Min));
            var lines = e.Text.Select(t => (Line)t).ToList();
            // 밤에 돌아다니면 어둠 속의 무언가와 마주칠 수 있다
            if (g.Period == Period.Night && R.Seen("night") && Rng.NextDouble() < 0.3)
            {
                Body.Hurt(R, 2, "어둠 속의 무언가에게 당했다");
                Body.Use(R, Stat.Sen);
                lines.AddRange(L("", "어둠 속에서 무언가가 발목을 스친다.", "날카로운 통증. 돌아봤을 때는 아무것도 없다."));
            }
            if (e.Use.HasValue) Body.Use(R, e.Use.Value);
            R.loc = e.To;
            if (e.To == "edge") { R.end = "alone"; lines.AddRange(PassTime(e.Min)); return lines; }
            lines.AddRange(PassTime(e.Min));
            // 그녀보다 먼저 도착하면, 그녀가 올 때까지 기다린다
            if (e.To == "hollow" && R.HasGirl && R.t < R.girl.since)
            {
                lines.AddRange(L("", "아직 아무도 없다.", "뿌리 사이에 몸을 낮추고 기다린다."));
                lines.AddRange(PassTime(R.girl.since - R.t));
                lines.AddRange(L("", "……발소리. 누군가 비틀거리며 다가온다."));
                return lines;
            }
            lines.Add("");
            lines.AddRange(Locs[e.To].Desc(NewCtx()));
            return lines;
        }

        List<Line> EatBerry()
        {
            R.inv.Add("berry", -1);
            R.hunger = Math.Max(0, R.hunger - 25);
            bool knew = P.Knows("berry_poison");
            R.ateBerry = true;
            P.Know("berry_poison");
            Body.Hurt(R, 3, "붉은 열매의 독에 당했다");
            var l = L(knew ? "먹으면 안 된다는 걸 알면서도, 허기를 이기지 못한다." : "열매를 하나 입에 넣는다. 달다. 하나 더.",
                "……얼마 지나지 않아 배 속이 뒤틀린다.", "무릎을 꿇고 전부 게워 낸다. 식은땀이 흐른다.", "한참을 그렇게 웅크려 있었다.");
            if (!knew) l.Add(Kn("……이건 먹으면 안 되는 거였다."));
            l.AddRange(PassTime(60));
            return l;
        }

        List<Line> ChewHerb()
        {
            R.inv.Add("herb", -1);
            R.hunger = Math.Max(0, R.hunger - 3);
            return Cat(L("쓴 풀을 씹어 본다.", "혀가 오그라들 만큼 쓰다. 삼키지 못하고 뱉는다."), PassTime(5));
        }

        List<Line> NotebookLines()
        {
            var l = L("알고 있는 것을 하나씩 되짚는다.", "");
            foreach (var k in World.Know) if (P.Knows(k.Key)) l.Add(new Line("· " + k.Value, "note"));
            return l;
        }

        List<Line> WordLines()
        {
            var l = L("그녀에게서 들은 말을 입속으로 되뇐다.", "");
            foreach (var w in P.words) l.Add(new Line("· 「" + w + "」", "note"));
            l.Add("");
            l.Add(new Line("낯선 말  " + P.language.avere + "%", "stat"));
            return l;
        }

        // 둘째 날, 그녀가 있는 곳으로 가는 길
        ExitDef GirlExit()
        {
            if (!R.HasGirl || Clock.DayOf(R.t) < 2) return null;
            if (R.loc != "clearing" && R.loc != "stream" && R.loc != "deep") return null;
            if (R.Seen("teaser"))
                return new ExitDef { To = "hollow", Label = "피 냄새가 나던 쪽으로 간다", Min = 20, Kw = new[] { "피", "냄새" }, Text = new[] { "피 냄새를 기억하며 걷는다." } };
            if (P.Knows("girl_hollow"))
                return new ExitDef { To = "hollow", Label = "뿌리가 엉킨 움푹한 곳으로 간다", FixedHint = "안다", Min = 20, Kw = new[] { "움푹", "그녀", "여자" },
                    Text = new[] { "이 숲에서 어디로 가야 하는지, 나는 안다." } };
            return null;
        }

        List<Option> BuildOptions()
        {
            var L0 = Locs[R.loc];
            var period = Clock.PeriodOf(R.t);
            var g = NewCtx();
            var opts = new List<Option>();
            foreach (var a in L0.Actions) { var act = a; opts.Add(new Option { Label = a.Label, Kw = a.Kw, Run = () => DoAction(act) }); }
            var exits = L0.Exits.Where(e => e.Show == null || e.Show(g)).ToList();
            var ge = GirlExit();
            if (ge != null) exits.Add(ge);
            for (int i = 0; i < exits.Count; i++)
            {
                var e = exits[i];
                string h = e.FixedHint ?? (e.HintKnow != null && P.Knows(e.HintKnow) ? e.HintText : null);
                opts.Add(new Option { Label = e.Label, Hint = h, Kw = e.Kw, Sep = i == 0, Run = () => DoMove(e) });
            }
            opts.Add(new Option { Label = "소리를 듣는다", Kw = ListenKw, Sep = true, Run = () => Cat(ListenLines(NewCtx()), PassTime(10)) });
            opts.Add(new Option { Label = "소지품을 확인한다", Kw = BagKw, Run = () => BagLines(R) });
            if (R.inv.Has("berry")) opts.Add(new Option { Label = "붉은 열매를 먹는다", Kw = new[] { "먹", "열매" }, Hint = P.Knows("berry_poison") ? "독이다" : null, Run = EatBerry });
            if (R.inv.Has("herb")) opts.Add(new Option { Label = "쓴 풀을 씹어 본다", Kw = new[] { "씹" }, Run = ChewHerb });
            if (R.status.unlocked) opts.Add(new Option { Label = "몸 상태를 확인한다", Kw = new[] { "상태", "몸" }, Scene = "body" });
            if (P.words.Count > 0) opts.Add(new Option { Label = "들은 말을 되뇐다", Kw = new[] { "말", "단어", "언어" }, Run = WordLines });
            if (P.deaths > 0 && World.Know.Any(k => P.Knows(k.Key)))
                opts.Add(new Option { Label = "기억을 되짚는다", Kw = new[] { "기억", "되짚", "수첩" }, Run = NotebookLines });
            if (period == Period.Night)
                opts.Add(new Option { Label = "밤이 지나가기를 기다린다", Kw = RestKw, Run = () => Cat(
                    L("나무에 등을 기대고 웅크린다.", "잠은 오지 않는다. 눈을 감아도 숲의 소리가 들린다.", "몇 번이고 눈을 뜨고, 다시 감는다."),
                    PassTime(MinutesUntilDawn(R), true)) });
            else
                opts.Add(new Option { Label = "잠시 쉰다", Kw = RestKw, Run = () => Cat(
                    L("나무에 등을 기대고 잠시 숨을 고른다.", "심장이 천천히 가라앉는다."), PassTime(30, true)) });
            return opts;
        }

        // 자유 입력을 가장 잘 맞는 선택지에 연결한다 (키워드가 겹칠수록 점수가 높다)
        public static Option MatchOption(IList<Option> opts, string text)
        {
            Option best = null;
            int bestScore = 0;
            foreach (var o in opts)
            {
                int score = 0;
                if (o.Kw != null) foreach (var k in o.Kw) if (text.Contains(k)) score += k.Length;
                if (score > bestScore) { best = o; bestScore = score; }
            }
            return best;
        }

        // 지금 벌어져야 할 장면이 있으면 그 이름을 돌려준다
        string NextScene()
        {
            int i = R.pending.FindIndex(p => p != "magic");
            if (i >= 0) { string s = R.pending[i]; R.pending.RemoveAt(i); return s; }
            int c = Clock.ClockOf(R.t);
            var period = Clock.PeriodOf(R.t);
            if (R.loc == "hollow" && Npc.GirlHere(R)) return "girl";
            if (!R.Seen("beast") && period != Period.Night && R.loc != "hill" && R.loc != "hollow"
                && (R.loc == "downstream" || R.loc == "deep" || (Clock.DayOf(R.t) == 1 && c >= 16 * 60 + 30))) return "beast";
            if (!R.Seen("light") && period == Period.Evening && (R.loc == "clearing" || R.loc == "deep" || R.loc == "stream" || R.loc == "downstream")) return "light";
            return null;
        }

        Task<string> RunScene(string name)
        {
            switch (name)
            {
                case "beast": return SceneBeast();
                case "light": return SceneLight();
                case "call": return SceneCall();
                case "status": return SceneStatus();
                case "girl": return SceneGirl();
                default: return Task.FromResult("ok");
            }
        }

        async Task<string> Explore()
        {
            var carry = Locs[R.loc].Desc(NewCtx());
            int lastHp = R.hp;
            while (true)
            {
                view.Clear();
                SetHud();
                if (R.hp < lastHp) { var f = Body.HpFeeling(R); if (f != null) carry = Cat(carry, L("", f)); }
                lastHp = R.hp;
                await Say(carry);
                if (R.hp <= 0)
                {
                    await Say(L("", "더는 몸을 가눌 수 없다.", "흙바닥이 뺨에 닿는다."), 900);
                    await More();
                    return "die";
                }
                if (!string.IsNullOrEmpty(R.end)) { await More(); return "end"; }

                string sc = NextScene();
                if (sc != null)
                {
                    if (carry.Count > 0) await More();
                    string res = await RunScene(sc);
                    if (res == "die") return "die";
                    if (res == "end:with") { R.end = "with"; return "end"; }
                    carry = res == "leave"
                        ? Cat(L("그녀를 두고 자리를 뜬다."), PassTime(15), L(""), Locs[R.loc].Desc(NewCtx()))
                        : Locs[R.loc].Desc(NewCtx());
                    lastHp = R.hp;
                    continue;
                }

                // 둘째 날 아침: 바람에 피 냄새가 실려 온다
                if (Npc.GirlHere(R) && R.day2Acts >= 3 && !R.Seen("teaser") && !R.girl.met)
                {
                    R.Mark("teaser");
                    await Say(L("", "바람에 실려 무언가가 코끝을 스친다.", "……피 냄새다."), 1200);
                    int idx = await Choose(Opts("냄새를 따라간다", "모른 척한다"));
                    if (idx == 0)
                    {
                        R.loc = "hollow";
                        carry = Cat(L("냄새를 따라 걷는다. 비릿한 냄새가 점점 짙어진다."), PassTime(20));
                        continue;
                    }
                    carry = L("냄새가 나는 쪽에서 등을 돌린다.", "……신경 쓰이지 않는다면 거짓말이다.");
                    continue;
                }

                store?.Write(P, R);
                var opts = BuildOptions();
                var pick = await view.Choose(opts, true);
                var o = pick.Text != null ? MatchOption(opts, pick.Text) : opts[pick.Index];
                if (o == null) { carry = L("……어떻게 해야 할지 모르겠다."); continue; }
                if (o.Scene == "body") { await SceneCheckBody(); carry = Locs[R.loc].Desc(NewCtx()); continue; }
                carry = o.Run();
            }
        }

        // ---------- 끝 ----------
        // 죽음: 검은 화면에 「죽었다」와 그 까닭, 몇 번째 죽음인지 보여 주고 처음 눈을 뜬 순간으로 되감는다
        async Task Die()
        {
            view.Clear();
            view.SetHud("");
            await Say(L("숨이 멎는다.", "눈앞이 어두워진다."), 1000);
            view.SetBlack(true);
            await view.Wait(1200);
            view.Clear();
            P.deaths++;
            var lines = L(new Line("죽었다", "death"));
            if (!string.IsNullOrEmpty(R.cause)) lines.Add(new Line(R.cause + ".", "dim center"));
            lines.Add(new Line(P.deaths + "번째 죽음", "dim center"));
            await Say(lines, 900);
            await More();
            Rewind();
        }

        // 처음 눈을 뜬 순간으로 되감는다 (이름, 지식, 배운 말은 남는다)
        void Rewind()
        {
            P.rewinds++;
            R = new RunState();
            store?.Write(P, R);
        }

        async Task<string> EndCard()
        {
            view.Clear();
            view.SetHud("");
            var g = R.girl;
            List<Line> story;
            if (R.end == "with")
                story = L("그녀를 따라 걷는다.", "그녀는 몇 걸음마다 뒤를 돌아본다. 내가 따라오는지 확인하는 것처럼.", "",
                    "해가 기울 무렵, 나무 사이가 성겨진다.", "숲이 끝나는 곳에 낮은 울타리와 지붕들이 보인다.", "굴뚝에서 연기가 오른다.", "",
                    "리아가 걸음을 멈추고 나를 돌아본다.", Speak("「[[어서:40]] [[와:40]]. [[여기가:60]] [[마을:20]]이야.」"), "",
                    "그녀가 무슨 말을 했는지, 전부는 모른다.", "하지만 언젠가는 알게 될 것이다.");
            else
            {
                story = L("몇 시간을 걸었다.", "다리가 후들거리고, 목이 탄다.", "", "나무 사이가 성겨진다.", "숲이 끝나는 곳에 낮은 울타리와 지붕들이 보인다.", "사람이 있다.", "");
                if (R.HasGirl && g.met) story.AddRange(L("……그녀는 어디로 갔을까.", ""));
                story.AddRange(L("울타리 앞의 남자가 나를 보고 무언가 외친다.", "「……!」", "", "알아들을 수 없다.", "……대체, 이 세계는 뭐지?"));
            }
            await Say(story, 800);
            await More();
            view.Clear();
            int known = World.Know.Count(k => P.Knows(k.Key));
            await Say(L(new Line("— 1장 · 이름 없는 숲 —", "center"), "",
                new Line("죽음 " + P.deaths + "번 · 알아낸 것 " + known + "/" + World.Know.Length + " · 배운 말 " + P.words.Count + "개", "dim center"), "",
                new Line("다음 단계: 마을과 사람들, 모험가 길드.", "dim center")), 700);
            int idx = await Choose(new List<Option>
            {
                new Option("처음부터 다시", hint: "모든 기억을 지운다"),
                new Option("되감는다", hint: "이름과 지식, 배운 말이 남는다"),
            });
            return idx == 0 ? "restart" : "rewind";
        }

        async Task<bool> TitleMenu()
        {
            if (store == null || !store.TryRead(out var p, out var r)) return false;
            view.SetBlack(true);
            view.Clear();
            await Say(L(new Line("……이전의 기억이 남아 있다.", "center")));
            int idx = await Choose(new List<Option> { new Option("이어서 한다"), new Option("처음부터 한다", hint: "모든 기억을 지운다") });
            view.SetBlack(false);
            if (idx == 1) { store.Clear(); return false; }
            P = p;
            R = r;
            return true;
        }

        public async Task Run()
        {
            bool resume = await TitleMenu();
            while (true)
            {
                if (!resume)
                {
                    if (!P.HasName) await Intro(); else await RewindIntro();
                }
                resume = false;
                string res = await Explore();
                if (res == "die") { await Die(); continue; }
                string c = await EndCard();
                if (c == "restart")
                {
                    store?.Clear();
                    P = new PersistentState();
                    R = new RunState();
                    continue;
                }
                Rewind();
            }
        }
    }
}
