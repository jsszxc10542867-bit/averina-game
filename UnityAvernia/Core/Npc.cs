// 첫 번째 NPC: 숲에서 다친 젊은 여자 (리아).
// 플레이어가 아무것도 하지 않아도 그녀의 시간은 흐른다: 피를 흘리고, 스스로 치료하고, 떠난다.
// 관계 수치는 플레이어에게 보여 주지 않는다.
using System;

namespace Avernia
{
    public static class Npc
    {
        public static GirlState NewGirl(int at) => new GirlState { exists = true, since = at };

        public static bool GirlHere(RunState r)
        {
            var g = r.girl;
            return r.HasGirl && g.alive && !g.Gone && g.state.location == "hollow" && r.t >= g.since;
        }

        static float Clamp(float n, float lo = 0, float hi = 100) => Math.Max(lo, Math.Min(hi, n));

        // 관계 변화. 수치는 숨긴다.
        public static void Relate(GirlState g, float trust = 0, float fear = 0, float respect = 0,
            float affection = 0, float suspicion = 0, float hostility = 0)
        {
            var r = g.rel;
            r.trust = Clamp(r.trust + trust);
            r.fear = Clamp(r.fear + fear);
            r.respect = Clamp(r.respect + respect);
            r.affection = Clamp(r.affection + affection);
            r.suspicion = Clamp(r.suspicion + suspicion);
            r.hostility = Clamp(r.hostility + hostility);
            g.state.trust = r.trust;
            g.state.suspicion = r.suspicion;
            g.state.fear = Clamp(g.state.fear + fear);
        }

        public struct TickResult { public bool Magic, Died; }

        // min분 동안 그녀가 스스로 하는 일. present: 플레이어가 곁에 있는가.
        // 곁에 있을 때 벌어진 일은 Magic 처럼 돌려주고, 장면이 그것을 보여 준다.
        public static TickResult Tick(RunState r, int min, bool present)
        {
            var g = r.girl;
            var o = new TickResult();
            if (!r.HasGirl || !g.alive || g.Gone || r.t < g.since) return o;
            var s = g.state;
            s.health = Math.Max(0, s.health - min * g.bleed);
            s.hunger = Clamp(s.hunger + min * 0.03f);
            s.pain = Clamp(40 + (60 - s.health));
            if (present)
            {
                g.lastSeen = r.t;
                if (g.rel.hostility < 30) { s.fear = Clamp(s.fear - min / 6f); g.rel.suspicion = Clamp(g.rel.suspicion - min / 12f); }
            }

            // 상처가 깊어지면 남은 힘으로 스스로를 치료한다
            if (s.health < 20 && !g.magicUsed)
            {
                g.magicUsed = true;
                s.health += 15;
                g.bleed /= 2;
                if (present) o.Magic = true; else g.events.Add("magic");
            }
            if (s.health <= 0)
            {
                g.alive = false;
                o.Died = true;
                return o;
            }

            // 기다려 주지 않는다
            if (!present)
            {
                int away = g.lastSeen < 0 ? r.t - g.since : r.t - g.lastSeen;
                if (g.rel.hostility >= 50) g.gone = "fled";
                else if (!g.met && away >= 300) g.gone = "left";
                else if (g.met && g.rel.trust < 30 && away >= 30) g.gone = "left";
                else if (g.met && away >= 120) g.gone = "village";
                if (g.Gone) s.location = "unknown";
            }
            return o;
        }
    }
}
