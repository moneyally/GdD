using System.Collections.Generic;

namespace LivingWorld.Core.Data
{
    /// <summary>
    /// Definition 데이터. MVP는 2종만 둔다 (30종 채우기는 재미 검증 이후).
    ///
    /// namePool이 여러 개인 이유는 규칙 8이다 — 같은 Definition을 두 번 소환하면
    /// 다른 이름·다른 성격의 개체가 나와야 한다.
    ///
    /// 나중에 ScriptableObject로 옮길 자리다. 지금 코드에 두는 이유는
    /// TS 쪽과 값이 같은지 골든 테스트로 검증하기 위해서다.
    /// </summary>
    public static class Definitions
    {
        public static readonly CharacterDefinition Vanguard = new CharacterDefinition
        {
            DefinitionId = new DefinitionId("vanguard"),
            Archetype = "선봉",
            NamePool = new List<string> { "라온", "세인", "도하", "유진" },
            PersonalityRanges = new PersonalityRanges
            {
                Risk = new Range(40, 60),
                Loyalty = new Range(50, 90),
                Sociability = new Range(30, 70),
                Aggression = new Range(45, 75),
                Honesty = new Range(30, 80),
            },
            BaseHealth = 100,
        };

        public static readonly CharacterDefinition Scout = new CharacterDefinition
        {
            DefinitionId = new DefinitionId("scout"),
            Archetype = "정찰",
            NamePool = new List<string> { "미라", "세라", "노아", "이린" },
            PersonalityRanges = new PersonalityRanges
            {
                Risk = new Range(45, 75),
                Loyalty = new Range(40, 80),
                Sociability = new Range(40, 80),
                Aggression = new Range(30, 60),
                Honesty = new Range(40, 90),
            },
            BaseHealth = 80,
        };

        public static readonly IReadOnlyList<CharacterDefinition> All =
            new List<CharacterDefinition> { Vanguard, Scout };
    }

    /// <summary>
    /// 한국어 조사. 로그가 "도하은"처럼 나오면 플레이어가 읽는 문장의 품질이 떨어진다.
    /// 이름이 데이터에서 오므로 문장 템플릿에 조사를 박아둘 수 없다.
    /// </summary>
    public static class Josa
    {
        private static bool HasFinalConsonant(string word)
        {
            if (string.IsNullOrEmpty(word)) return false;
            string trimmed = word.TrimEnd();
            if (trimmed.Length == 0) return false;
            int code = trimmed[trimmed.Length - 1];
            if (code < 0xac00 || code > 0xd7a3) return false;
            return (code - 0xac00) % 28 != 0;
        }

        /// <summary>은/는</summary>
        public static string Topic(string w) => w + (HasFinalConsonant(w) ? "은" : "는");
        /// <summary>을/를</summary>
        public static string Object(string w) => w + (HasFinalConsonant(w) ? "을" : "를");
        /// <summary>이/가</summary>
        public static string Subject(string w) => w + (HasFinalConsonant(w) ? "이" : "가");
    }
}
