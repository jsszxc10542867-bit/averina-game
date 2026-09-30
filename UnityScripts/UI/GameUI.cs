// 씬에 아무것도 없어도 Play 하면 스스로 UI를 만들고 실행된다.
// (캔버스, 이벤트 시스템, 카메라 배경까지 코드로 생성)
using System;
using System.Collections.Generic;
using UnityEngine;
using UnityEngine.EventSystems;
using UnityEngine.UI;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem.UI;
#endif

namespace Kwihwan
{
    public class GameUI : MonoBehaviour
    {
        enum View { Intro, Plan, Event, Result, Night, End }

        static readonly Color Bg = Hex("0d0d1a");
        static readonly Color PanelCol = Hex("16162a");
        static readonly Color Line = Hex("2a2a4a");
        static readonly Color Fg = Hex("dcd9f5");
        static readonly Color Dim = Hex("8481ad");
        static readonly Color Acc = Hex("b9a4ff");
        static readonly Color Bad = Hex("ff7d7d");
        static readonly Color Warn = Hex("ffd27d");

        GameState s;
        View view = View.Intro;
        GameEvent ev;
        string resultText;
        List<string> resultDelta = new List<string>();
        NightReport night;

        Font font;
        RectTransform content;
        ScrollRect scroll;
        Transform cur;

        static Color Hex(string h)
        {
            ColorUtility.TryParseHtmlString("#" + h, out var c);
            return c;
        }

        static string Rich(Color c) => "#" + ColorUtility.ToHtmlStringRGB(c);

        [RuntimeInitializeOnLoadMethod(RuntimeInitializeLoadType.AfterSceneLoad)]
        static void Boot()
        {
            if (FindFirstObjectByType<GameUI>() == null)
                new GameObject("KwihwanGame").AddComponent<GameUI>();
        }

        void Awake()
        {
            s = GameState.New();
            // 한글은 기본 폰트에 없으므로 OS 폰트를 쓴다. (출시 빌드에서는 Noto Sans KR 등을 포함해야 함)
            font = Font.CreateDynamicFontFromOSFont(
                new[] { "Malgun Gothic", "맑은 고딕", "Apple SD Gothic Neo", "AppleGothic", "Noto Sans CJK KR", "Arial" }, 24);
            EnsureCamera();
            EnsureEventSystem();
            BuildCanvas();
            Rebuild();
        }

        // ---------- 부트스트랩 ----------
        static void EnsureCamera()
        {
            var cam = Camera.main;
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

        void BuildCanvas()
        {
            var cgo = new GameObject("Canvas", typeof(RectTransform));
            cgo.transform.SetParent(transform, false);
            var canvas = cgo.AddComponent<Canvas>();
            canvas.renderMode = RenderMode.ScreenSpaceOverlay;
            var scaler = cgo.AddComponent<CanvasScaler>();
            scaler.uiScaleMode = CanvasScaler.ScaleMode.ScaleWithScreenSize;
            scaler.referenceResolution = new Vector2(1280, 720);
            scaler.matchWidthOrHeight = 0.5f;
            cgo.AddComponent<GraphicRaycaster>();

            var sgo = new GameObject("Scroll", typeof(RectTransform));
            sgo.transform.SetParent(cgo.transform, false);
            var srt = (RectTransform)sgo.transform;
            srt.anchorMin = Vector2.zero; srt.anchorMax = Vector2.one;
            srt.offsetMin = Vector2.zero; srt.offsetMax = Vector2.zero;
            sgo.AddComponent<Image>().color = new Color(0, 0, 0, 0);
            sgo.AddComponent<RectMask2D>();
            scroll = sgo.AddComponent<ScrollRect>();
            scroll.horizontal = false;
            scroll.vertical = true;
            scroll.movementType = ScrollRect.MovementType.Clamped;
            scroll.scrollSensitivity = 40;

            var cont = new GameObject("Content", typeof(RectTransform));
            cont.transform.SetParent(sgo.transform, false);
            content = (RectTransform)cont.transform;
            content.anchorMin = new Vector2(0, 1); content.anchorMax = new Vector2(1, 1);
            content.pivot = new Vector2(0.5f, 1);
            content.sizeDelta = Vector2.zero;
            var vlg = cont.AddComponent<VerticalLayoutGroup>();
            vlg.padding = new RectOffset(240, 240, 24, 40);
            vlg.spacing = 12;
            vlg.childControlWidth = true; vlg.childControlHeight = true;
            vlg.childForceExpandWidth = true; vlg.childForceExpandHeight = false;
            cont.AddComponent<ContentSizeFitter>().verticalFit = ContentSizeFitter.FitMode.PreferredSize;
            scroll.content = content;
        }

        // ---------- UI 조각 ----------
        Text AddText(string t, int size, Color c, TextAnchor anchor = TextAnchor.UpperLeft, FontStyle style = FontStyle.Normal)
        {
            var go = new GameObject("Text", typeof(RectTransform));
            go.transform.SetParent(cur, false);
            var tx = go.AddComponent<Text>();
            tx.font = font; tx.fontSize = size; tx.color = c; tx.text = t;
            tx.alignment = anchor; tx.fontStyle = style;
            tx.horizontalOverflow = HorizontalWrapMode.Wrap;
            tx.verticalOverflow = VerticalWrapMode.Overflow;
            tx.supportRichText = true;
            tx.raycastTarget = false;
            return tx;
        }

        void BeginPanel()
        {
            var go = new GameObject("Panel", typeof(RectTransform));
            go.transform.SetParent(content, false);
            go.AddComponent<Image>().color = PanelCol;
            var v = go.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(20, 20, 16, 16);
            v.spacing = 10;
            v.childControlWidth = true; v.childControlHeight = true;
            v.childForceExpandWidth = true; v.childForceExpandHeight = false;
            cur = go.transform;
        }

        void EndPanel() { cur = content; }

        void BeginRow()
        {
            var go = new GameObject("Row", typeof(RectTransform));
            go.transform.SetParent(cur, false);
            var h = go.AddComponent<HorizontalLayoutGroup>();
            h.spacing = 10;
            h.childControlWidth = true; h.childControlHeight = true;
            h.childForceExpandWidth = true; h.childForceExpandHeight = true;
            cur = go.transform;
        }

        void EndRow() { cur = cur.parent; }

        void AddButton(string label, string sub, bool enabled, bool on, Action cb)
        {
            var go = new GameObject("Button", typeof(RectTransform));
            go.transform.SetParent(cur, false);
            var img = go.AddComponent<Image>();
            img.color = on ? Hex("2a2450") : Hex("1d1d38");
            var v = go.AddComponent<VerticalLayoutGroup>();
            v.padding = new RectOffset(16, 16, 10, 10);
            v.childControlWidth = true; v.childControlHeight = true;
            v.childForceExpandWidth = true; v.childForceExpandHeight = true;
            var btn = go.AddComponent<Button>();
            btn.targetGraphic = img;
            btn.interactable = enabled;
            var cs = btn.colors;
            cs.normalColor = Color.white;
            cs.highlightedColor = new Color(1.25f, 1.25f, 1.25f, 1);
            cs.pressedColor = new Color(0.8f, 0.8f, 0.8f, 1);
            cs.disabledColor = new Color(1, 1, 1, 0.4f);
            btn.colors = cs;
            btn.onClick.AddListener(() => cb());

            string text = label;
            if (!string.IsNullOrEmpty(sub)) text += "  <size=16><color=" + Rich(Dim) + ">" + sub + "</color></size>";
            var parent = cur; cur = go.transform;
            AddText(text, 22, on ? Acc : Fg);
            cur = parent;
        }

        // ---------- 화면 ----------
        void Go(View v) { view = v; Rebuild(); }

        void Rebuild()
        {
            for (int i = content.childCount - 1; i >= 0; i--) Destroy(content.GetChild(i).gameObject);
            cur = content;

            if (s.Over != Ending.None) { DrawEnd(); }
            else
            {
                switch (view)
                {
                    case View.Intro: DrawIntro(); break;
                    case View.Plan: DrawHeader(); DrawPlan(); break;
                    case View.Event: DrawHeader(); DrawEvent(); break;
                    case View.Result: DrawHeader(); DrawResult(); break;
                    case View.Night: DrawHeader(); DrawNight(); break;
                }
            }
            Canvas.ForceUpdateCanvases();
            scroll.verticalNormalizedPosition = 1f;
        }

        void DrawIntro()
        {
            AddText("귀환 · 이세계 표류기", 18, Dim);
            BeginPanel();
            foreach (var line in Txt.Intro) AddText(line, 22, Fg);
            AddButton("1일차를 시작한다 →", null, true, true, () => Go(View.Plan));
            EndPanel();
        }

        void DrawHeader()
        {
            AddText("귀환 · " + s.Day + "일차 / " + Txt.MaxDay, 18, Dim);
            BeginPanel();
            BeginRow();
            int need = Rules.RationNeed(s, s.RationFull);
            Stat("식량", s.Food.ToString(), s.Food <= need);
            Stat("마력석", s.Fuel.ToString(), s.Fuel <= 2);
            Stat("약초", s.Med.ToString(), s.Med <= 0);
            Stat("사기", s.Morale + "/10", s.Morale <= 2);
            Stat("의식", s.Signal + "/" + Txt.RescueSignal, false);
            EndRow();

            var parts = new List<string>();
            foreach (var p in s.People)
            {
                string t = p.Role == Role.Hero ? "★ " + p.Name : p.Name + " · " + Txt.RoleName(p.Role);
                if (p.Sick) t += " (병)";
                string col = p.Sick ? Rich(Warn) : p.Role == Role.Hero ? Rich(Acc) : Rich(Dim);
                parts.Add("<color=" + col + ">" + t + "</color>");
            }
            AddText(string.Join("   ", parts), 18, Dim);
            EndPanel();
        }

        void Stat(string name, string value, bool low)
        {
            string col = Rich(low ? Bad : Fg);
            AddText("<size=14><color=" + Rich(Dim) + ">" + name + "</color></size>\n<color=" + col + "><size=26><b>" + value + "</b></size></color>",
                20, Fg, TextAnchor.MiddleCenter);
        }

        void DrawPlan()
        {
            BeginPanel();
            AddText("오늘의 계획", 26, Acc, TextAnchor.UpperLeft, FontStyle.Bold);
            if (Txt.Milestones.TryGetValue(s.Day, out var ms)) AddText(ms, 22, Fg);
            AddText("밤마다 결계 유지에 마력석 1이 든다. 귀환 의식은 마력석 1을 더 쓰고 의식을 올린다(대학원생은 2).\n의식이 "
                    + Txt.RescueSignal + "에 도달하면 균열이 열려 집으로 돌아간다.", 16, Dim);

            BeginRow();
            AddButton("정량 배급", "식량 " + Rules.RationNeed(s, true), true, s.RationFull, () => { s.RationFull = true; Rebuild(); });
            AddButton("절반 배급", "식량 " + Rules.RationNeed(s, false) + " · 사기 회복 없음", true, !s.RationFull, () => { s.RationFull = false; Rebuild(); });
            EndRow();
            AddButton("수색 파견 " + (s.Forage ? "ON" : "OFF"), "식량 +2 · 마력석 +1 · 20% 확률로 병자 발생", true, s.Forage,
                () => { s.Forage = !s.Forage; Rebuild(); });
            AddButton("귀환 의식 " + (s.Broadcast ? "ON" : "OFF"), "마력석 +1 소모 · 의식 +1", true, s.Broadcast,
                () => { s.Broadcast = !s.Broadcast; Rebuild(); });
            AddButton("하루를 시작한다 →", null, true, true, () => { ev = Rules.PickEvent(s); Go(View.Event); });
            EndPanel();
        }

        void DrawEvent()
        {
            BeginPanel();
            AddText(ev.Title, 26, Acc, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText(ev.Text, 22, Fg);
            for (int i = 0; i < ev.Choices.Length; i++)
            {
                int idx = i;
                var c = ev.Choices[i];
                var sub = new List<string>();
                if (c.Role.HasValue) sub.Add("[" + Txt.RoleName(c.Role.Value) + "]");
                if (c.Need != null)
                    foreach (var n in c.Need) sub.Add("-" + Txt.ResName(n.res) + " " + n.amount);
                AddButton(c.Label, string.Join(" ", sub), Rules.CanChoose(s, c), false, () =>
                {
                    resultText = Rules.RunChoice(s, ev, idx);
                    resultDelta = new List<string>(s.D);
                    Go(View.Result);
                });
            }
            EndPanel();
        }

        void DrawResult()
        {
            BeginPanel();
            AddText(resultText, 22, Fg);
            if (resultDelta.Count > 0) AddText(string.Join(" · ", resultDelta), 18, Warn);
            AddButton("밤이 된다 →", null, true, true, () => { night = Rules.EndDay(s); Go(View.Night); });
            EndPanel();
        }

        void DrawNight()
        {
            BeginPanel();
            AddText("밤", 26, Acc, TextAnchor.UpperLeft, FontStyle.Bold);
            foreach (var n in night.Notes) AddText(n, 22, Fg);
            if (night.Delta.Count > 0) AddText(string.Join(" · ", night.Delta), 18, Warn);
            AddButton(s.Over != Ending.None ? "결과 보기" : "다음 날 →", null, true, true, () => Go(View.Plan));
            EndPanel();
        }

        void DrawEnd()
        {
            DrawHeader();
            var (title, body) = Txt.EndingText(s.Over);
            BeginPanel();
            AddText(title, 26, Acc, TextAnchor.UpperLeft, FontStyle.Bold);
            AddText(body, 22, Fg);
            AddText((s.People.Count - (Rules.HeroAlive(s) ? 1 : 0)) + "명의 동료 · " + s.Day + "일차 · 의식 " + s.Signal + "/" + Txt.RescueSignal, 16, Dim);
            AddButton("다시 시작", null, true, true, () => { s = GameState.New(); view = View.Intro; Rebuild(); });
            EndPanel();
        }
    }
}
