// 글줄이 나타날 때 서서히 보이게 한다. blink면 ▾ 표시처럼 계속 깜빡인다.
using UnityEngine;
using UnityEngine.UI;

namespace Avernia.View
{
    public class LineFade : MonoBehaviour
    {
        public bool blink;
        public float duration = 0.7f;

        Graphic g;
        float t;
        float baseAlpha;

        void Awake()
        {
            g = GetComponent<Graphic>();
            if (g == null) { enabled = false; return; }
            baseAlpha = g.color.a;
            SetAlpha(0);
        }

        void Update()
        {
            t += Time.unscaledDeltaTime;
            if (blink)
            {
                SetAlpha(baseAlpha * (0.2f + 0.8f * (0.5f + 0.5f * Mathf.Sin(t * Mathf.PI / 0.8f - Mathf.PI / 2))));
                return;
            }
            SetAlpha(baseAlpha * Mathf.Clamp01(t / duration));
            if (t >= duration) Destroy(this);
        }

        void SetAlpha(float a)
        {
            var c = g.color;
            c.a = a;
            g.color = c;
        }
    }
}
