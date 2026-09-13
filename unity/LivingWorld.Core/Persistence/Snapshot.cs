using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core.Persistence
{
    /// <summary>
    /// Snapshot — CORE CONTRACT 규칙 3의 저장 절반.
    ///
    /// "Snapshot + ImportantEventLog". 전체 Event Sourcing이 아니므로 Snapshot은
    /// 현재 상태 전문을 담고, 이벤트 로그는 중요 사건 6종만 담는다.
    ///
    /// 복원 검증에 필요한 것들을 빠뜨리기 쉬우므로 명시해둔다:
    /// - tick
    /// - 난수 상태 (소환 결과 재현)
    /// - ID 카운터 (이벤트/기억 ID 재현)
    /// Definition은 코드/데이터에서 오므로 Snapshot에 넣지 않는다.
    /// </summary>
    public sealed class Snapshot
    {
        public const int CurrentVersion = 1;

        public int Version = CurrentVersion;
        public int Tick;
        public uint RngState;
        public int IdCounter;
        public IReadOnlyList<CharacterInstance> Instances = new List<CharacterInstance>();
        public IReadOnlyList<WorldEvent> Events = new List<WorldEvent>();
    }

    public static class Snapshots
    {
        public static Snapshot Take(World world) => new Snapshot
        {
            Version = Snapshot.CurrentVersion,
            Tick = world.Tick,
            RngState = world.Rng.Serialize(),
            IdCounter = world.Ids.Peek(),
            Instances = world.AllInstances().ToList(),
            Events = world.Events.All().ToList(),
        };

        /// <summary>
        /// Snapshot으로 World를 되살린다. Definition은 스냅샷에 없으므로 호출자가 넘긴다 —
        /// 밸런스 수정이 세이브를 깨지 않게 하려는 의도적 설계다.
        /// </summary>
        public static World Restore(Snapshot snapshot,
                                    IEnumerable<CharacterDefinition> definitions)
        {
            AssertVersion(snapshot);
            return World.Restore(snapshot.Tick, snapshot.Instances, definitions,
                                 snapshot.RngState, snapshot.IdCounter, snapshot.Events);
        }

        public static void AssertVersion(Snapshot snapshot)
        {
            if (snapshot.Version != Snapshot.CurrentVersion)
                throw new System.InvalidOperationException(
                    $"Snapshot 버전 불일치: 파일={snapshot.Version}, 코드={Snapshot.CurrentVersion}");
        }
    }
}
