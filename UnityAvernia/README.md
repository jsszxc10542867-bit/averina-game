# 아베르니아 — Unity 버전 (1장 「이름 없는 숲」)

웹 버전(`index.html` + `js/`)과 같은 게임을 Unity C#으로 옮긴 것이다. 내용, 선택지, 확률, 저장 구조가 모두 같다.

## 사용법
1. Unity Hub에서 **Unity 6 LTS**를 설치하고, 템플릿 **Universal 2D**(또는 2D Built-in)로 새 프로젝트를 만든다.
2. 이 폴더(`UnityAvernia`)를 통째로 프로젝트의 `Assets/` 아래에 복사한다.
3. 아무 씬이나 열고 **Play**를 누른다. 카메라 배경, 캔버스, EventSystem, 글줄과 선택지를 모두 코드로 만든다. 씬 편집은 필요 없다.

> ⚠ 예전 게임 「귀환」의 `UnityScripts/` 폴더를 같은 프로젝트에 함께 넣지 말 것. 두 게임이 동시에 켜진다.

## 조작
| 입력 | 동작 |
|---|---|
| 클릭 / 터치 / Space / Enter | 글 넘기기, ▾ 다음으로 |
| 선택지 클릭 또는 숫자키 1~9, 0 | 선택 (0은 10번째) |
| 아래 입력칸에 글을 쓰고 Enter | 자유 입력 (예: "물을 마신다" → 가장 맞는 행동) |

## 구조
| 폴더 / 파일 | 역할 |
|---|---|
| `Core/` | **Unity에 의존하지 않는 순수 C#.** 게임의 모든 규칙과 글이 여기 있다 |
| `Core/Game.cs` | 흐름: 시작 연출 → 기억 → 이름 → 숲 탐색 → 죽음과 되감기 → 1장 끝 |
| `Core/Scenes.cs` | 장면: 짐승(첫 위험), 빛(첫 이상현상), 밤의 목소리, 상태창·능력치 배분, 리아 |
| `Core/World.cs` | 장소 7곳, 행동, 알아낸 것(지식) 20종, 저녁·밤·새벽 사건 |
| `Core/State.cs` | 유지 상태(죽어도 남음)와 회차 상태(죽으면 초기화). JsonUtility로 그대로 저장된다 |
| `Core/Body.cs` | 체력, 갈증, 허기, 능력치와 능력치 이해도 |
| `Core/Npc.cs` | 리아의 독립 상태(출혈, 스스로 치료, 떠남)와 숨겨진 관계 수치 |
| `Core/TextTools.cs` | 한국어 조사 자동 처리, `{이름}` 치환, `[[단어:임계값]]` 언어 가리기 |
| `Core/IGameView.cs` | 로직이 화면에 요구하는 것 (Say / More / Choose / AskName …) |
| `Unity/GameView.cs` | IGameView 구현. uGUI를 코드로 만들고 입력을 받는다 |
| `Unity/FileSaveStore.cs` | 세이브: `Application.persistentDataPath/avernia_save.json` |
| `Unity/KeyInput.cs` | 키보드. 새 Input System / 기존 Input Manager 둘 다 지원 |

새 장소나 행동은 `World.cs`의 `BuildLocations()`에, 새 장면은 `Scenes.cs`에 추가하고 `Game.RunScene()`에 이름을 등록하면 된다.

## 개발용
- `Avernia` 오브젝트의 **Dev Skip Intro**는 Play 중에 켜도 소용없다(시작할 때 한 번 읽는다). 시작 연출을 건너뛰려면 `GameView.cs`의 `devSkipIntro` 기본값을 `true`로 바꾼다.
- 세이브를 지우려면 게임 안에서 "처음부터 한다"를 고르거나 `avernia_save.json`을 지운다.

## 알려진 사항
- 한글은 OS 폰트(바탕, 맑은 고딕 등)를 동적으로 불러온다. **출시 빌드(특히 안드로이드)**에서는 Noto Serif KR 같은 폰트 파일을 `Assets/Resources/AverniaFont.ttf`로 넣으면 그 폰트를 쓴다. 이후 TextMeshPro로 옮기는 것을 권장한다.
- 이 코드는 **Unity 에디터에서 아직 실행해 보지 않았다.** Unity가 없는 환경에서 다음 두 가지로만 검증했다.
  - `Core/`를 .NET으로 컴파일하고 가짜 화면으로 자동 플레이했다. 대본 2개, 무작위 3000판, 저장/이어하기에서 예외는 없었다.
  - `Unity/`는 Unity API를 흉내 낸 스텁으로 컴파일만 확인했다.
- 컴파일 오류나 화면이 이상한 부분이 있으면 콘솔 메시지나 스크린샷을 알려 달라.
