// 세이브: JsonUtility로 직렬화해서 기기의 영구 저장 폴더(Application.persistentDataPath)에 파일로 쓴다.
// 저장에 실패해도 게임은 계속된다.
using System;
using System.IO;
using UnityEngine;

namespace Avernia.View
{
    [Serializable]
    class SaveData
    {
        public int v = 1;
        public PersistentState P;
        public RunState R;
    }

    public class FileSaveStore : ISaveStore
    {
        static string FilePath => Path.Combine(Application.persistentDataPath, "avernia_save.json");

        public void Write(PersistentState p, RunState r)
        {
            try { File.WriteAllText(FilePath, JsonUtility.ToJson(new SaveData { P = p, R = r })); }
            catch (Exception e) { Debug.LogWarning("저장 실패: " + e.Message); }
        }

        public bool TryRead(out PersistentState p, out RunState r)
        {
            p = null;
            r = null;
            try
            {
                if (!File.Exists(FilePath)) return false;
                var d = JsonUtility.FromJson<SaveData>(File.ReadAllText(FilePath));
                if (d == null || d.v != 1 || d.P == null || d.R == null) return false;
                p = d.P;
                r = d.R;
                return true;
            }
            catch (Exception e)
            {
                Debug.LogWarning("세이브를 읽지 못했다: " + e.Message);
                return false;
            }
        }

        public void Clear()
        {
            try { if (File.Exists(FilePath)) File.Delete(FilePath); }
            catch (Exception e) { Debug.LogWarning("세이브 삭제 실패: " + e.Message); }
        }
    }
}
