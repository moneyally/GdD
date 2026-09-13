using System;
using System.IO;

namespace LivingWorld.Core.Tests
{
    /// <summary>
    /// 골든 파일 위치 찾기. 테스트는 bin/Debug/... 에서 실행되므로 레포 루트를 거슬러 올라간다.
    /// </summary>
    public static class TestPaths
    {
        public static string GoldenDir()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                string candidate = Path.Combine(dir.FullName, "golden");
                if (Directory.Exists(candidate)) return candidate;
                dir = dir.Parent;
            }
            throw new DirectoryNotFoundException(
                "golden/ 를 찾지 못했다. 레포 루트에서 `npm run golden` 을 먼저 실행할 것.");
        }

        public static string ReadGolden(string name) =>
            File.ReadAllText(Path.Combine(GoldenDir(), name));

        /// <summary>
        /// 줄끝과 마지막 개행을 정규화한다. 골든 파일은 끝에 개행이 하나 붙어 있고,
        /// git 설정에 따라 CRLF로 체크아웃될 수 있다 — 그 두 가지는 세이브 형식의 차이가 아니다.
        /// </summary>
        public static string NormalizeText(string text) =>
            text.Replace("\r\n", "\n").TrimEnd('\n');
    }
}
