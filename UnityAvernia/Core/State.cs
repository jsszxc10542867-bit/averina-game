// 상태: 유지 상태(죽어도 남는 것)와 회차 상태(죽으면 초기화되는 것)를 분리한다.
// 모든 필드는 public 필드로 두어 Unity JsonUtility로 그대로 저장된다. (Dictionary 대신 List 사용)
using System;
using System.Collections.Generic;

namespace Avernia
{
    // 화면에 찍히는 한 줄. cls는 표시 방식이다: dim, center, know(지식으로 알아챈 줄), sys, note, stat, head
    public struct Line
    {
        public string T;
        public string Cls;
        public Line(string t, string cls = null) { T = t; Cls = cls; }
        public static implicit operator Line(string s) => new Line(s);
        public bool Has(string cls) => Cls != null && Array.IndexOf(Cls.Split(' '), cls) >= 0;
    }

    public enum Stat { Str, Agi, Vit, Int, Sen, Wil }

    public enum Period { Morning, Day, Afternoon, Evening, Night }

    [Serializable]
    public class LanguageState
    {
        public int avere, silva, dor, mar, beast, ancient, spirit;
    }

    [Serializable]
    public class MemoryState
    {
        public bool identity = true;
        public bool name;
        public string family = "unknown", previousLocation = "unknown", lastMoment = "unknown";
        public int worldKnowledge;
    }

    // 유지 상태: 이름, 지식, 언어 이해도, 배운 단어, 기억 조각
    [Serializable]
    public class PersistentState
    {
        public string name = "";
        public int deaths;
        public int rewinds; // 되감은 횟수 (죽음 + 1장 끝에서 스스로 되감기)
        public LanguageState language = new LanguageState();
        public List<string> words = new List<string>();     // 뜻을 알아낸 아베르어 단어
        public List<string> knowledge = new List<string>(); // 알아낸 것 (World.Know의 id)
        public MemoryState memory = new MemoryState();

        public bool Knows(string id) => knowledge.Contains(id);
        public void Know(string id) { if (!knowledge.Contains(id)) knowledge.Add(id); }
        public bool HasWord(string w) => words.Contains(w);
        public bool HasName => !string.IsNullOrEmpty(name);
    }

    [Serializable]
    public class Entry
    {
        public string id;
        public int n;
    }

    // 아이템 id → 개수
    [Serializable]
    public class Counter
    {
        public List<Entry> items = new List<Entry>();

        public int Get(string id)
        {
            foreach (var e in items) if (e.id == id) return e.n;
            return 0;
        }

        public void Set(string id, int n)
        {
            items.RemoveAll(e => e.id == id);
            if (n > 0) items.Add(new Entry { id = id, n = n });
        }

        public void Add(string id, int d = 1) => Set(id, Get(id) + d);
        public void Remove(string id) => Set(id, 0);
        public bool Has(string id) => Get(id) > 0;
        public bool Any => items.Count > 0;
    }

    [Serializable]
    public class StatusState
    {
        public bool unlocked;
        public int points;
        public bool[] known = new bool[6];
    }

    [Serializable]
    public class NpcBody
    {
        public float health = 40, hunger = 60, fear = 70, trust = 0, suspicion = 80, pain = 75;
        public string location = "hollow";
        public bool injured = true;
    }

    // 관계 수치. 플레이어에게 보여 주지 않는다.
    [Serializable]
    public class Relationship
    {
        public float trust, fear, respect, affection, suspicion = 80, hostility;
    }

    // 첫 번째 NPC: 숲에서 다친 젊은 여자 (리아)
    [Serializable]
    public class GirlState
    {
        public bool exists;
        public int since;             // 움푹한 곳에 몸을 숨긴 시각
        public NpcBody state = new NpcBody();
        public Relationship rel = new Relationship();
        public bool alive = true;
        public string gone = "";      // 떠난 이유: left | fled | village
        public float bleed = 1f / 12; // 분당 체력 감소 (12분에 1)
        public bool magicUsed, magicSeen, met;
        public bool close;            // 가까이 다가가는 걸 허락했는가
        public int lastSeen = -1;     // 플레이어가 마지막으로 곁에 있던 시각
        public int heardStop;         // "멈춰"를 들은 횟수
        public bool named;            // 서로 이름을 주고받았는가
        public bool gotWater, gotHerb, stopped, calledName, sawBerry, invited;
        public int approach, talked;
        public List<string> events = new List<string>(); // 플레이어가 없는 동안 벌어진 일

        public bool Gone => !string.IsNullOrEmpty(gone);
    }

    // 회차 상태: 죽으면 처음 눈을 뜬 시점으로 초기화된다 (능력치, 소지품, 시간, 위치, 관계 포함)
    [Serializable]
    public class RunState
    {
        public int t = Clock.StartMinute; // 1일차 0시부터 흐른 분
        public string loc = "clearing";
        public Counter inv = new Counter();
        public List<string> seen = new List<string>(); // 한 번만 나오는 장면 표시
        public Counter counts = new Counter();         // 반복 행동 횟수
        public int day2Acts;
        // 몸
        public int hp = 10;
        public float thirst = 40, hunger = 30, starve;
        public List<string> feel = new List<string>();
        public int[] stats = { 3, 3, 3, 3, 3, 3 };
        public int[] grasp = new int[6]; // 몸을 쓴 횟수 (능력치 이해도)
        public StatusState status = new StatusState();
        public List<string> pending = new List<string>(); // 다음 화면에서 벌어질 장면
        public GirlState girl = new GirlState();          // 둘째 날 새벽에 exists가 된다
        public string end = "";
        public bool ateBerry;
        public string cause = ""; // 마지막으로 다친 까닭 (죽으면 죽음 화면에 보인다)

        [NonSerialized] List<Line> notes; // 행동 뒤에 덧붙일 짧은 알림 (저장하지 않는다)
        public List<Line> Notes => notes ?? (notes = new List<Line>());

        public bool Seen(string key) => seen.Contains(key);
        public void Mark(string key) { if (!seen.Contains(key)) seen.Add(key); }
        public int this[Stat s] { get => stats[(int)s]; set => stats[(int)s] = value; }
        public bool HasGirl => girl != null && girl.exists;
    }

    public static class Clock
    {
        public const int MinDay = 1440;
        public const int StartMinute = 15 * 60; // 첫날 오후 3시에 눈을 뜬다

        public static int ClockOf(int t) => t % MinDay;
        public static int DayOf(int t) => t / MinDay + 1;

        public static Period PeriodOf(int t)
        {
            float h = ClockOf(t) / 60f;
            if (h >= 6 && h < 11) return Period.Morning;
            if (h >= 11 && h < 15) return Period.Day;
            if (h >= 15 && h < 18) return Period.Afternoon;
            if (h >= 18 && h < 20) return Period.Evening;
            return Period.Night;
        }

        public static string PeriodKo(Period p)
        {
            switch (p)
            {
                case Period.Morning: return "아침";
                case Period.Day: return "낮";
                case Period.Afternoon: return "오후";
                case Period.Evening: return "저녁";
                default: return "밤";
            }
        }

        static readonly string[] DayKoNames = { "", "", "둘째 날", "셋째 날", "넷째 날", "다섯째 날", "여섯째 날", "일곱째 날" };
        public static string DayKo(int d) => d < DayKoNames.Length ? DayKoNames[d] : d + "일째";
    }

    // 세이브 저장소. Unity 쪽에서 JsonUtility + 파일로 구현한다.
    public interface ISaveStore
    {
        void Write(PersistentState p, RunState r);
        bool TryRead(out PersistentState p, out RunState r);
        void Clear();
    }
}
