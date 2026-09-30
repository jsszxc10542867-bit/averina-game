// 게임 로직이 화면에 요구하는 것. Unity 쪽 GameView가 구현한다.
// (로직은 이 인터페이스만 알기 때문에 Unity 없이도 테스트할 수 있다)
using System;
using System.Collections.Generic;
using System.Threading.Tasks;

namespace Avernia
{
    public class Option
    {
        public string Id;
        public string Label;
        public string Hint;    // 선택지 옆의 작은 글씨 (예: "안다")
        public bool Disabled;
        public bool Sep;       // 이 선택지 위에 구분선
        public string[] Kw;    // 자유 입력 매칭용 키워드
        public Func<List<Line>> Run;
        public string Scene;   // 선택하면 열리는 장면 (예: "body")

        public Option() { }
        public Option(string label, string id = null, string hint = null) { Label = label; Id = id; Hint = hint; }
    }

    public struct Choice
    {
        public int Index;   // 고른 선택지 (자유 입력이면 -1)
        public string Text; // 자유 입력한 글
    }

    public interface IGameView
    {
        // 줄을 하나씩 보여 준다. 클릭/Space/Enter로 나머지를 한 번에 보여 줄 수 있다.
        Task Say(IList<Line> lines, int paceMs);
        // 클릭이나 Space/Enter를 기다린다.
        Task More();
        // 선택지를 띄우고 고른 결과를 반환한다. free면 자유 입력칸도 띄운다.
        Task<Choice> Choose(IList<Option> options, bool free);
        // 이름 입력 (한글·영문·숫자 1~8자로 검증된 값을 돌려준다)
        Task<string> AskName();
        void Clear();
        void SetHud(string text);
        // 검은 화면 연출 (시작, 되감기)
        void SetBlack(bool on);
        Task Wait(int ms);
    }
}
