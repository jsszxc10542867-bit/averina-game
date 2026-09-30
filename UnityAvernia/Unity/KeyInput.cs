// 키보드 입력. 새 Input System과 기존 Input Manager를 모두 지원한다.
// (Unity 6 새 프로젝트는 기본값이 새 Input System이라 Input.GetKeyDown을 쓰면 예외가 난다)
using UnityEngine;
#if ENABLE_INPUT_SYSTEM
using UnityEngine.InputSystem;
using UnityEngine.InputSystem.Controls;
#endif

namespace Avernia.View
{
    public static class KeyInput
    {
#if ENABLE_INPUT_SYSTEM
        static readonly Key[] Digits = { Key.Digit1, Key.Digit2, Key.Digit3, Key.Digit4, Key.Digit5, Key.Digit6, Key.Digit7, Key.Digit8, Key.Digit9, Key.Digit0 };
        static readonly Key[] Numpad = { Key.Numpad1, Key.Numpad2, Key.Numpad3, Key.Numpad4, Key.Numpad5, Key.Numpad6, Key.Numpad7, Key.Numpad8, Key.Numpad9, Key.Numpad0 };

        static bool Down(Keyboard k, Key key)
        {
            KeyControl c = k[key];
            return c != null && c.wasPressedThisFrame;
        }

        // 글 넘기기: Space / Enter
        public static bool AdvanceDown()
        {
            var k = Keyboard.current;
            return k != null && (Down(k, Key.Space) || Down(k, Key.Enter) || Down(k, Key.NumpadEnter));
        }

        public static bool SubmitDown()
        {
            var k = Keyboard.current;
            return k != null && (Down(k, Key.Enter) || Down(k, Key.NumpadEnter));
        }

        // 선택지 번호: 1~9, 0(10번째). 눌린 게 없으면 -1
        public static int DigitDown()
        {
            var k = Keyboard.current;
            if (k == null) return -1;
            for (int i = 0; i < Digits.Length; i++)
                if (Down(k, Digits[i]) || Down(k, Numpad[i])) return i;
            return -1;
        }
#else
        static readonly KeyCode[] Digits = { KeyCode.Alpha1, KeyCode.Alpha2, KeyCode.Alpha3, KeyCode.Alpha4, KeyCode.Alpha5, KeyCode.Alpha6, KeyCode.Alpha7, KeyCode.Alpha8, KeyCode.Alpha9, KeyCode.Alpha0 };
        static readonly KeyCode[] Numpad = { KeyCode.Keypad1, KeyCode.Keypad2, KeyCode.Keypad3, KeyCode.Keypad4, KeyCode.Keypad5, KeyCode.Keypad6, KeyCode.Keypad7, KeyCode.Keypad8, KeyCode.Keypad9, KeyCode.Keypad0 };

        public static bool AdvanceDown() =>
            Input.GetKeyDown(KeyCode.Space) || Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter);

        public static bool SubmitDown() => Input.GetKeyDown(KeyCode.Return) || Input.GetKeyDown(KeyCode.KeypadEnter);

        public static int DigitDown()
        {
            for (int i = 0; i < Digits.Length; i++)
                if (Input.GetKeyDown(Digits[i]) || Input.GetKeyDown(Numpad[i])) return i;
            return -1;
        }
#endif
    }
}
