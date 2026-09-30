// 귀환 — 이세계 표류기 : 게임 규칙 (UnityEngine 비의존 순수 C#)
using System;
using System.Collections.Generic;
using System.Linq;

namespace Kwihwan
{
    public enum Role { Hero, Doctor, Mech, Hunter, Radio, Teacher }
    public enum Res { Food, Fuel, Med, Morale, Signal }
    public enum Ending { None, Rescued, Dead, Mutiny, Lost }

    public class Person
    {
        public string Name;
        public Role Role;
        public bool Sick;
    }

    public class Choice
    {
        public string Label;
        public (Res res, int amount)[] Need;
        public Role? Role;
        public Func<GameState, string> Run;
    }

    public class GameEvent
    {
        public string Id, Title, Text;
        public int Weight = 1;
        public Func<GameState, bool> Cond;
        public Choice[] Choices;
    }

    public class NightReport
    {
        public List<string> Notes = new List<string>();
        public List<string> Delta = new List<string>();
    }

    public static class Rng
    {
        public static Random R = new Random();
        public static bool Chance(double p) => R.NextDouble() < p;
        public static T Pick<T>(IList<T> list) => list[R.Next(list.Count)];
    }

    public static class Txt
    {
        public const int MaxDay = 40;
        public const int RescueSignal = 16;

        public static string ResName(Res r)
        {
            switch (r)
            {
                case Res.Food: return "식량";
                case Res.Fuel: return "마력석";
                case Res.Med: return "약초";
                case Res.Morale: return "사기";
                default: return "의식";
            }
        }

        public static string RoleName(Role r)
        {
            switch (r)
            {
                case Role.Hero: return "주인공";
                case Role.Doctor: return "간호사";
                case Role.Mech: return "기계공";
                case Role.Hunter: return "등산가";
                case Role.Radio: return "대학원생";
                default: return "교사";
            }
        }

        public static readonly string[] Names =
            { "민준", "서연", "하준", "지우", "도윤", "수아", "예준", "하은", "시우", "유나", "건우", "채원" };

        public static readonly string[] Intro =
        {
            "오전 8시 17분. 통학 셔틀버스가 터널에 들어서는 순간, 창밖이 하얗게 터졌다.",
            "눈을 떴을 때 나는 낯선 숲 한가운데 처박힌 버스 안에 있었다. 하늘에는 달이 두 개 떠 있었다.",
            "휴대폰은 먹통이고, 지도에 없는 짐승이 숲에서 울었다. 버스에서 함께 깨어난 사람은 넷이다.",
            "그런데 이상하다. 버스 뒤편에 갈라진 공기의 틈, 균열이 유독 나에게만 반응한다. 다가서면 푸르게 일렁이고, 손을 대면 따뜻하다.",
            "푸른 결정, 마력석을 모아 의식을 올리면 이 틈이 다시 열릴지 모른다. 그 의식을 이끌 수 있는 사람은 나뿐이다.",
            "집에 돌아가려면 내가 살아남아야 하고, 동료들도 지켜야 한다. 밤마다 마물이 다가오지 못하게 결계를 피워야 하고, 먹을 것도 구해야 한다.",
        };

        public static readonly Dictionary<int, string> Milestones = new Dictionary<int, string>
        {
            { 7, "일주일이 지났다. 균열은 여전히 나에게만 미지근한 온기를 보낸다. 동료들은 그걸 신기한 듯, 조금 두렵게 바라본다." },
            { 15, "균열이 밤마다 조금씩 숨을 쉰다. 그 너머로 아주 희미하게 도시의 소음이 들린 것 같다. 나는 아무에게도 말하지 않았다." },
            { 25, "캠프에 제법 사람 사는 모양이 갖춰졌다. 돌아가고 싶은 마음과 남고 싶은 마음이 뒤섞인다." },
            { 35, "균열이 눈에 띄게 커졌다. 열 수 있는 날이 머지않았다. 아니면 이곳이 새 집이 될 수도 있다." },
        };

        public static (string title, string body) EndingText(Ending e)
        {
            switch (e)
            {
                case Ending.Rescued:
                    return ("균열이 열렸다", "균열이 내 손끝에서 활짝 열렸다. 푸른 빛이 버스를 삼켰다. 눈을 뜨자 터널 안이었고, 시계는 8시 17분을 가리키고 있었다. 모든 게 꿈이었을까. 주머니 속에서 푸른 결정 하나가 손끝에 닿았다.");
                case Ending.Dead:
                    return ("내가 쓰러졌다", "의식을 이끌 사람이 사라졌다. 남은 동료들이 나를 묻어 주었다. 균열은 더는 아무에게도 반응하지 않는다.");
                case Ending.Mutiny:
                    return ("흩어진 사람들", "더는 아무도 나를 믿지 않는다. 동료들은 각자의 길로 숲속으로 흩어졌고, 나는 홀로 균열 앞에 남았다.");
                default:
                    return ("이 세계의 주민", MaxDay + "일이 지났다. 균열은 끝내 열리지 않았다. 하지만 캠프는 어느새 작은 마을이 되었다. 나는 이 세계에서, 새로운 이야기를 시작하기로 했다.");
            }
        }
    }

    public class GameState
    {
        public int Day = 1, Food = 16, Fuel = 10, Med = 3, Morale = 6, Signal = 0;
        public List<Person> People = new List<Person>();
        public bool RationFull = true, Broadcast, Forage;
        public string LastEvent;
        public List<string> D = new List<string>(); // 이번 단계에서 발생한 변화 기록
        public Ending Over = Ending.None;

        public static GameState New()
        {
            var s = new GameState();
            var names = Txt.Names.OrderBy(_ => Rng.R.Next()).ToList();
            var roles = new[] { Role.Doctor, Role.Mech, Role.Hunter, Role.Radio, Role.Teacher }
                .OrderBy(_ => Rng.R.Next()).Take(4).ToList();
            s.People.Add(new Person { Name = "나", Role = Role.Hero });
            for (int i = 0; i < roles.Count; i++)
                s.People.Add(new Person { Name = names[i], Role = roles[i] });
            return s;
        }

        public int Get(Res r)
        {
            switch (r)
            {
                case Res.Food: return Food;
                case Res.Fuel: return Fuel;
                case Res.Med: return Med;
                case Res.Morale: return Morale;
                default: return Signal;
            }
        }

        public void Set(Res r, int v)
        {
            switch (r)
            {
                case Res.Food: Food = v; break;
                case Res.Fuel: Fuel = v; break;
                case Res.Med: Med = v; break;
                case Res.Morale: Morale = v; break;
                default: Signal = v; break;
            }
        }
    }

    public static class Rules
    {
        // 하루 식량 소비량: 정량 = 인원의 60%, 절반 배급 = 30% (올림)
        public static int RationNeed(GameState s, bool full) =>
            (int)Math.Ceiling(s.People.Count * (full ? 0.6 : 0.3));

        public static bool HasRole(GameState s, Role r) => s.People.Any(p => p.Role == r);
        public static bool HeroAlive(GameState s) => HasRole(s, Role.Hero);

        public static void Chg(GameState s, Res r, int n)
        {
            int before = s.Get(r);
            int max = r == Res.Morale ? 10 : r == Res.Signal ? Txt.RescueSignal : int.MaxValue;
            s.Set(r, Math.Max(0, Math.Min(max, before + n)));
            int real = s.Get(r) - before;
            if (real != 0) s.D.Add(Txt.ResName(r) + " " + (real > 0 ? "+" : "") + real);
        }

        public static void Lose(GameState s, Role? prefer = null)
        {
            var cands = s.People.Where(p => p.Role != Role.Hero).ToList();
            if (cands.Count == 0) return;
            Person p = prefer.HasValue ? cands.FirstOrDefault(c => c.Role == prefer.Value) : null;
            if (p == null) p = Rng.Pick(cands);
            s.People.Remove(p);
            s.D.Add(p.Name + "(" + Txt.RoleName(p.Role) + ") 사망");
            Chg(s, Res.Morale, -1);
        }

        public static void MakeSick(GameState s)
        {
            var healthy = s.People.Where(p => !p.Sick).ToList();
            if (healthy.Count == 0) return;
            var p = Rng.Pick(healthy);
            p.Sick = true;
            s.D.Add(p.Name + " 앓아누움");
        }

        public static void AddPerson(GameState s)
        {
            var used = new HashSet<string>(s.People.Select(p => p.Name));
            var pool = Txt.Names.Where(n => !used.Contains(n)).ToList();
            pool.Add("낯선이");
            var roles = new[] { Role.Doctor, Role.Mech, Role.Hunter, Role.Radio, Role.Teacher };
            var p = new Person { Name = Rng.Pick(pool), Role = Rng.Pick(roles) };
            s.People.Add(p);
            s.D.Add(p.Name + "(" + Txt.RoleName(p.Role) + ") 합류");
        }

        public static void Leave(GameState s)
        {
            var cands = s.People.Where(p => p.Role != Role.Hero).ToList();
            if (cands.Count == 0) return;
            var p = Rng.Pick(cands);
            s.People.Remove(p);
            s.D.Add(p.Name + " 떠남");
            Chg(s, Res.Morale, -1);
        }


        public static bool CanPay(GameState s, (Res res, int amount)[] need) =>
            need == null || need.All(n => s.Get(n.res) >= n.amount);

        public static bool CanChoose(GameState s, Choice c) =>
            CanPay(s, c.Need) && (!c.Role.HasValue || HasRole(s, c.Role.Value));

        public static GameEvent PickEvent(GameState s)
        {
            var pool = GameEvents.All.Where(e => e.Id != s.LastEvent && (e.Cond == null || e.Cond(s))).ToList();
            int total = pool.Sum(e => e.Weight);
            int r = Rng.R.Next(total);
            foreach (var e in pool)
            {
                r -= e.Weight;
                if (r < 0) return e;
            }
            return pool[0];
        }

        // 선택지를 실행하고 결과 텍스트를 반환한다. s.D 에 자원 변화가 남는다.
        public static string RunChoice(GameState s, GameEvent ev, int idx)
        {
            s.D.Clear();
            var c = ev.Choices[idx];
            if (!CanChoose(s, c)) return "자원이 부족하다.";
            if (c.Need != null) foreach (var n in c.Need) Chg(s, n.res, -n.amount);
            s.LastEvent = ev.Id;
            return c.Run(s);
        }

        // 하루를 마무리한다 (밤 처리).
        public static NightReport EndDay(GameState s)
        {
            s.D.Clear();
            var rep = new NightReport();

            if (s.Forage)
            {
                Chg(s, Res.Food, 2); Chg(s, Res.Fuel, 1);
                rep.Notes.Add("수색조가 숲 가장자리에서 물자를 조금 모아 왔다.");
                if (Rng.Chance(0.2)) { MakeSick(s); rep.Notes.Add("수색 중 누군가 몸이 상했다."); }
            }

            bool fed = false, warm = false;
            int need = RationNeed(s, s.RationFull);
            if (s.Food >= need)
            {
                Chg(s, Res.Food, -need);
                if (s.RationFull) fed = true;
                else rep.Notes.Add("절반 배급에 다들 배를 움켜쥐고 잠들었다.");
            }
            else
            {
                int shortage = need - s.Food;
                Chg(s, Res.Food, -s.Food);
                Chg(s, Res.Morale, -2);
                rep.Notes.Add("식량이 모자랐다.");
                if (shortage >= 2) Lose(s);
            }

            if (s.Fuel >= 1)
            {
                Chg(s, Res.Fuel, -1);
                warm = true;
                if (s.Broadcast && s.Fuel >= 1)
                {
                    Chg(s, Res.Fuel, -1);
                    Chg(s, Res.Signal, HasRole(s, Role.Radio) ? 2 : 1);
                    rep.Notes.Add("귀환 의식을 올렸다. 균열이 내 손끝에서 푸르게 일렁였다.");
                }
                else if (s.Broadcast) rep.Notes.Add("마력석이 부족해 의식을 올리지 못했다.");
            }
            else
            {
                Chg(s, Res.Morale, -1);
                MakeSick(s);
                rep.Notes.Add("결계가 꺼졌다. 밤새 마물 울음소리에 떨었다.");
            }

            if (fed && warm) Chg(s, Res.Morale, 1);

            foreach (var p in s.People.Where(x => x.Sick).ToList())
            {
                if (s.Med >= 1)
                {
                    Chg(s, Res.Med, -1);
                    p.Sick = false;
                    rep.Notes.Add(p.Name + "은(는) 약초를 먹고 회복했다.");
                }
                else if (Rng.Chance(0.5))
                {
                    s.People.Remove(p);
                    s.D.Add(p.Name + " 사망");
                    Chg(s, Res.Morale, -2);
                    rep.Notes.Add(p.Role == Role.Hero ? "열병이 끝내 나를 쓰러뜨렸다. 의식이 흐려진다."
                                                    : p.Name + "은(는) 약초가 없어 끝내 숨을 거두었다.");
                }
            }

            if (s.Signal >= Txt.RescueSignal) s.Over = Ending.Rescued;
            else if (!HeroAlive(s)) s.Over = Ending.Dead;
            else if (s.Morale <= 0) s.Over = Ending.Mutiny;
            else if (s.Day >= Txt.MaxDay) s.Over = Ending.Lost;
            else { s.Day++; s.Broadcast = false; s.Forage = false; }

            rep.Delta = new List<string>(s.D);
            return rep;
        }
    }
}
