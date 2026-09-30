// 씬에 아무것도 없어도 Play 하면 스스로 화면을 만들고 게임을 시작한다.
// (카메라 배경, 캔버스, 이벤트 시스템, 글줄, 선택지, 입력칸을 모두 코드로 생성)
// 게임 로직은 Core/의 Game이 맡고, 이 클래스는 IGameView(보여 주기와 입력)만 구현한다.
using System;
using System.Collections.Generic;
using System.Text.RegularExpressions;
using System.Threading.Tasks;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace Avernia.View
{
    public class GameView : MonoBehaviour, IGameView
    {
        // 색은 웹 버전(style.css)과 같다
        static readonly Color Bg = Hex("0e1411");
        static readonly Color Fg = Hex("d9dfd6");
        static readonly Color Dim = Hex("7d8a80");
        static readonly Color LineCol = Hex("26332b");
        static readonly Color Acc = Hex("a9c9a4");
        static readonly Color ErrCol = Hex("d98b8b");
        static readonly Color BlackFg = Hex("bfc6bd");

        const int ColumnWidth = 700;   // 글 기둥 너비 (캔버스 기준 단위)
        const float BlackFade = 2.2f;  // 검은 화면 전환 시간(초)

        static readonly Regex NameRe = new Regex("^[가-힣a-zA-Z0-9 ]{1,8}$");

        [Tooltip("켜면 시작 연출과 이름 입력을 건너뛴다 (개발용)")]
        public bool devSkipIntro;

        Font font;
        Camera cam;
        RectTransform canvasRect;
        Image bg;
        ScrollRect scroll;
        VerticalLayoutGroup contentLayout;
        RectTransform story, choices;
        CanvasGroup choicesGroup;
        Text hud;
        InputField activeInput;

        bool black;
        float blackT;          // 0 = 평소, 1 = 검은 화면
        bool scrollToBottom;
        float lastWidth = -1, lastTop = -1;

        // 입력: 이번 프레임에 들어온 것. 한 번 읽으면 사라진다.
        bool pendingClick, frameAdvance;
        int frameDigit = -1;
        readonly List<TaskCompletionSource<bool>> waiters = new List<TaskCompletionSource<bool>>();

        static Color Hex(string h)
        {
            ColorUtility.TryParseHtmlString("#" + h, out var c);
            return c;
        }

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindFirstObjectByType<GameView>() == null)
                new GameObject("Avernia").AddComponent<GameView>();
        }

        void Awake()
        {
            // 출시 빌드용: Assets/Resources/AverniaFont.ttf 를 넣으면 그 폰트를 쓴다. 없으면 OS 폰트.
            font = Resources.Load<Font>("AverniaFont");
            if (font == null)
                font = Font.CreateDynamicFontFromOSFont(new[]
                {
                    "Noto Serif KR", "Nanum Myeongjo", "나눔명조", "Batang", "바탕", "AppleMyungjo",
                    "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "Noto Sans CJK KR", "Arial",
                }, 22);
            EnsureCamera();
            EnsureEventSystem();
            BuildCanvas();
        }

        async void Start()
        {
            var game = new Game(this, new FileSaveStore()) { DevSkipIntro = devSkipIntro };
            try { await game.Run(); }
            catch (Exception e) { if (this != null) Debug.LogException(e); }
        }

        // ---------- 부트스트랩 ----------
        void EnsureCamera()
        {
            cam = Camera.main;
            if (cam == null)
            {
                var go = new GameObject("Main Camera") { tag = "MainCamera" };
                cam = go.AddComponent<Camera>();
            }
            cam.clearFlags = CameraClearFlags.SolidColor;
            cam.backgroundColor = Bg;
        }

        static void EnsureEventSystem()
        {
            if (FindFirstObjectByType<EventSystem>() != null) return;
            var go = new GameObject("EventSystem", typeof(EventSystem));
#if ENABLE_INPUT_SYSTEM
            go.AddComponent<InputSystemUIInputModule>();
#else
            go.AddComponent<StandaloneInputModule>();
#endif
        }

        static RectTransform NewRect(string name, Transform parent)
        {
            var go = new GameObject(name, typeof(RectTransform));
            go.transform.SetParent(parent, false);
            return (RectTransform)go.transform;
        }

        static void Stretch(RectTransform rt)
        {
            rt.anchorMin = Vector2.zero;
            rt.anchorMax = Vector2.one;
            rt.offsetMin = Vector2.zero;
            rt.offsetMax = Vector2.zero;
        }

        static VerticalLayoutGroup AddVertical(GameObject go, float spacing)
        {
            var v = go.AddComponent<VerticalLayoutGroup>();
            v.spacing = spacing;
            v.childControlWidth = true;
            v.childControlHeight = true;
            v.childForceExpandWidth = true;
            v.childForceExpandHeight = false;
            return v;
        }

        void BuildCanvas()
        {
            canvasRect = NewRect("Canvas", transform);
            var canvas = canvasRect.gameObject.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = canvasRect.gameObject.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;
            canvasRect.gameObject.AddComponent<GraphicRaycaster>();

            var bgRt = NewRect("Background", canvasRect);
            Stretch(bgRt);
            bg = bgRt.gameObject.AddComponent<Image>();
            bg.color = Bg;
            bg.raycastTarget = false;

            // 화면 전체가 스크롤 영역이자 "클릭하면 넘기기" 영역이다
            var scrollRt = NewRect("Scroll", canvasRect);
            Stretch(scrollRt);
            var hit = scrollRt.gameObject.AddComponent<Image>();
            hit.color = new Color(0, 0, 0, 0);
            scrollRt.gameObject.AddComponent<RectMask2D>();
            scrollRt.gameObject.AddComponent<ClickCatcher>().onDown = () => pendingClick = true;
            scroll = scrollRt.gameObject.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 40;
            scroll.viewport = scrollRt;

            var content = NewRect("Content", scrollRt);
            content.anchorMin = new Vector2(0, 1);
            content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.sizeDelta = Vector2.zero;
            contentLayout = AddVertical(content.gameObject, 22);
            content.gameObject.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scroll.content = content;

            story = NewRect("Story", content);
            AddVertical(story.gameObject, 10);
            choices = NewRect("Choices", content);
            AddVertical(choices.gameObject, 8);
            choicesGroup = choices.gameObject.AddComponent<CanvasGroup>();

            var hudRt = NewRect("Hud", canvasRect);
            hudRt.anchorMin = new Vector2(0, 1);
            hudRt.anchorMax = new Vector2(1, 1);
            hudRt.pivot = new Vector2(0, 1);
            hudRt.offsetMin = new Vector2(18, -40);
            hudRt.offsetMax = new Vector2(-18, -12);
            hud = hudRt.gameObject.AddComponent<Text>();
            hud.font = font;
            hud.fontSize = 15;
            hud.color = Dim;
            hud.raycastTarget = false;
            hud.alignment = TextAnchor.UpperLeft;
        }

        // ---------- 매 프레임 ----------
        void Update()
        {
            bool typing = activeInput != null && activeInput.isFocused;
            frameAdvance = pendingClick || (!typing && KeyInput.AdvanceDown());
            pendingClick = false;
            frameDigit = typing ? -1 : KeyInput.DigitDown();

            // 검은 화면 전환
            blackT = Mathf.MoveTowards(blackT, black ? 1 : 0, Time.unscaledDeltaTime / BlackFade);
            var c = Color.Lerp(Bg, Color.black, blackT);
            bg.color = c;
            if (cam != null) cam.backgroundColor = c;
            hud.enabled = blackT < 0.5f;
            if (choicesGroup.alpha < 1) choicesGroup.alpha = Mathf.MoveTowards(choicesGroup.alpha, 1, Time.unscaledDeltaTime * 2);

            UpdateLayout();

            // 기다리던 비동기 흐름을 이어서 실행한다 (메인 스레드에서)
            if (waiters.Count > 0)
            {
                var list = waiters.ToArray();
                waiters.Clear();
                foreach (var w in list) w.TrySetResult(true);
            }
        }

        void LateUpdate()
        {
            if (!scrollToBottom) return;
            scrollToBottom = false;
            Canvas.ForceUpdateCanvases();
            scroll.verticalNormalizedPosition = 0;
        }

        // 화면 폭에 맞춰 글 기둥을 가운데에 둔다. 검은 화면에서는 글을 세로 가운데쯤으로 내린다.
        void UpdateLayout()
        {
            var size = canvasRect.rect.size;
            float top = black ? Mathf.Max(56, size.y * 0.3f) : 56;
            if (Mathf.Approximately(size.x, lastWidth) && Mathf.Approximately(top, lastTop)) return;
            lastWidth = size.x;
            lastTop = top;
            int side = Mathf.RoundToInt(Mathf.Max(20, (size.x - ColumnWidth) / 2));
            contentLayout.padding = new RectOffset(side, side, Mathf.RoundToInt(top), 120);
        }

        Task NextFrame()
        {
            var t = new TaskCompletionSource<bool>();
            waiters.Add(t);
            return t.Task;
        }

        bool ConsumeAdvance()
        {
            if (!frameAdvance) return false;
            frameAdvance = false;
            return true;
        }

        int ConsumeDigit()
        {
            int d = frameDigit;
            frameDigit = -1;
            return d;
        }

        // ---------- UI 조각 ----------
        Text AddText(Transform parent, string t, int size, Color c, TextAnchor anchor, bool rich = false)
        {
            var rt = NewRect("Text", parent);
            var tx = rt.gameObject.AddComponent<Text>();
            tx.font = font;
            tx.fontSize = size;
            tx.color = c;
            tx.text = t;
            tx.alignment = anchor;
            tx.lineSpacing = 1.15f;
            tx.horizontalOverflow = HorizontalWrapMode.Wrap;
            tx.verticalOverflow = VerticalWrapMode.Overflow;
            tx.supportRichText = rich;
            tx.raycastTarget = false;
            return tx;
        }

        static void ClearChildren(Transform t)
        {
            for (int i = t.childCount - 1; i >= 0; i--)
            {
                var go = t.GetChild(i).gameObject;
                go.SetActive(false); // 레이아웃에서 즉시 빠지도록
                Destroy(go);
            }
        }

        void AddLine(Line l)
        {
            if (string.IsNullOrEmpty(l.T))
            {
                var gap = NewRect("Gap", story);
                gap.gameObject.AddComponent<LayoutElement>().minHeight = 6;
                return;
            }
            int size = 22;
            Color c = black ? BlackFg : Fg;
            var anchor = TextAnchor.UpperLeft;
            if (l.Has("dim")) { c = Dim; size = 19; }
            if (l.Has("know")) c = Acc;
            if (l.Has("sys")) { c = Dim; size = 18; }
            if (l.Has("note")) size = 20;
            if (l.Has("stat")) { c = Acc; size = 20; anchor = TextAnchor.UpperCenter; }
            if (l.Has("head")) c = Fg;
            if (l.Has("center")) anchor = TextAnchor.UpperCenter;
            if (black) size += 2;
            string text = l.T;
            if (l.Has("death")) { c = ErrCol; size = 34; anchor = TextAnchor.UpperCenter; text = string.Join(" ", text.ToCharArray()); }
            var tx = AddText(story, text, size, c, anchor);
            tx.gameObject.AddComponent<LineFade>();
            scrollToBottom = true;
        }

        void AddSeparator(Transform parent)
        {
            var rt = NewRect("Sep", parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = LineCol;
            img.raycastTarget = false;
            var le = rt.gameObject.AddComponent<LayoutElement>();
            le.minHeight = 1;
            le.preferredHeight = 1;
        }

        Button AddButton(Transform parent, string number, string label, string hint, bool enabled, Action onClick)
        {
            var rt = NewRect("Choice", parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = Color.white;
            var h = rt.gameObject.AddComponent<HorizontalLayoutGroup>();
            h.padding = new RectOffset(16, 16, 10, 10);
            h.spacing = 12;
            h.childAlignment = TextAnchor.MiddleLeft;
            h.childControlWidth = true;
            h.childControlHeight = true;
            h.childForceExpandWidth = false;
            h.childForceExpandHeight = false;

            var btn = rt.gameObject.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.interactable = enabled;
            var cs = btn.colors;
            cs.normalColor = Hex("121a15");
            cs.highlightedColor = Hex("1c2a22");
            cs.selectedColor = Hex("121a15");
            cs.pressedColor = Hex("243629");
            cs.disabledColor = new Color(0.07f, 0.1f, 0.08f, 0.35f);
            cs.fadeDuration = 0.12f;
            btn.colors = cs;
            btn.onClick.AddListener(() => onClick());

            if (number != null)
            {
                var n = AddText(rt, number, 15, Dim, TextAnchor.MiddleLeft);
                n.gameObject.AddComponent<LayoutElement>().minWidth = 22;
            }
            var lb = AddText(rt, label, 20, enabled ? Fg : Dim, number != null ? TextAnchor.MiddleLeft : TextAnchor.MiddleCenter);
            lb.gameObject.AddComponent<LayoutElement>().flexibleWidth = 1;
            if (!string.IsNullOrEmpty(hint))
                AddText(rt, "· " + hint, 15, Acc, TextAnchor.MiddleRight);
            return btn;
        }

        InputField AddInput(Transform parent, string placeholder, int maxLength, bool center)
        {
            var rt = NewRect("Input", parent);
            var img = rt.gameObject.AddComponent<Image>();
            img.color = Hex("111814");
            rt.gameObject.AddComponent<LayoutElement>().minHeight = 46;

            var textRt = NewRect("Text", rt);
            Stretch(textRt);
            textRt.offsetMin = new Vector2(14, 6);
            textRt.offsetMax = new Vector2(-14, -6);
            var tx = textRt.gameObject.AddComponent<Text>();
            tx.font = font;
            tx.fontSize = 19;
            tx.color = Fg;
            tx.supportRichText = false; // InputField는 리치 텍스트를 쓰면 안 된다
            tx.alignment = center ? TextAnchor.MiddleCenter : TextAnchor.MiddleLeft;

            var phRt = NewRect("Placeholder", rt);
            Stretch(phRt);
            phRt.offsetMin = new Vector2(14, 6);
            phRt.offsetMax = new Vector2(-14, -6);
            var ph = phRt.gameObject.AddComponent<Text>();
            ph.font = font;
            ph.fontSize = 17;
            ph.color = Dim;
            ph.text = placeholder;
            ph.alignment = tx.alignment;
            ph.raycastTarget = false;

            // InputField는 켜질 때(OnEnable) 글 컴포넌트가 있어야 커서를 만든다. 끈 채로 설정하고 마지막에 켠다.
            rt.gameObject.SetActive(false);
            var field = rt.gameObject.AddComponent<InputField>();
            field.textComponent = tx;
            field.placeholder = ph;
            field.targetGraphic = img;
            field.characterLimit = maxLength;
            field.lineType = InputField.LineType.SingleLine;
            field.caretColor = Acc;
            field.customCaretColor = true;
            field.selectionColor = new Color(Acc.r, Acc.g, Acc.b, 0.3f);
            rt.gameObject.SetActive(true);
            activeInput = field;
            return field;
        }

        void ShowChoices()
        {
            choicesGroup.alpha = 0;
            scrollToBottom = true;
        }

        // ---------- IGameView ----------
        public async Task Say(IList<Line> lines, int paceMs)
        {
            bool skip = false;
            for (int i = 0; i < lines.Count; i++)
            {
                AddLine(lines[i]);
                if (skip || lines[i].T == "" || i == lines.Count - 1) continue;
                float end = Time.unscaledTime + paceMs / 1000f;
                while (Time.unscaledTime < end)
                {
                    await NextFrame();
                    if (ConsumeAdvance()) { skip = true; break; }
                }
            }
        }

        public async Task More()
        {
            var hint = AddText(story, "▾", 20, Dim, TextAnchor.UpperCenter);
            hint.gameObject.AddComponent<LineFade>().blink = true;
            scrollToBottom = true;
            float armAt = Time.unscaledTime + 0.3f;
            while (true)
            {
                await NextFrame();
                if (ConsumeAdvance() && Time.unscaledTime >= armAt) break;
            }
            if (hint != null) Destroy(hint.gameObject);
        }

        public async Task<Choice> Choose(IList<Option> options, bool free)
        {
            ClearChildren(choices);
            activeInput = null;
            int picked = -1;
            string text = null;
            float armAt = Time.unscaledTime + 0.3f;
            for (int i = 0; i < options.Count; i++)
            {
                var o = options[i];
                int idx = i;
                if (o.Sep) AddSeparator(choices);
                AddButton(choices, (i + 1).ToString(), o.Label, o.Hint, !o.Disabled, () =>
                {
                    if (Time.unscaledTime >= armAt) picked = idx;
                });
            }
            if (free)
            {
                var field = AddInput(choices, "무엇을 할까…  (예: 물을 마신다)", 40, false);
                field.onEndEdit.AddListener(s =>
                {
                    if (!field.wasCanceled && !string.IsNullOrWhiteSpace(s)) text = s.Trim();
                });
            }
            ShowChoices();
            while (picked < 0 && text == null)
            {
                await NextFrame();
                int d = ConsumeDigit();
                if (d >= 0 && d < options.Count && !options[d].Disabled && Time.unscaledTime >= armAt) picked = d;
            }
            ClearChildren(choices);
            activeInput = null;
            return picked >= 0 ? new Choice { Index = picked } : new Choice { Index = -1, Text = text };
        }

        public async Task<string> AskName()
        {
            ClearChildren(choices);
            string result = null;
            var field = AddInput(choices, "이름", 8, true);
            var err = AddText(choices, "", 16, ErrCol, TextAnchor.UpperCenter);
            void Submit()
            {
                string v = Regex.Replace(field.text ?? "", @"\s+", " ").Trim();
                if (!NameRe.IsMatch(v)) { err.text = "……이름이 흐릿하다. (한글·영문·숫자 1~8자)"; return; }
                result = v;
            }
            field.onEndEdit.AddListener(s => { if (!field.wasCanceled && KeyInput.SubmitDown()) Submit(); });
            AddButton(choices, null, "이 이름이다", null, true, Submit);
            ShowChoices();
            field.ActivateInputField();
            while (result == null) await NextFrame();
            ClearChildren(choices);
            activeInput = null;
            return result;
        }

        public void Clear()
        {
            ClearChildren(story);
            ClearChildren(choices);
            activeInput = null;
            scrollToBottom = false;
            scroll.verticalNormalizedPosition = 1;
        }

        public void SetHud(string text) => hud.text = text;

        public void SetBlack(bool on) => black = on;

        public async Task Wait(int ms)
        {
            float end = Time.unscaledTime + ms / 1000f;
            while (Time.unscaledTime < end) await NextFrame();
        }
    }
}
