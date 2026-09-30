// 화면 아무 곳이나 누르면 알려 준다 (글 넘기기용). 선택지 버튼 위를 누른 것은 버튼이 먼저 받는다.
using System;
using UnityEngine;
using UnityEngine.EventSystems;

namespace Avernia.View
{
    public class ClickCatcher : MonoBehaviour, IPointerDownHandler
    {
        public Action onDown;

        public void OnPointerDown(PointerEventData eventData) => onDown?.Invoke();
    }
}
