// 이벤트 데이터. 새 이벤트는 여기 리스트에 추가하면 된다.
using System;
using static Kwihwan.Rules;
using static Kwihwan.Rng;

namespace Kwihwan
{
    public static class GameEvents
    {
        static Choice C(string label, Func<GameState, string> run) => new Choice { Label = label, Run = run };
        static Choice Cn(string label, Res res, int amt, Func<GameState, string> run) =>
            new Choice { Label = label, Need = new[] { (res, amt) }, Run = run };
        static Choice Cr(string label, Role role, Func<GameState, string> run) =>
            new Choice { Label = label, Role = role, Run = run };

        public static readonly GameEvent[] All =
        {
            new GameEvent { Id = "quiet", Title = "두 개의 달 아래", Weight = 5,
                Text = "바람이 잦아들고 숲이 조용하다. 하늘에는 여전히 달이 두 개 떠 있다. 오늘은 아무 일도 없을 것 같다.",
                Choices = new[] {
                    C("푹 쉰다", s => { Chg(s, Res.Morale, 1); return "오랜만에 다들 깊이 잠들었다."; }),
                    C("주변을 정리하며 물자를 챙긴다", s => { Chg(s, Res.Food, 1); Chg(s, Res.Fuel, 1); return "풀숲에서 마력석 조각과 열매를 조금 주웠다."; }),
                } },

            new GameEvent { Id = "footprints", Title = "세 갈래 발톱", Weight = 3,
                Text = "진흙에 사람 발자국이 아닌 흔적이 찍혀 있다. 세 갈래 발톱이다. 흔적은 숲 안쪽 둥지로 이어진다.",
                Choices = new[] {
                    C("흔적을 따라간다", s => {
                        if (Chance(0.6)) { Chg(s, Res.Food, 3); return "주인 없는 둥지에서 알과 말린 고기를 찾았다."; }
                        Lose(s); return "둥지의 주인이 돌아왔다. 돌아오지 못한 사람이 있다."; }),
                    C("결계를 강화하고 밤새 경계한다", s => { Chg(s, Res.Fuel, -1); return "아무것도 오지 않았다. 마력석만 소모됐다."; }),
                } },

            new GameEvent { Id = "stranger", Title = "숲에서 온 방랑자", Weight = 3,
                Text = "숲에서 낯선 복장의 사람이 쓰러진 채 발견됐다. 말은 알아듣기 어렵지만, 무언가를 간절히 말하려 한다.",
                Choices = new[] {
                    Cn("들여서 돌본다", Res.Food, 2, s => {
                        if (Chance(0.5)) { AddPerson(s); Chg(s, Res.Morale, 1); return "회복한 그는 이곳 말을 조금씩 가르쳐 주며 남기로 했다."; }
                        if (Chance(0.5)) { MakeSick(s); return "그는 이튿날 떠났다. 낯선 열병만 남기고."; }
                        return "그는 밤을 넘기지 못했다. 다들 말이 없다."; }),
                    Cr("간호사가 진찰한 뒤 결정한다", Role.Doctor, s => { AddPerson(s); Chg(s, Res.Food, -1); return "전염병은 아님을 확인하고 받아들였다."; }),
                    C("돌려보낸다", s => { Chg(s, Res.Morale, -2); return "덤불 너머로 신음이 새벽까지 이어졌다."; }),
                } },

            new GameEvent { Id = "ruins", Title = "무너진 유적", Weight = 4,
                Text = "이끼 낀 석조 유적이 보인다. 입구가 반쯤 무너졌고 안쪽에서 푸른 빛이 새어 나온다.",
                Choices = new[] {
                    C("깊이 들어가 뒤진다", s => {
                        if (Chance(0.35)) { Lose(s); return "천장이 무너졌다."; }
                        Chg(s, Res.Food, 3); Chg(s, Res.Fuel, 2); Chg(s, Res.Med, 1); return "보물창고였다. 마력석과 저장 식량, 약초까지 건졌다."; }),
                    C("입구 쪽만 훑는다", s => { Chg(s, Res.Food, 1); Chg(s, Res.Fuel, 1); return "안전하게 조금만 챙겼다."; }),
                } },

            new GameEvent { Id = "dashboard", Title = "버스의 계기판", Weight = 3,
                Text = "버스 잔해의 계기판이 홀로 깜빡인다. 배터리가 없는데도 불이 들어온다. 균열과 공명하고 있는 것 같다.",
                Choices = new[] {
                    Cr("기계공이 배선을 손본다", Role.Mech, s => { Chg(s, Res.Signal, 1); return "마력석을 배선에 물려 공명을 안정시켰다. 의식이 한 걸음 나아갔다."; }),
                    Cn("마력석을 더 밀어 넣는다", Res.Fuel, 2, s => "불이 안정됐다. 간신히 버틴다."),
                    C("내버려 둔다", s => { Chg(s, Res.Signal, -1); Chg(s, Res.Morale, -1); return "공명이 끊겼다. 의식이 조금 무너졌다."; }),
                } },

            new GameEvent { Id = "flu", Title = "숲의 열병", Weight = 3,
                Text = "밤새 누군가 기침을 멈추지 않는다. 이 세계의 병이라 면역이 없다. 곧 다른 사람에게도 옮을 것 같다.",
                Choices = new[] {
                    Cn("약초를 나눠 먹인다", Res.Med, 2, s => { Chg(s, Res.Morale, 1); return "큰 일 없이 지나갔다."; }),
                    C("버스 뒷좌석에 격리한다", s => { MakeSick(s); Chg(s, Res.Morale, -1); return "한 사람이 격리된 채 앓고 있다."; }),
                    Cr("간호사에게 맡긴다", Role.Doctor, s => { Chg(s, Res.Med, -1); return "적은 약초로 효과적으로 처치했다."; }),
                } },

            new GameEvent { Id = "merchant", Title = "떠돌이 상인", Weight = 3, Cond = s => s.Day >= 3,
                Text = "짐마차를 끄는 상인이 손짓 발짓으로 물물교환을 청한다. 마차에는 상자가 가득하다.",
                Choices = new[] {
                    Cn("식량 3 ↔ 약초 2", Res.Food, 3, s => { Chg(s, Res.Med, 2); return "거래가 무사히 끝났다."; }),
                    Cn("마력석 3 ↔ 식량 5", Res.Fuel, 3, s => { Chg(s, Res.Food, 5); return "넉넉한 거래였다."; }),
                    C("거래 대신 이 세계 이야기를 듣는다", s => { Chg(s, Res.Signal, 1); return "균열에 대한 전설을 들었다. 의식에 도움이 될 단서다."; }),
                } },

            new GameEvent { Id = "hunt", Title = "뿔 달린 사슴", Weight = 3,
                Text = "숲 가장자리에 뿔이 세 개 달린 사슴이 나타났다. 사냥하기 좋은 기회다.",
                Choices = new[] {
                    Cr("등산가와 함께 나선다", Role.Hunter, s => { Chg(s, Res.Food, 6); return "트래킹 솜씨로 한 마리를 잡아 왔다. 오늘 밤은 푸짐하다."; }),
                    C("아무나 보내 본다", s => {
                        if (Chance(0.35)) { Chg(s, Res.Food, 4); return "운 좋게 잡았다."; }
                        if (Chance(0.4)) { Lose(s); return "돌아오지 않았다."; }
                        return "빈손으로 돌아왔다."; }),
                    C("포기한다", s => "무리할 필요 없다."),
                } },

            new GameEvent { Id = "storm", Title = "마력 폭풍", Weight = 3,
                Text = "하늘이 보랏빛으로 물들었다. 마력 폭풍이다. 결계가 흔들리고 마물이 웅성거린다.",
                Choices = new[] {
                    Cn("마력석을 아낌없이 쓴다", Res.Fuel, 2, s => { Chg(s, Res.Morale, 1); return "결계가 버텼다. 폭풍이 지나갔다."; }),
                    C("버스 안에 모여 숨죽인다", s => { Chg(s, Res.Morale, -1); if (Chance(0.3)) MakeSick(s); return "길고 무서운 밤이었다."; }),
                } },

            new GameEvent { Id = "thief", Title = "사라진 식량", Weight = 3, Cond = s => s.People.Count >= 3 && s.Food >= 3,
                Text = "아침에 보니 식량이 없어졌다. 누군가 몰래 먹었거나 숨겼다. 마물의 짓일 수도 있지만, 흔적은 사람 발자국이다.",
                Choices = new[] {
                    C("범인을 찾아낸다", s => { Chg(s, Res.Food, 2); Chg(s, Res.Morale, -2); return "한 사람이 고개를 숙였다. 분위기가 얼어붙었다."; }),
                    C("눈감아 준다", s => { Chg(s, Res.Food, -2); Chg(s, Res.Morale, 1); return "아무도 묻지 않았다. 다만 창고가 비었다."; }),
                    Cr("교사가 대화로 푼다", Role.Teacher, s => { Chg(s, Res.Morale, 2); return "교사가 조용히 이야기를 들었다. 식량은 돌아왔다."; }),
                } },

            new GameEvent { Id = "phone", Title = "꺼진 휴대폰", Weight = 2,
                Text = "누군가 죽은 휴대폰의 갤러리를 마지막으로 한 번만 더 보고 싶다고 한다. 가족 사진이다. 충전할 방법은 없다.",
                Choices = new[] {
                    Cn("마력석으로 잠깐 켜 준다", Res.Fuel, 1, s => { Chg(s, Res.Morale, 3); return "화면이 켜졌다. 다들 모여 사진을 들여다봤다."; }),
                    C("아껴야 한다고 말한다", s => { Chg(s, Res.Morale, -1); return "그는 아무 말 없이 휴대폰을 주머니에 넣었다."; }),
                } },

            new GameEvent { Id = "raiders", Title = "도적단", Weight = 3, Cond = s => s.Day >= 6,
                Text = "숲 어귀에서 여러 사람이 다가온다. 손에 든 것은 창과 도끼다. 이쪽 캠프를 노리고 있다.",
                Choices = new[] {
                    Cn("식량 4를 내주고 돌려보낸다", Res.Food, 4, s => "그들은 물건을 받고 떠났다."),
                    C("매복해서 막는다", s => {
                        if (Chance(0.5)) { Chg(s, Res.Food, 2); Chg(s, Res.Med, 1); return "기습에 성공했다. 그들이 두고 간 물자가 있다."; }
                        Lose(s); Chg(s, Res.Food, -3); return "격렬한 교전이었다. 피해가 컸다."; }),
                    C("불을 끄고 숨는다", s => {
                        if (Chance(0.55)) return "그들은 지나쳐 갔다.";
                        Chg(s, Res.Food, -3); Chg(s, Res.Fuel, -2); return "그들이 물자를 뒤지고 갔다."; }),
                } },

            new GameEvent { Id = "rift-pulse", Title = "균열의 맥동", Weight = 2, Cond = s => s.Day >= 5 && s.Signal < 12,
                Text = "버스 뒤편의 균열이 규칙적으로 깜빡인다. 마치 이쪽에 응답하려는 것 같다.",
                Choices = new[] {
                    Cn("마력석으로 응답 파장을 보낸다", Res.Fuel, 1, s => { Chg(s, Res.Signal, 2); return "틈이 밝게 흔들렸다. 의식이 크게 나아갔다."; }),
                    Cr("대학원생에게 맡긴다", Role.Radio, s => { Chg(s, Res.Signal, 3); return "대학원생이 밤새 마법 문양을 해석했다. 의식이 훌쩍 나아갔다."; }),
                    C("무시한다", s => "맥동이 멎었다."),
                } },

            new GameEvent { Id = "song", Title = "밤의 노래", Weight = 2,
                Text = "모닥불 옆에서 누군가 흥얼거리기 시작했다. 고향에서 부르던 노래다. 어느새 다들 따라 부른다.",
                Choices = new[] {
                    C("함께 부른다", s => { Chg(s, Res.Morale, 2); return "숲도 잠깐 조용해졌다."; }),
                    C("소리가 마물을 부를까 봐 막는다", s => { Chg(s, Res.Morale, -1); return "조용하지만 답답한 밤이었다."; }),
                } },

            new GameEvent { Id = "berries", Title = "수상한 열매", Weight = 3,
                Text = "보랏빛 열매가 덤불에 가득 열려 있다. 냄새가 달콤하지만 이 세계의 독인지 모른다.",
                Choices = new[] {
                    C("전부 먹는다", s => {
                        if (Chance(0.4)) { MakeSick(s); MakeSick(s); return "배탈이 났다."; }
                        Chg(s, Res.Food, 5); return "멀쩡했다. 오히려 맛있다!"; }),
                    C("한 사람이 먼저 먹어 본다", s => { Chg(s, Res.Food, 2); return "별 탈이 없었다. 절반쯤만 챙겼다."; }),
                } },

            new GameEvent { Id = "meteor", Title = "별똥별", Weight = 2, Cond = s => s.Day >= 8,
                Text = "하늘에서 무언가 떨어지는 것이 보였다. 마력석이 섞인 유성이다. 낙하지점은 두 곳이고 한 곳만 갈 수 있다.",
                Choices = new[] {
                    C("동쪽 (가깝다, 작다)", s => { Chg(s, Res.Food, 3); Chg(s, Res.Fuel, 2); return "작은 파편을 주웠다."; }),
                    C("서쪽 (멀다, 크다)", s => {
                        if (Chance(0.55)) { Chg(s, Res.Food, 6); Chg(s, Res.Fuel, 4); Chg(s, Res.Med, 2); return "거대한 마력석 덩어리와 열매숲을 발견했다!"; }
                        Chg(s, Res.Morale, -2); return "이미 도적단이 훑고 지나간 뒤였다."; }),
                } },

            new GameEvent { Id = "leave", Title = "떠나자는 사람", Weight = 3, Cond = s => s.People.Count >= 3 && s.Morale <= 6,
                Text = "한 사람이 짐을 꾸린다. \"남쪽에 성이 있대. 기사단이 보호해 준다는 소문도 있어. 여기서 이러고 있을 순 없어.\"",
                Choices = new[] {
                    C("붙잡고 설득한다", s => {
                        if (Chance(0.5)) { Chg(s, Res.Morale, 1); return "결국 남기로 했다."; }
                        Lose(s); return "그는 새벽에 몰래 떠났다."; }),
                    Cn("식량을 챙겨 보내 준다", Res.Food, 2, s => { Leave(s); return "그는 숲길 너머로 사라졌다."; }),
                } },

            new GameEvent { Id = "shadow-wolf", Title = "그림자 늑대", Weight = 2, Cond = s => s.Day >= 4,
                Text = "밤에 결계 밖에서 눈 여섯 개짜리 그림자가 어른거린다. 식량 냄새를 맡았다.",
                Choices = new[] {
                    Cn("결계를 키워 쫓는다", Res.Fuel, 2, s => "그림자들이 물러났다."),
                    Cr("등산가가 나선다", Role.Hunter, s => { Chg(s, Res.Food, 3); return "한 마리를 잡고 나머지는 쫓았다."; }),
                    C("버스 문을 걸어 잠근다", s => {
                        if (Chance(0.5)) { Chg(s, Res.Food, -3); return "식량 창고가 뜯겼다."; }
                        return "새벽에 물러갔다."; }),
                } },

            new GameEvent { Id = "diary", Title = "모험가의 일지", Weight = 2,
                Text = "숲에서 백골이 된 모험가의 가방을 찾았다. 일지의 마지막 장에 지도가 그려져 있다.",
                Choices = new[] {
                    C("지도를 따라가 본다", s => {
                        if (Chance(0.55)) { Chg(s, Res.Med, 2); Chg(s, Res.Food, 2); return "지도가 가리킨 곳에 비축 창고가 있었다."; }
                        Chg(s, Res.Fuel, -1); return "아무것도 없었다. 헛걸음이다."; }),
                    C("일지를 읽고 조용히 묻어 준다", s => { Chg(s, Res.Morale, 1); return "낯선 세계의 누군가를 기억하기로 했다."; }),
                } },

            new GameEvent { Id = "moons", Title = "달이 겹치는 밤", Weight = 2, Cond = s => s.Day >= 10,
                Text = "두 개의 달이 하늘에서 겹친다. 균열이 눈에 띄게 밝아졌다. 지금이 의식을 하기에 가장 좋은 때라고 대학원생이 말한다.",
                Choices = new[] {
                    Cn("마력석 3을 모두 쏟아붓는다", Res.Fuel, 3, s => { Chg(s, Res.Signal, 4); return "균열이 크게 벌어졌다. 이 밤을 놓치지 않았다."; }),
                    C("무리하지 않고 지켜본다", s => { Chg(s, Res.Morale, 1); return "달이 겹치는 모습은 놀랍도록 아름다웠다."; }),
                } },

            new GameEvent { Id = "knight", Title = "순찰 기사", Weight = 2, Cond = s => s.Day >= 7,
                Text = "갑옷을 입은 낯선 기사 한 명이 캠프 앞에 멈췄다. 말이 통하지 않지만, 악의는 없어 보인다.",
                Choices = new[] {
                    Cn("식량을 나눠 주며 환대한다", Res.Food, 2, s => { Chg(s, Res.Morale, 1); Chg(s, Res.Med, 1); return "기사는 약초 한 다발을 남기고 손짓하며 떠났다."; }),
                    Cr("교사가 손짓으로 대화를 시도한다", Role.Teacher, s => { Chg(s, Res.Signal, 1); Chg(s, Res.Morale, 1); return "몇 마디를 배웠다. 이 세계와 균열에 대한 소문도 들었다."; }),
                    C("경계하며 물러선다", s => "기사는 잠시 살피다 떠났다."),
                } },
        };
    }
}
