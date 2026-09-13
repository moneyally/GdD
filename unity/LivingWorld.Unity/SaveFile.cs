using System.IO;
using LivingWorld.Core;
using LivingWorld.Core.Data;
using LivingWorld.Core.Persistence;
using UnityEngine;

namespace LivingWorld.UnityBridge
{
    /// <summary>
    /// 세이브 파일 입출력. **경로를 아는 유일한 곳**이다.
    ///
    /// 직렬화 자체는 <see cref="SnapshotJson"/>(코어)가 하고, 여기서는 Unity가 주는
    /// 쓰기 가능한 경로만 붙인다. 규칙 1의 경계를 지키기 위한 분리다 —
    /// <c>Application.persistentDataPath</c>는 엔진 API이므로 코어에 둘 수 없다.
    ///
    /// 이 파일은 TS 구현이 쓴 세이브와 형식이 같다 (골든 대조로 검증됨).
    /// 즉 웹/도구 쪽에서 만든 세이브를 그대로 열 수 있다.
    /// </summary>
    public static class SaveFile
    {
        public const string DefaultName = "living-world.save.json";

        public static string PathFor(string fileName = DefaultName) =>
            Path.Combine(Application.persistentDataPath, fileName);

        public static bool Exists(string fileName = DefaultName) => File.Exists(PathFor(fileName));

        public static void Save(World world, string fileName = DefaultName)
        {
            string path = PathFor(fileName);
            Directory.CreateDirectory(Path.GetDirectoryName(path));

            // 임시 파일에 쓰고 교체한다 — 저장 중에 앱이 죽으면 기존 세이브가 남아야 한다.
            // 영구사망 게임에서 세이브 손상은 진행 전체를 날리는 사고다.
            string temp = path + ".tmp";
            File.WriteAllText(temp, SnapshotJson.Write(Snapshots.Take(world)));
            if (File.Exists(path)) File.Delete(path);
            File.Move(temp, path);
        }

        /// <summary>세이브가 없으면 null. 깨져 있으면 예외 — 조용히 새 게임을 시작하지 않는다.</summary>
        public static World Load(string fileName = DefaultName)
        {
            string path = PathFor(fileName);
            if (!File.Exists(path)) return null;

            Snapshot snapshot = SnapshotJson.Read(File.ReadAllText(path));
            return Snapshots.Restore(snapshot, Definitions.All);
        }
    }
}
