// 텍스트 도구: 한국어 조사 자동 처리, {이름} 치환, 언어 이해도에 따른 키워드 가리기.
// Unity에 의존하지 않는 순수 C#이다.
using System;
using System.Collections.Generic;
using System.Text;
using System.Text.RegularExpressions;

namespace Avernia
{
    public static class TextTools
    {
        static bool IsHangul(char c) => c >= '가' && c <= '힣';

        // 마지막 글자의 받침 정보. 한글이 아니면 받침 없음으로 취급한다.
        static void Tail(string word, out bool batchim, out bool rieul)
        {
            batchim = false; rieul = false;
            if (string.IsNullOrEmpty(word)) return;
            for (int i = word.Length - 1; i >= 0; i--)
            {
                char c = word[i];
                bool alnum = IsHangul(c) || (c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9');
                if (!alnum) continue;
                if (!IsHangul(c)) return;
                int jong = (c - 0xAC00) % 28;
                batchim = jong != 0;
                rieul = jong == 8;
                return;
            }
        }

        // type: "은는" "이가" "을를" "과와" "이야야" "으로"
        public static string Josa(string word, string type)
        {
            Tail(word, out bool b, out bool r);
            switch (type)
            {
                case "으로": return b && !r ? "으로" : "로";
                case "은는": return b ? "은" : "는";
                case "이가": return b ? "이" : "가";
                case "을를": return b ? "을" : "를";
                case "과와": return b ? "과" : "와";
                case "이야야": return b ? "이야" : "야";
                default: throw new ArgumentException("알 수 없는 조사: " + type);
            }
        }

        static readonly Regex FmtRe = new Regex(@"\{([^{}:]+)(?::([^{}]+))?\}");

        // {이름} → 이름, {이름:은는} → 이름 + 알맞은 조사
        public static string Fmt(string str, IDictionary<string, string> vars)
        {
            if (str == null) return "";
            return FmtRe.Replace(str, m =>
            {
                string key = m.Groups[1].Value;
                if (!vars.TryGetValue(key, out var v) || string.IsNullOrEmpty(v)) return m.Value;
                return m.Groups[2].Success ? v + Josa(v, m.Groups[2].Value) : v;
            });
        }

        static readonly Regex KeyRe = new Regex(@"\[\[([^:\]]+):(\d+)\]\]");
        static readonly Regex HangulRun = new Regex("[가-힣]+");
        static readonly Regex MultiSpace = new Regex(" {2,}");

        // [[단어:임계값]] 표기. 이해도(u, 0~100)가 임계값 이상이거나 뜻을 알아낸 단어(known)만 들린다.
        // 모든 키워드가 들리면(또는 fullAt 이상이면) 문장 전체가 그대로 보인다.
        // 들리지 않는 단어는 낯선 소리로, 키워드가 아닌 부분(어미·조사)은 지운다.
        public static string Mask(string str, int u, int? fullAt, ICollection<string> known)
        {
            var words = new List<KeyValuePair<string, int>>();
            foreach (Match m in KeyRe.Matches(str)) words.Add(new KeyValuePair<string, int>(m.Groups[1].Value, int.Parse(m.Groups[2].Value)));
            string plain = KeyRe.Replace(str, "$1");
            if (words.Count == 0) return plain;
            int full = 0;
            if (fullAt.HasValue) full = fullAt.Value;
            else foreach (var w in words) full = Math.Max(full, w.Value);
            if (u >= full) return plain;

            bool Hears(KeyValuePair<string, int> x) => u >= x.Value || (known != null && known.Contains(x.Key));
            if (!fullAt.HasValue && words.TrueForAll(x => Hears(x))) return plain;

            int i = 0;
            string s = KeyRe.Replace(str, "\u0000");
            s = HangulRun.Replace(s, "");
            var sb = new StringBuilder();
            foreach (char c in s)
            {
                if (c == '\u0000') { var x = words[i++]; sb.Append(Hears(x) ? x.Key : Foreign(x.Key)); }
                else sb.Append(c);
            }
            s = MultiSpace.Replace(sb.ToString(), " ");
            int open = s.IndexOf("「 ", StringComparison.Ordinal);
            if (open >= 0) s = s.Remove(open + 1, 1);
            return s;
        }

        // 아베르어처럼 들리는 소리. 같은 단어는 언제나 같은 소리로 들리므로, 반복되는 말을 플레이어가 알아챌 수 있다.
        static readonly string[] Syl = { "아", "베", "르", "칸", "이", "엘", "도", "사", "린", "테", "우", "메", "라", "시", "카", "노", "벨", "온", "타", "레" };

        public static string Foreign(string w)
        {
            uint h = 7;
            unchecked { foreach (char c in w) h = h * 131 + c; }
            int n = Math.Min(3, w.Length + 1);
            var sb = new StringBuilder();
            for (int k = 0; k < n; k++)
            {
                sb.Append(Syl[h % (uint)Syl.Length]);
                h = h / (uint)Syl.Length + (uint)((k + 1) * 977);
            }
            return sb.ToString();
        }
    }
}
