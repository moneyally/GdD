using System;
using System.Globalization;

namespace LivingWorld.Core
{
    /// <summary>
    /// JS와 결과를 일치시키기 위한 산술 헬퍼.
    ///
    /// C# <c>Math.Round</c>는 기본이 은행가 반올림(0.5를 짝수로)이라 JS <c>Math.round</c>와
    /// 다르다. 피해량 한 점이 생사를 가르는 코드에서 이 차이는 그냥 버그다.
    /// </summary>
    public static class JsMath
    {
        /// <summary>JS Math.round — 0.5는 항상 올림.</summary>
        public static int Round(double value) => (int)Math.Floor(value + 0.5);

        public static double Clamp(double value, double min, double max) =>
            Math.Min(max, Math.Max(min, value));

        public static int ClampInt(int value, int min, int max) =>
            Math.Min(max, Math.Max(min, value));

        /// <summary>
        /// JS의 숫자 → 문자열. ReasonCode 문자열이 언어에 따라 달라지면 안 되므로
        /// 불필요한 0을 붙이지 않는 JS 방식을 따른다 (0.5 → "0.5", 1 → "1").
        /// </summary>
        public static string Str(double value) =>
            value.ToString("R", CultureInfo.InvariantCulture);
    }

    /// <summary>
    /// CHD_ — 개발자가 정의하는 정적 설계.
    ///
    /// TS에서는 branded type으로 막았던 것을 C#에서는 타입으로 막는다.
    /// DefinitionId가 들어갈 자리에 InstanceId를 넣으면 컴파일되지 않는다 —
    /// 4단 분리에서 가장 흔한 사고를 타입 검사로 차단하는 것이 목적이다 (규칙 1).
    /// </summary>
    public readonly struct DefinitionId : IEquatable<DefinitionId>
    {
        public const string Prefix = "CHD_";
        public string Value { get; }

        public DefinitionId(string raw)
        {
            if (string.IsNullOrEmpty(raw)) throw new ArgumentException("빈 DefinitionId", nameof(raw));
            Value = raw.StartsWith(Prefix, StringComparison.Ordinal) ? raw : Prefix + raw;
        }

        public bool Equals(DefinitionId other) => string.Equals(Value, other.Value, StringComparison.Ordinal);
        public override bool Equals(object obj) => obj is DefinitionId o && Equals(o);
        public override int GetHashCode() => Value == null ? 0 : Value.GetHashCode();
        public override string ToString() => Value;
        public static bool operator ==(DefinitionId a, DefinitionId b) => a.Equals(b);
        public static bool operator !=(DefinitionId a, DefinitionId b) => !a.Equals(b);
    }

    /// <summary>CHR_ — 플레이어가 소유하는 영속 개체.</summary>
    public readonly struct InstanceId : IEquatable<InstanceId>
    {
        public const string Prefix = "CHR_";
        public string Value { get; }

        public InstanceId(string raw)
        {
            if (string.IsNullOrEmpty(raw)) throw new ArgumentException("빈 InstanceId", nameof(raw));
            Value = raw.StartsWith(Prefix, StringComparison.Ordinal) ? raw : Prefix + raw;
        }

        public bool Equals(InstanceId other) => string.Equals(Value, other.Value, StringComparison.Ordinal);
        public override bool Equals(object obj) => obj is InstanceId o && Equals(o);
        public override int GetHashCode() => Value == null ? 0 : Value.GetHashCode();
        public override string ToString() => Value;
        public static bool operator ==(InstanceId a, InstanceId b) => a.Equals(b);
        public static bool operator !=(InstanceId a, InstanceId b) => !a.Equals(b);
    }

    /// <summary>MEM_ — 기억.</summary>
    public readonly struct MemoryId : IEquatable<MemoryId>
    {
        public const string Prefix = "MEM_";
        public string Value { get; }

        public MemoryId(string raw)
        {
            if (string.IsNullOrEmpty(raw)) throw new ArgumentException("빈 MemoryId", nameof(raw));
            Value = raw.StartsWith(Prefix, StringComparison.Ordinal) ? raw : Prefix + raw;
        }

        public bool Equals(MemoryId other) => string.Equals(Value, other.Value, StringComparison.Ordinal);
        public override bool Equals(object obj) => obj is MemoryId o && Equals(o);
        public override int GetHashCode() => Value == null ? 0 : Value.GetHashCode();
        public override string ToString() => Value;
        public static bool operator ==(MemoryId a, MemoryId b) => a.Equals(b);
        public static bool operator !=(MemoryId a, MemoryId b) => !a.Equals(b);
    }

    /// <summary>EVT_ — 세계에 남는 사건.</summary>
    public readonly struct EventId
    {
        public const string Prefix = "EVT_";
        public string Value { get; }

        public EventId(string raw)
        {
            Value = raw.StartsWith(Prefix, StringComparison.Ordinal) ? raw : Prefix + raw;
        }

        public override string ToString() => Value;
    }

    /// <summary>GOL_ — 목표.</summary>
    public readonly struct GoalId
    {
        public const string Prefix = "GOL_";
        public string Value { get; }

        public GoalId(string raw)
        {
            Value = raw.StartsWith(Prefix, StringComparison.Ordinal) ? raw : Prefix + raw;
        }

        public override string ToString() => Value;
    }

    /// <summary>
    /// 결정론적 ID 발급기. 카운터는 Snapshot에 저장되어 함께 복원된다.
    /// 시계나 GUID가 들어가면 "저장 → 재시작 → 동일 Event Log"가 깨진다.
    /// </summary>
    public sealed class IdSequence
    {
        private int _counter;

        public IdSequence(int counter = 0) => _counter = counter;

        public int Next() => ++_counter;
        public int Peek() => _counter;

        public static IdSequence Restore(int counter) => new IdSequence(counter);
    }
}
