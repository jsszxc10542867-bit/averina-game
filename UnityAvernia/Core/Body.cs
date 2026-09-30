// 몸: 체력, 갈증, 허기, 능력치와 능력치 이해도. 화면과 무관한 순수 로직이다.
using System;
using System.Collections.Generic;

namespace Avernia
{
    public static class Body
    {
        public static readonly Stat[] Stats = { Stat.Str, Stat.Agi, Stat.Vit, Stat.Int, Stat.Sen, Stat.Wil };
        static readonly string[] Ko = { "힘", "민첩", "체력", "지능", "감각", "의지" };
        public const int Points = 10;     // 상태창이 열릴 때 받는 포인트
        public const int StatMax = 10;
        public const int GraspReveal = 2; // 이만큼 몸을 써 봐야 그 능력치가 숫자로 보인다

        public static string StatKo(Stat s) => Ko[(int)s];
        public static int HpMax(RunState r) => 7 + r[Stat.Vit];

        // 몸을 쓴다. 상태창이 열린 뒤라면, 처음으로 감이 잡힌 능력치를 알려 준다.
        public static void Use(RunState r, Stat k)
        {
            int i = (int)k;
            r.grasp[i]++;
            if (r.status.unlocked && !r.status.known[i] && r.grasp[i] >= GraspReveal)
            {
                r.status.known[i] = true;
                r.Notes.Add(new Line("……" + StatKo(k) + "에 대한 이해도가 상승했다.", "sys"));
            }
        }

        // cause: 이 상처로 죽으면 죽음 화면에 보일 까닭
        public static void Hurt(RunState r, int n, string cause = null)
        {
            r.hp = Math.Max(0, r.hp - n);
            if (!string.IsNullOrEmpty(cause)) r.cause = cause;
        }
        public static void Heal(RunState r, int n) => r.hp = Math.Min(HpMax(r), r.hp + n);

        // 시간이 흐르는 동안 목이 마르고 배가 고파진다. 한계를 넘기면 몸이 상한다.
        public static List<Line> Tick(RunState r, int min, bool resting)
        {
            var lines = new List<Line>();
            r.thirst = Math.Min(100, r.thirst + min * 0.05f);  // 시간당 +3
            r.hunger = Math.Min(100, r.hunger + min * 0.025f); // 시간당 +1.5
            if (r.thirst >= 85 || r.hunger >= 90)
            {
                r.starve += min;
                while (r.starve >= 60) { r.starve -= 60; Hurt(r, 1, "굶주림과 갈증을 버티지 못했다"); }
            }
            else r.starve = 0;
            if (resting && r.thirst < 70 && r.hunger < 80) Heal(r, min / 30);

            void Feel(string key, bool on, string text)
            {
                bool had = r.feel.Contains(key);
                if (on && !had) { r.feel.Add(key); lines.Add(text); }
                if (!on && had) r.feel.Remove(key);
            }
            Feel("thirst1", r.thirst >= 60, "목이 마르다.");
            Feel("thirst2", r.thirst >= 85, "목이 타들어 간다. 머리가 멍하다.");
            Feel("hunger1", r.hunger >= 55, "배가 고프다.");
            Feel("hunger2", r.hunger >= 85, "배 속이 쓰리다. 손끝이 조금 떨린다.");
            return lines;
        }

        // 체력을 숫자 대신 몸의 느낌으로 표현한다.
        public static string HpFeeling(RunState r)
        {
            float x = (float)r.hp / HpMax(r);
            if (x >= 0.9f) return null;
            if (x >= 0.6f) return "몸 여기저기가 욱신거린다.";
            if (x >= 0.3f) return "상처가 화끈거린다. 움직일 때마다 숨이 막힌다.";
            return "시야가 흐리다. 이대로는 오래 버티지 못한다.";
        }

        // 상태창. 아직 감이 오지 않은 능력치는 ? 로 보인다.
        public static List<Line> StatusLines(RunState r, string name)
        {
            const string bar = "━━━━━━━━━━━━━━━━";
            var lines = new List<Line> { new Line(bar, "stat"), new Line(name, "stat head"), new Line(bar, "stat") };
            foreach (var k in Stats)
            {
                string v = r.status.known[(int)k] ? r[k].ToString() : "?";
                lines.Add(new Line(StatKo(k).PadRight(2, '　') + "　　" + v.PadLeft(2), "stat"));
            }
            lines.Add(new Line(bar, "stat"));
            if (r.status.points > 0) lines.Add(new Line("남은 포인트: " + r.status.points, "stat"));
            return lines;
        }

        public static void UnlockStatus(RunState r)
        {
            r.status.unlocked = true;
            r.status.points = Points;
            foreach (var k in Stats) r.status.known[(int)k] = r.grasp[(int)k] >= GraspReveal;
        }
    }
}
