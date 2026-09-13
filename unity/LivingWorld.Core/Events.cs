using System;
using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core
{
    /// <summary>
    /// 규칙 3 — 전체 Event Sourcing이 아니다. Snapshot + ImportantEventLog 구조이며
    /// 기록 대상은 정확히 6종이다.
    /// </summary>
    public enum EventKind
    {
        Death,
        RelationshipChange,
        MajorMemory,
        MissionOutcome,
        WorldDiscovery,
        LegacyCreation,
    }

    public abstract class WorldEvent
    {
        public EventId EventId;
        /// <summary>로그 내 순서. 복원 검증에 쓰인다.</summary>
        public int Seq;
        public int Tick;
        public abstract EventKind Kind { get; }
    }

    public enum DeathCause { KilledByEnemy, Abandoned }

    public sealed class DeathEvent : WorldEvent
    {
        public override EventKind Kind => EventKind.Death;
        public InstanceId Subject;
        public DeathCause Cause;
        /// <summary>목격자 — 이들에게 기억이 생긴다.</summary>
        public IReadOnlyList<InstanceId> Witnesses = new List<InstanceId>();
    }

    public sealed class RelationshipChangeEvent : WorldEvent
    {
        public override EventKind Kind => EventKind.RelationshipChange;
        public InstanceId From;
        public InstanceId To;
        public int TrustBefore;
        public int TrustAfter;
        public string Cause;
    }

    public sealed class MajorMemoryEvent : WorldEvent
    {
        public override EventKind Kind => EventKind.MajorMemory;
        public InstanceId Owner;
        public MemoryId MemoryId;
        public MemoryTag Tag;
        public int Importance;
    }

    public enum MissionOutcomeKind { Success, Partial, Failure }

    public sealed class MissionOutcomeEvent : WorldEvent
    {
        public override EventKind Kind => EventKind.MissionOutcome;
        public IReadOnlyList<InstanceId> Participants = new List<InstanceId>();
        public MissionOutcomeKind Outcome;
        public string Summary;
    }

    public sealed class WorldDiscoveryEvent : WorldEvent
    {
        public override EventKind Kind => EventKind.WorldDiscovery;
        public InstanceId DiscoveredBy;
        public string What;
    }

    public sealed class LegacyCreationEvent : WorldEvent
    {
        public override EventKind Kind => EventKind.LegacyCreation;
        public InstanceId From;
        public IReadOnlyList<string> Relics = new List<string>();
        public IReadOnlyList<MemoryId> InheritedMemories = new List<MemoryId>();
    }

    /// <summary>
    /// append-only 이벤트 로그.
    ///
    /// 외부에 노출되는 것은 Append와 읽기뿐이다. 인덱스 대입이나 제거 경로가 없다 —
    /// 계약 테스트가 이걸 검사한다.
    /// </summary>
    public sealed class EventLog
    {
        private readonly List<WorldEvent> _entries = new List<WorldEvent>();
        private readonly IdSequence _ids;

        public EventLog(IdSequence ids, IEnumerable<WorldEvent> restored = null)
        {
            _ids = ids;
            if (restored != null) _entries.AddRange(restored);
        }

        public T Append<T>(T draft) where T : WorldEvent
        {
            draft.Seq = _entries.Count + 1;
            draft.EventId = new EventId(_ids.Next().ToString().PadLeft(6, '0'));
            _entries.Add(draft);
            return draft;
        }

        public IReadOnlyList<WorldEvent> All() => _entries;

        public IReadOnlyList<T> OfKind<T>() where T : WorldEvent =>
            _entries.OfType<T>().ToList();

        public int Count => _entries.Count;
    }
}
