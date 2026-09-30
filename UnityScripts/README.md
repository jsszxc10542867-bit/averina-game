# 귀환 — Unity 버전 (프로토타입)

## 사용법
1. Unity Hub에서 **Unity 6 LTS**를 설치하고, 템플릿 **2D (Built-in) 또는 Universal 2D**로 새 프로젝트를 만든다.
2. 이 폴더의 `Core`, `UI` 폴더를 프로젝트의 `Assets/Scripts/` 아래로 복사한다.
3. 아무 씬이나 열고 **Play**를 누른다. 카메라·캔버스·EventSystem·UI를 모두 코드로 만든다. 씬 편집은 필요 없다.

## 구조
| 파일 | 역할 |
|---|---|
| `Core/GameCore.cs` | 상태, 자원, 밤 처리, 엔딩 판정. Unity에 의존하지 않는 순수 C# |
| `Core/GameEvents.cs` | 이벤트 20종 데이터. 새 이벤트는 배열에 추가하면 된다 |
| `UI/GameUI.cs` | uGUI를 코드로 생성하고 화면 전환 (인트로/계획/이벤트/결과/밤/엔딩) |

## 알려진 사항
- 한글 폰트는 OS 폰트(맑은 고딕 등)를 동적으로 불러온다. 스팀 출시용 빌드에서는 Noto Sans KR 같은 폰트를 포함하고 TextMeshPro로 옮겨야 한다.
- 이 코드는 Unity 에디터에서 아직 실행해 보지 않았다. 컴파일 오류가 나면 콘솔 메시지를 알려 달라.
- Input System 패키지가 활성화된 프로젝트와 기존 Input Manager 프로젝트 모두 지원한다.
