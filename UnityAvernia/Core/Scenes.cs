// 장면: 선택이 여러 번 오가는 사건들.
// 결과: "ok" (탐색으로 돌아감) | "die" | "end:with" (그녀와 함께 숲을 나섬) | "leave" (그녀를 두고 떠남)
using System;
using System.Collections.Generic;
using System.Linq;
using System.Threading.Tasks;
using static Avernia.World;

namespace Avernia
{
    public partial class Game
    {
        static Line Sys(string t) => new Line(t, "sys");

        // ---------- 첫 번째 위험: 풀숲의 짐승 ----------
        async Task<string> SceneBeast()
        {
            R.Mark("beast");
            int bHp = 3, looked = 0, climbed = 0;
            bool noticed = true;
            bool atWater = R.loc == "stream" || R.loc == "downstream";
            var lines = L("……", "풀숲이 움직인다.");
            if (P.Knows("beast_seen")) lines.Add(Kn("……이 움직임을 안다."));
            if (R[Stat.Sen] >= 5 || P.Knows("beast_seen"))
            {
                noticed = false;
                lines.Add("이번에는 내가 먼저 알아챘다. 그것은 아직 나를 보지 못했다.");
            }
            else lines.AddRange(L("바람이 아니다. 무언가가 낮게, 풀을 가르며 다가온다.", "풀숲 사이로 눈이 번뜩인다."));
            await Page(lines);

            while (true)
            {
                string weapon = R.inv.Has("stone") ? "날카로운 돌" : R.inv.Has("branch") ? "나뭇가지" : null;
                var opts = new List<Option>
                {
                    new Option("관찰한다", "look"),
                    new Option(weapon != null ? weapon + TextTools.Josa(weapon, "으로") + " 공격한다" : "맨손으로 덤빈다", "hit"),
                };
                if (R.inv.Has("stone")) opts.Add(new Option("돌을 던진다", "throw"));
                if (atWater) opts.Add(new Option("물속으로 들어간다", "water", P.Knows("beast_water") ? "안다" : null));
                if (R.loc == "clearing" || R.loc == "hill") opts.Add(new Option("바위 위로 올라간다", "climb"));
                opts.Add(new Option("숨는다", "hide"));
                opts.Add(noticed ? new Option("도망친다", "flee") : new Option("조용히 물러난다", "sneak"));
                string a = opts[await Choose(opts)].Id;
                var outp = new List<Line>();
                bool done = false, counter = noticed;
                int agi = R[Stat.Agi] - 3, sen = R[Stat.Sen] - 3, str = R[Stat.Str] - 3;

                if (a == "look")
                {
                    looked++;
                    if (looked == 1)
                    {
                        Use(Stat.Sen);
                        outp.AddRange(L("숨을 죽이고 본다.", "", Sys("[???]"), "작은 짐승처럼 보인다.", "하지만…… 뭔가 이상하다."));
                        if (!noticed) counter = false;
                    }
                    else if (looked == 2)
                    {
                        Use(Stat.Sen);
                        Know("beast_seen");
                        outp.AddRange(L("개만 한 몸집. 털 대신, 가시 같은 것이 등에 빽빽하게 돋아 있다.", "눈이…… 셋이다.", "가운데 눈만 깜빡이지 않는다."));
                        if (!noticed && Chance(0.5)) { noticed = true; outp.AddRange(L("", "가운데 눈이 나를 향한다.")); }
                        counter = false;
                    }
                    else
                    {
                        Use(Stat.Int);
                        Know("beast_water");
                        outp.AddRange(L("그것은 나를 노리면서도, 젖은 자갈이나 물웅덩이는 한 번도 밟지 않는다.", "돌아서 온다. 일부러.", "……물을 싫어하는 걸까."));
                    }
                }
                else if (a == "hit")
                {
                    Use(Stat.Str);
                    int dmg = (weapon != null ? 1 : Chance(0.5) ? 1 : 0) + (str >= 2 ? 1 : 0) + (noticed ? 0 : 1);
                    if (!noticed || Chance(0.6 + agi * 0.05))
                    {
                        bHp -= dmg;
                        outp.Add(weapon != null ? weapon + TextTools.Josa(weapon, "을를") + " 힘껏 내리친다." : "주먹을 휘두른다.");
                        outp.Add(dmg > 0 ? "둔한 감촉. 그것이 날카롭게 운다." : "가시에 손이 찢긴다. 그것은 꿈쩍도 하지 않는다.");
                        if (weapon == null && dmg == 0) Body.Hurt(R, 1, "풀숲의 짐승에게 당했다");
                    }
                    else outp.Add("헛손질이다. 그것이 옆으로 튄다.");
                    noticed = true;
                }
                else if (a == "throw")
                {
                    Use(Stat.Agi);
                    R.inv.Add("stone", -1);
                    if (Chance(0.5 + agi * 0.05 + sen * 0.05))
                    {
                        bHp -= 1;
                        outp.AddRange(L("돌이 그것의 옆구리에 맞는다.", "그것이 움찔 물러선다."));
                        if (Chance(0.5)) counter = false;
                    }
                    else outp.Add("돌이 빗나가 풀숲에 떨어진다.");
                    noticed = true;
                }
                else if (a == "water")
                {
                    Know("beast_water");
                    outp.AddRange(L("개울로 뛰어든다. 차가운 물이 무릎까지 차오른다.", "", "그것이 물가에서 멈춘다.",
                        "낮게 으르렁거리며 물가를 따라 몇 번이고 오간다.", "하지만 발을 들이지 않는다.", "", "……이윽고 그것은 풀숲으로 사라진다."));
                    done = true; counter = false;
                }
                else if (a == "climb")
                {
                    Use(Stat.Agi);
                    if (Chance(0.55 + agi * 0.08))
                    {
                        climbed++;
                        outp.AddRange(L("이끼 낀 바위를 기어오른다. 손톱이 들린다.", "그것이 바위 아래를 맴돈다. 뛰어오르려다, 미끄러진다."));
                        if (climbed >= 2 || Chance(0.5)) { outp.AddRange(L("", "한참을 맴돌던 그것이 흥미를 잃은 듯 돌아선다.")); done = true; }
                        counter = false;
                    }
                    else outp.Add("이끼에 손이 미끄러진다. 바위에서 떨어진다.");
                }
                else if (a == "hide")
                {
                    Use(Stat.Sen);
                    if (Chance(0.3 + sen * 0.07 + agi * 0.07 + (noticed ? 0 : 0.3)))
                    {
                        outp.AddRange(L("고목 뒤에 몸을 붙이고 숨을 참는다.", "킁킁거리는 소리가 바로 옆을 지나간다.", "……멀어진다."));
                        done = true; counter = false;
                    }
                    else
                    {
                        outp.AddRange(L("덤불 뒤로 몸을 숨긴다.", "킁킁거리는 소리가 멈춘다.", "그리고 덤불이 갈라진다."));
                        noticed = true; counter = true;
                    }
                }
                else if (a == "flee" || a == "sneak")
                {
                    Use(Stat.Agi);
                    double p = a == "sneak" ? 0.8 : 0.4 + agi * 0.08;
                    if (Chance(p))
                    {
                        var exit = Locs[R.loc].Exits[0];
                        outp.Add(a == "sneak" ? "발끝으로 한 걸음씩 물러난다. 그것은 끝내 돌아보지 않는다." : "돌아서서 달린다. 가지가 얼굴을 할퀸다. 뒤를 돌아보지 않는다.");
                        if (a == "flee")
                        {
                            R.loc = exit.To;
                            string nm = Locs[exit.To].Name;
                            string ida = TextTools.Josa(nm, "이가") == "이" ? "이다" : "다";
                            outp.AddRange(L("", "정신을 차려 보니 " + nm + ida + ". 따라오는 소리는 없다."));
                        }
                        done = true; counter = false;
                    }
                    else
                    {
                        outp.Add("달리려는 순간 뿌리에 발이 걸린다.");
                        noticed = true; counter = true;
                    }
                }

                if (bHp <= 0 && !done)
                {
                    Know("beast_seen");
                    outp.AddRange(L("", "그것이 비틀거린다.", "찢어지는 소리를 내지르며 풀숲 속으로 달아난다.", "",
                        "풀 위에 검은 피가 점점이 떨어져 있다.", "……피에서, 희미하게 빛이 난다."));
                    done = true; counter = false;
                }
                if (counter && !done && Chance(0.55))
                {
                    if (Chance(0.1 + agi * 0.08)) outp.AddRange(L("", "그것이 뛰어든다. 몸을 비틀어 겨우 피한다."));
                    else
                    {
                        Body.Hurt(R, 2, "풀숲의 짐승에게 당했다");
                        outp.AddRange(L("", Pick(new[] { "그것이 뛰어든다. 종아리에 이빨이 박힌다.", "가시가 팔을 긁고 지나간다. 뜨거운 것이 흘러내린다.", "어깨를 물린다. 비명이 새어 나온다." })));
                    }
                }
                outp.AddRange(PassTime(5));
                if (R.hp <= 0)
                {
                    outp.AddRange(L("", "다리에 힘이 빠진다.", "풀 위로 쓰러진다. 흙 냄새가 난다.", "가시 돋친 그림자가, 천천히 다가온다."));
                    await Page(outp);
                    await More();
                    return "die";
                }
                var f = Body.HpFeeling(R);
                if (f != null && !done) outp.AddRange(L("", f));
                await Page(outp);
                if (done) { await More(); return "ok"; }
            }
        }

        // ---------- 첫 번째 이상현상: 떠 있는 빛 ----------
        async Task<string> SceneLight()
        {
            R.Mark("light");
            var lines = L("나무 사이에 무언가 떠 있다.", "빛이다. 작고, 희미하게 푸르다.",
                "반딧불처럼 보인다. 하지만 반딧불은 저렇게 움직이지 않는다.",
                "그것은 흔들리지도 않고 한 자리에 가만히 떠서……", "……나를 바라보는 것 같다.");
            if (P.Knows("light_watches")) lines.Add(Kn("……또 만났다."));
            await Page(lines);
            bool watched = false;
            int near = 0;
            while (true)
            {
                var opts = new List<Option> { new Option("다가간다", "near"), new Option("가만히 지켜본다", "watch") };
                if (watched || P.Knows("light_watches")) opts.Add(new Option("손을 뻗는다", "touch"));
                opts.Add(new Option("눈을 돌린다", "away"));
                string a = opts[await Choose(opts)].Id;
                List<Line> outp;
                bool done = true;
                if (a == "near")
                {
                    near++;
                    if (near == 1) { outp = L("한 걸음 다가선다.", "빛이 스르르 물러난다. 꼭 내가 다가선 만큼."); done = false; }
                    else outp = L("다시 다가선다.", "빛은 꺼지듯 사라진다.", "눈을 깜빡이는 사이, 그것은 어디에도 없다.");
                }
                else if (a == "watch")
                {
                    Use(Stat.Sen);
                    Know("light_watches");
                    watched = true; done = false;
                    outp = L("숨을 고르고, 가만히 지켜본다.", "빛이 천천히 맥동한다. 숨을 쉬는 것처럼.",
                        "내가 숨을 들이쉬면 밝아지고, 내쉬면 어두워진다.", "……나를 따라 하고 있다.");
                }
                else if (a == "touch")
                {
                    Use(Stat.Wil);
                    Know("light_touched");
                    P.language.spirit = Math.Min(100, P.language.spirit + 1);
                    outp = L("손을 천천히 뻗는다.", "빛이 머뭇거리다가, 손끝에 내려앉는다.", "……따뜻하다.",
                        "귓가에서, 소리가 아닌 무언가가 스친다.", "「……○△…… ○○……」",
                        "무슨 뜻인지는 모른다. 싫은 느낌은 아니었다.", "", "빛은 사라졌다. 손끝에 온기가 남아 있다.");
                }
                else outp = L("눈을 돌린다.", "다시 봤을 때, 빛은 없다.");
                outp.AddRange(PassTime(5));
                await Page(outp);
                if (done) { await More(); return "ok"; }
            }
        }

        // ---------- 첫날 밤, 이름을 부르는 목소리 ----------
        async Task<string> SceneCall()
        {
            var lines = L("……어디선가 목소리가 들린다.", "「……{이름}……」", "바람 소리였을까.", "",
                "아니다. 다시 들린다. 이번엔 조금 더 가깝다.", "「……{이름}.」", "그 소리는 분명, 내 이름의 모양을 하고 있다.");
            if (P.Knows("voice_kills")) lines.AddRange(L("", Kn("……이 목소리를 안다."), Kn("따라가면 어떻게 되는지도.")));
            await Page(lines);
            Know("name_call");
            var opts = new List<Option>
            {
                new Option("「……누구야?」 대답한다", "answer"),
                new Option("소리가 나는 쪽을 본다", "look"),
                new Option("귀를 막고 웅크린다", "ears"),
            };
            if (P.Knows("voice_kills")) opts.Add(new Option("숨을 죽인다. 절대 대답하지 않는다", "silent", "안다"));
            string a = opts[await Choose(opts)].Id;

            async Task<string> DeathBy(List<Line> pre)
            {
                Know("voice_kills");
                R.cause = "밤의 목소리를 따라갔다";
                await Page(Cat(pre, L("", "몇 걸음. 몇 걸음 더.", "목소리가 멎는다.", "", "뒤에서 누군가 내 어깨에 손을 얹는다.",
                    "차갑다.", "돌아본다.", "", "거기에는……")));
                await More();
                return "die";
            }

            if (a == "answer")
            {
                await Page(L("「……누구야?」", "", "목소리가 멎는다.", "그리고, 아주 가까이에서.", "「이쪽이야, {이름}.」", "", "……내 목소리다."));
                if (await Choose(Opts("목소리 쪽으로 간다", "뒤로 물러선다")) == 0)
                    return await DeathBy(L("나무 사이로 발을 옮긴다.", "낮에 없던 길이 나 있다. 희미하게 빛나는 길이다."));
                Use(Stat.Wil);
                await Page(Cat(L("뒷걸음질 친다. 발밑에서 가지가 부러진다.", "목소리가 뚝 끊긴다.", "",
                    "그 뒤로 한참 동안, 아무 소리도 없다.", "무언가가 어둠 속에서 나를 보고 있다는 느낌만 남는다."), PassTime(30)));
            }
            else if (a == "look")
            {
                Know("night_path");
                await Page(L("어둠 속, 나무 사이에 길이 하나 나 있다.", "낮에는 분명 없던 길이다.",
                    "길 끝에서 희미한 빛이 흔들린다.", "목소리는 그 끝에서 들린다.", "「{이름}. 이리 와.」"));
                if (await Choose(Opts("길을 따라간다", "눈을 질끈 감는다")) == 0)
                    return await DeathBy(L("홀린 듯 발을 옮긴다.", "길은 발밑에서 부드럽게 빛난다."));
                Use(Stat.Wil);
                await Page(Cat(L("눈을 감는다. 숫자를 센다. 하나, 둘, 셋……", "백을 넘겼을 때 눈을 뜬다.", "길은 없다. 원래 그랬던 것처럼."), PassTime(30)));
            }
            else
            {
                Use(Stat.Wil);
                if (a == "silent") Use(Stat.Wil);
                await Page(a == "silent"
                    ? Cat(L("입을 틀어막는다. 숨소리조차 내지 않는다.", "목소리는 몇 번 더 내 이름을 부르다가……", "……포기한 듯 멀어진다."), PassTime(30))
                    : Cat(L("귀를 막는다.", "목소리는 손가락 사이로 스며든다.", "「{이름}…… {이름}……」", "이를 악문다. 대답하지 않는다.", "",
                        "……얼마나 지났을까.", "목소리는 사라졌다."), PassTime(40)));
            }
            await More();
            return "ok";
        }

        // ---------- 상태창 해금 (첫 밤을 넘긴 새벽) ----------
        async Task<string> SceneStatus()
        {
            Body.UnlockStatus(R);
            bool again = P.Knows("status_seen");
            P.Know("status_seen");
            await Page(again
                ? L("몸을 일으킨다.", "……또 이 감각이다.", "내 몸의 상태가, 숫자로 느껴진다.", "")
                : L("몸을 일으킨다. 밤새 굳은 팔다리가 삐걱거린다.", "손을 쥐었다, 편다.", "", "……이상하다.",
                    "분명 처음 보는 몸인데……", "내 몸의 상태가, 숫자로 느껴진다.", ""));
            await Say(Body.StatusLines(R, P.name));
            await Say(L("", "대부분은 아직 흐릿하다.", "하지만 어딘가에 힘을 더 실을 수 있을 것 같다."), 700);
            int idx = await Choose(new List<Option> { new Option("지금 정한다"), new Option("나중에 정한다", hint: "언제든 몸 상태를 확인할 수 있다") });
            if (idx == 0) await Allocate();
            return "ok";
        }

        // 능력치 배분. 포인트는 회차마다 다시 받는다.
        async Task Allocate()
        {
            while (R.status.points > 0)
            {
                await Page(Cat(L("현재 능력치를 확인한다.", ""), Body.StatusLines(R, P.name)), 60);
                var opts = Body.Stats.Select(k => new Option
                {
                    Id = k.ToString(),
                    Label = Body.StatKo(k) + "에 힘을 싣는다",
                    Disabled = R[k] >= Body.StatMax,
                    Hint = R.status.known[(int)k] ? R[k].ToString() : "?",
                }).ToList();
                opts.Add(new Option { Label = "여기까지만 한다", Sep = true });
                int idx = await Choose(opts);
                if (idx >= Body.Stats.Length) break;
                var s = Body.Stats[idx];
                R[s]++;
                R.status.points--;
                if (s == Stat.Vit) Body.Heal(R, 1);
            }
            await Page(R.status.points > 0 ? L("남은 힘은 아껴 둔다.", "") : L("몸 안에서 무언가가 자리를 잡는다.", ""));
            await Say(Body.StatusLines(R, P.name), 60);
            await More();
        }

        // 몸 상태를 확인한다 (상태창이 열린 뒤 언제든)
        async Task SceneCheckBody()
        {
            string f = Body.HpFeeling(R);
            await Page(Cat(L("눈을 감고 몸에 집중한다.", ""), Body.StatusLines(R, P.name), L("", f ?? "몸은 아직 괜찮다.")));
            if (R.status.points > 0)
            {
                if (await Choose(Opts("남은 힘을 싣는다", "그만둔다")) == 0) await Allocate();
            }
            else await More();
        }

        // ---------- 첫 번째 인간: 다친 여자 ----------
        List<Line> GirlLook(GirlState g)
        {
            var s = g.state;
            var l = new List<Line>();
            if (g.bleed == 0) l.Add("팔에 짓이긴 풀이 덮여 있다. 피는 멎었다.");
            else if (s.health >= 30) l.Add("그녀는 나무에 기대어 앉아 있다. 팔을 감싼 손가락 사이로 피가 배어 나온다.");
            else l.Add("그녀의 얼굴이 창백하다. 숨이 얕고 빠르다. 팔에서 피가 계속 흐른다.");
            if (g.close) l.Add("그녀는 이제 나보다 숲 쪽을 더 살핀다.");
            else if (s.fear >= 50 || g.rel.suspicion >= 60) l.Add("손은 여전히 단검 자루 위에 있다.");
            else l.Add("단검은 무릎 옆에 내려놓여 있다.");
            return l;
        }

        async Task SceneMagic()
        {
            var g = R.girl;
            g.magicSeen = true;
            Know("magic_seen");
            P.memory.worldKnowledge++;
            await Page(L("그녀가 눈을 감는다. 다친 팔 위에 다른 손을 얹는다.", "입술이 무언가를 낮게 중얼거린다.", "",
                "……손끝이 빛난다.", "희미한, 물빛 같은 빛.", "빛이 닿은 자리에서, 찢어진 살이 천천히 오므라든다.", "",
                "숨을 쉬는 것도 잊는다.", "「……방금, 뭐 한 거예요?」", "", "그녀가 눈을 뜬다.", Speak("「[[뭐:20]]가?」"),
                "내 얼굴을 한참 들여다보더니, 무언가 알겠다는 듯 눈을 가늘게 뜬다.", Speak("「[[마법:45]]…… [[처음:30]] [[봐:30]]?」"), "",
                "뜻은 모른다.", "하지만 그 눈빛은, 이상한 것을 보는 눈빛이다.", "이 세계에서 이상한 건, 나다."));
            await More();
        }

        async Task<string> SceneInvite()
        {
            var g = R.girl;
            g.invited = true;
            var lines = L("그녀가 나무를 짚고 일어선다. 휘청이지만 쓰러지지 않는다.", "단검을 칼집에 꽂고, 숲 저편을 가리킨다.");
            if (P.Knows("smoke")) lines.Add("……비탈 위에서 봤던, 연기가 오르던 쪽이다.");
            lines.AddRange(L(Speak("「[[마을:20]].」"), "그녀가 걷는 시늉을 하고, 나를 가리키고, 다시 저편을 가리킨다.", Speak("「[[같이:30]]…… [[가:30]].」")));
            if (Learn("마을")) lines.AddRange(L("", Kn("……\"마을\". 사람이 모여 사는 곳을 말하는 것 같다.")));
            Know("village");
            await Page(lines);
            if (await Choose(Opts("그녀를 따라간다", "고개를 젓는다")) == 0) return "end:with";
            g.gone = "village";
            g.state.location = "unknown";
            await Page(L("고개를 젓는다.", "그녀는 잠시 나를 보더니, 어깨를 으쓱한다.", "그리고 걸어간다.", "돌아보지 않는다."));
            await More();
            return "ok";
        }

        async Task<string> SceneGirl()
        {
            var g = R.girl;
            if (!g.met)
            {
                g.met = true;
                g.heardStop++;
                Know("girl_hollow");
                var l = L("나무뿌리가 엉킨 움푹한 곳.", "거기, 사람이 있다.", "",
                    "젊은 여자다. 나무에 등을 기대고 앉아 있다.", "옷이 피로 젖어 있다. 한쪽 팔을 다른 손으로 꽉 부여잡고 있다.", "",
                    "마른 가지가 발밑에서 부러진다.", "그녀의 고개가 번쩍 들린다.", "팔을 쥐고 있던 손이, 허리춤의 단검으로 향한다.", "",
                    Speak("「[[거기:15]]…… [[멈춰:10]].」"), "낮고 갈라진 목소리다.");
                if (P.HasWord("멈춰")) l.Add(Kn("……\"멈춰\". 이 말을 안다."));
                else l.AddRange(L("무슨 말인지 모른다.", "……하지만 그 눈빛이 무엇을 말하는지는 안다."));
                if (P.deaths > 0 && P.Knows("girl_name")) l.AddRange(L("", Kn("……그녀다."), Kn("그녀는 나를 모른다.")));
                await Page(l);
            }
            else await Page(Cat(L("그녀는 아직 그 자리에 있다."), GirlLook(g)));

            while (true)
            {
                if (!g.alive)
                {
                    await Page(L("그녀가 더는 움직이지 않는다.", "몇 번을 불러도, 대답이 없다."));
                    await More();
                    return "ok";
                }
                if (g.Gone) return "ok";
                int pi = R.pending.IndexOf("magic");
                if (pi >= 0) { R.pending.RemoveAt(pi); await SceneMagic(); }
                // 도움을 받아 경계가 풀리면, 그녀는 남은 힘으로 상처를 치료한다
                if (!g.magicUsed && g.rel.trust >= 25)
                {
                    g.magicUsed = true;
                    g.state.health += 15;
                    g.bleed /= 2;
                    await SceneMagic();
                }
                if (!g.invited && g.magicSeen && g.rel.trust >= 40 && g.state.health >= 15)
                {
                    string r = await SceneInvite();
                    if (r != "ok") return r;
                    continue;
                }

                store?.Write(P, R);
                bool knowsName = P.Knows("girl_name") && !g.named && !g.calledName;
                var opts = new List<Option>();
                if (P.HasWord("멈춰") && !g.stopped && !g.close && !g.named && g.rel.trust < 25) opts.Add(new Option("멈춰 선다. 두 손을 펴 보인다", "stop", "말을 안다"));
                if (!g.close) opts.Add(new Option("다가간다", "near"));
                if (!g.gotWater) opts.Add(new Option("개울물을 떠다 건넨다", "water"));
                opts.Add(new Option("상처를 살펴본다", "wound"));
                opts.Add(new Option("말을 걸어 본다", "talk"));
                if (g.talked >= 2 && !g.named) opts.Add(new Option("나를 가리키며 이름을 말한다", "name"));
                if (knowsName) opts.Add(new Option("「……리아?」 이름을 불러 본다", "callname", "안다"));
                if (R.inv.Has("herb") && !g.gotHerb)
                    opts.Add(P.Knows("herb_heals") ? new Option("쓴 풀을 짓이겨 상처에 대어 준다", "herb", "안다") : new Option("쓴 냄새가 나는 풀을 건넨다", "herb"));
                if (R.inv.Has("berry") && !g.sawBerry) opts.Add(new Option("붉은 열매를 건넨다", "berry"));
                opts.Add(new Option("거리를 두고 기다린다", "wait"));
                opts.Add(new Option(R.inv.Has("stone") ? "돌을 쥐고 위협한다" : "주먹을 쥐고 위협한다", "threat"));
                opts.Add(new Option("그냥 지나간다", "leave") { Sep = true });
                string a = opts[await Choose(opts)].Id;
                var outp = new List<Line>();
                int min = 5;

                switch (a)
                {
                    case "stop":
                        g.stopped = true;
                        Npc.Relate(g, trust: 15, suspicion: -15, respect: 10);
                        outp = L("그 말을 안다.", "발을 멈춘다. 천천히 두 손을 펴 보인다.", "",
                            "그녀의 눈이 조금 커진다.", Speak("「……[[알아듣는:40]] [[거야:40]]?」"), "단검을 쥔 손에서, 힘이 조금 빠진다.");
                        break;
                    case "near":
                        if (g.rel.trust >= 25 || g.named)
                        {
                            g.close = true;
                            Npc.Relate(g, trust: 5);
                            outp = L("천천히 다가간다.", "그녀는 나를 한 번 올려다보고, 단검에서 손을 뗀다.");
                        }
                        else
                        {
                            g.heardStop++;
                            g.approach++;
                            Npc.Relate(g, fear: 10, suspicion: 10);
                            outp = L("한 걸음 다가선다.", "단검이 칼집에서 반쯤 빠져나온다.", Speak("「[[멈춰:10]]! [[멈춰:10]]!」"));
                            if (g.heardStop >= 2 && Learn("멈춰"))
                                outp.AddRange(L("", Kn("……아까부터 같은 말을 반복하고 있다."), Kn("아마, \"멈춰\"라는 뜻인 것 같다.")));
                            if (g.approach >= 3)
                            {
                                Body.Hurt(R, 2, "그녀의 단검에 베였다");
                                Npc.Relate(g, hostility: 10);
                                outp.AddRange(L("", "한 걸음 더 내딛는 순간, 칼끝이 팔을 스친다.", "뜨겁다. 피가 흐른다.", "그녀는 숨을 몰아쉬며 나를 노려본다."));
                            }
                        }
                        break;
                    case "water":
                        min = 20;
                        g.gotWater = true;
                        R.thirst = 0;
                        Npc.Relate(g, trust: 10, suspicion: -5);
                        outp = L("개울까지 가서, 넓은 잎을 접어 물을 담아 온다.", "돌아오는 사이 반은 흘렀다.", "",
                            "그녀 앞 땅바닥에 잎을 내려놓고, 뒤로 물러선다.", "그녀는 한참 나를 노려보다가…… 잎을 집어 든다.", "단숨에 마신다.", "",
                            Speak("「……[[물:10]].」"), "그녀가 빈 잎을 들어 보이며 같은 소리를 한 번 더 낸다.", "그리고 개울 쪽을 가리킨다.");
                        if (Learn("물")) outp.AddRange(L("", Kn("……물."), Kn("아마 물을 뜻하는 말이다.")));
                        break;
                    case "wound":
                        Use(Stat.Int);
                        Know("girl_wound");
                        outp = g.close
                            ? L("곁에 앉아 상처를 본다. 그녀가 팔을 조금 내밀어 준다.", "팔 위쪽이 깊게 찢겨 있다. 나란히 난 세 줄.",
                                "살이 벌어져 있다. 이대로는 피가 멎지 않을 것이다.")
                            : L("거리를 둔 채 눈으로만 살핀다.", "팔 위쪽이 깊게 찢겨 있다. 칼에 베인 상처가 아니다.", "나란히 난 세 줄.", "……세 갈래.");
                        if (P.Knows("fresh_prints")) outp.Add(Kn("개울가 진흙의, 앞이 갈라진 발자국이 떠오른다."));
                        if (!g.close) Npc.Relate(g, suspicion: 5);
                        break;
                    case "talk":
                        g.talked++;
                        if (g.talked == 1)
                        {
                            Know("lang_barrier");
                            outp = L("「저기요…… 괜찮아요?」", "", "그녀의 눈썹이 찌푸려진다.", "「……?」", "",
                                "그녀가 무언가를 되묻는다.", Speak("「[[어디:30]]서 [[왔:30]]어? [[어느:35]] [[마을:20]]?」"),
                                "……알아들을 수 없다.", "", "고개를 젓자, 그녀의 얼굴에 묘한 표정이 떠오른다.",
                                "경계가 아니다. 이해할 수 없는 것을 보는 얼굴이다.", "", "……그녀는 내 말을 모른다.", "내가 그녀의 말을 모르는 것처럼.");
                        }
                        else if (g.talked == 2)
                        {
                            Npc.Relate(g, trust: 3);
                            outp = L("다시 말을 걸어 본다. 이번엔 천천히, 손짓을 섞어서.", "", "그녀가 한숨을 쉰다.",
                                "그리고 자기 가슴을 두 번 두드린다.", "「리아.」", "한 번 더.", "「리아.」");
                        }
                        else
                            outp = L("손짓 발짓으로 무언가를 전해 보려 한다.", Speak("「[[너:25]]…… [[정말:40]] [[아무것도:40]] [[몰라:30]]?」"),
                                "그녀는 알 수 없는 말을 중얼거리며 고개를 젓는다.");
                        break;
                    case "name":
                        g.named = true;
                        Know("girl_name");
                        Npc.Relate(g, trust: 10, affection: 5);
                        outp = L("내 가슴을 가리킨다.", "「{이름}.」", "", "그녀가 눈을 깜빡인다.", "「……{이름}?」",
                            "발음이 조금 이상하다. 하지만 분명 내 이름이다.", "", "그녀가 다시 자기 가슴을 두드린다.", "「리아.」", "「……리아.」", "",
                            "그녀의 입꼬리가, 아주 조금 올라간다.");
                        break;
                    case "callname":
                        g.calledName = true;
                        Npc.Relate(g, suspicion: 25, fear: 15, trust: -5);
                        outp = L("「……리아?」", "", "그녀의 몸이 굳는다.", "단검이 완전히 뽑혀 나온다.",
                            Speak("「[[어떻게:40]]…… [[내:25]] [[이름을:35]]……?」"), "",
                            "……아차.", "이번의 그녀는, 나에게 이름을 알려 준 적이 없다.");
                        break;
                    case "herb":
                        g.gotHerb = true;
                        R.inv.Add("herb", -1);
                        g.bleed = 0;
                        if (P.Knows("herb_heals"))
                        {
                            Npc.Relate(g, trust: 20, respect: 10);
                            outp = L("쓴 풀을 두 손으로 비벼 짓이긴다.", "그녀의 팔을 가리키고, 내 손을 보여 준다.", "",
                                "그녀가 망설이다가, 팔을 내민다.", "짓이긴 풀을 상처에 꾹 누른다. 그녀가 이를 악문다.", "……피가 멎는다.", "",
                                Speak("「……[[어디:30]]서 [[배웠:40]]어?」"), "그녀가 신기하다는 듯 나를 본다.");
                        }
                        else
                        {
                            Know("herb_heals");
                            Npc.Relate(g, trust: 15, respect: 5);
                            outp = L("쓴 냄새가 나는 풀을 꺼내 내민다.", "그녀의 눈이 풀에 멎는다.", Speak("「……[[쓴잎:30]]?」"), "",
                                "그녀가 풀을 낚아챈다. 입에 넣고 씹더니, 짓이긴 것을 상처에 꾹 누른다.", "이를 악문 얼굴이 조금씩 풀린다.", "",
                                "……피가 멎는다.", Kn("그 풀은, 피를 멎게 하는 풀이었다."));
                        }
                        break;
                    case "berry":
                        g.sawBerry = true;
                        Npc.Relate(g, trust: 3);
                        outp = L("붉은 열매를 내민다.", "그녀가 내 손을 쳐낸다. 열매가 흙바닥에 흩어진다.", "",
                            Speak("「[[독:15]]! [[먹으면:40]] [[죽어:30]]!」"), "그녀가 목을 움켜쥐고, 토하는 시늉을 한다.");
                        if (Learn("독")) outp.AddRange(L("", Kn("……\"독\". 먹으면 안 된다는 말이다.")));
                        if (R.ateBerry) outp.Add("……어제 배가 뒤집혔던 게 그것 때문이었다.");
                        Know("berry_poison");
                        R.inv.Remove("berry");
                        break;
                    case "wait":
                        min = 15;
                        Npc.Relate(g, suspicion: -5);
                        outp = L("나무 하나를 사이에 두고 앉는다.", "그녀도 나도 말이 없다.", "새소리. 그녀의 얕은 숨소리.");
                        if (g.state.fear < 45) outp.Add("그녀의 어깨에서 힘이 조금 빠진다.");
                        break;
                    case "threat":
                        Npc.Relate(g, hostility: 50, trust: -30);
                        g.gone = "fled";
                        g.state.location = "unknown";
                        if (g.state.health >= 25)
                        {
                            Body.Hurt(R, 3, "그녀를 위협했다가 되레 쓰러졌다");
                            outp = L(R.inv.Has("stone") ? "돌을 쥐고 그녀를 노려본다." : "주먹을 쥐고 한 걸음 내딛는다.", "",
                                "그녀가 먼저 움직인다. 다친 사람의 움직임이 아니다.", "단검 자루가 명치에 꽂힌다. 숨이 막힌다.",
                                Speak("「[[오지:30]] [[마:30]]!」"), "", "고개를 들었을 때, 그녀는 이미 숲 속으로 사라진 뒤다.");
                        }
                        else
                            outp = L("한 걸음 내딛는다.", "그녀의 눈에 공포가 스친다.", "그녀는 다친 팔을 끌어안고, 기다시피 숲 속으로 달아난다.",
                                "핏자국이 풀 위로 길게 이어진다.");
                        outp.AddRange(PassTime(5));
                        await Page(outp);
                        await More();
                        return R.hp <= 0 ? "die" : "ok";
                    case "leave":
                        g.lastSeen = R.t;
                        R.loc = "stream";
                        return "leave";
                }

                outp.AddRange(PassTime(min));
                if (R.hp <= 0) { await Page(Cat(outp, L("", "눈앞이 어두워진다."))); await More(); return "die"; }
                if (!g.Gone && g.alive) outp.AddRange(Cat(L(""), GirlLook(g)));
                await Page(outp);
            }
        }
    }
}
