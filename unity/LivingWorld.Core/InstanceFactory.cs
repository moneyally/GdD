using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core
{
    /// <summary>시나리오/테스트가 지정하는 초기 조건. 게임 플레이 중에는 쓰이지 않는다.</summary>
    public sealed class InitialCondition
    {
        public int? Fear;
        public List<(InstanceId Target, int Trust)> Trust;
        public Personality Personality;
        public List<MemoryEntry> Memory;
    }

    /// <summary>
    /// 규칙 8 — 중복 획득은 새 Instance.
    ///
    /// 같은 Definition을 다시 획득하면 샤드가 아니라 완전히 다른 이름·성격·기억·관계를 가진
    /// 새 개체를 생성한다. 이 클래스가 그 규칙의 유일한 구현 지점이다.
    ///
    /// 결과적으로 소유권은 Definition에 귀속되고 Instance는 소모된다 —
    /// 죽음이 최종(규칙 7)이어도 결제 가치가 소멸하지 않는 구조다. 의도된 설계다.
    /// </summary>
    public static class InstanceFactory
    {
        public static CharacterInstance Create(
            CharacterDefinition definition, int tick, Rng rng, IdSequence ids,
            InitialCondition initial = null, IReadOnlyList<string> usedNames = null)
        {
            // 난수 소비 순서가 TS와 같아야 한다 — 순서가 바뀌면 시드가 같아도 결과가 달라진다
            var rolled = new Personality
            {
                Risk = RollRange(rng, definition.PersonalityRanges.Risk),
                Loyalty = RollRange(rng, definition.PersonalityRanges.Loyalty),
                Sociability = RollRange(rng, definition.PersonalityRanges.Sociability),
                Aggression = RollRange(rng, definition.PersonalityRanges.Aggression),
                Honesty = RollRange(rng, definition.PersonalityRanges.Honesty),
            };
            Personality personality = initial?.Personality ?? rolled;

            string name = PickUnusedName(rng, definition.NamePool,
                                         usedNames ?? (IReadOnlyList<string>)new List<string>());

            var relationships = (initial?.Trust ?? new List<(InstanceId, int)>())
                .Select(t => new Relationship { Target = t.Target, Trust = t.Trust })
                .ToList();

            return new CharacterInstance
            {
                InstanceId = new InstanceId(ids.Next().ToString().PadLeft(4, '0')),
                Status = LifeStatus.Alive,
                Identity = new Identity
                {
                    Name = name,
                    DefinitionId = definition.DefinitionId,
                    BornAtTick = tick,
                },
                Personality = personality,
                Needs = new Needs
                {
                    Health = definition.BaseHealth,
                    MaxHealth = definition.BaseHealth,
                    Fatigue = 0,
                },
                Emotion = new Emotion { Fear = initial?.Fear ?? 0 },
                Memory = initial?.Memory != null
                    ? new List<MemoryEntry>(initial.Memory)
                    : new List<MemoryEntry>(),
                Relationships = relationships,
                Goals = new List<Goal>(),
                Legacy = new Legacy(),
            };
        }

        private static int RollRange(Rng rng, Range range) => rng.IntBetween(range.Min, range.Max);

        /// <summary>
        /// 아직 쓰이지 않은 이름을 뽑는다. 풀이 소진되면 서수를 붙인다.
        /// 난수 소비는 어느 경로에서든 정확히 1회다 — 결정론을 깨지 않기 위함.
        /// </summary>
        private static string PickUnusedName(
            Rng rng, IReadOnlyList<string> pool, IReadOnlyList<string> used)
        {
            var free = pool.Where(n => !used.Contains(n)).ToList();
            if (free.Count > 0) return rng.Pick(free);

            string basename = rng.Pick(pool);
            for (int ordinal = 2; ; ordinal += 1)
            {
                string candidate = $"{basename} {ordinal}";
                if (!used.Contains(candidate)) return candidate;
            }
        }
    }

    /* ───────── 소환 트랜잭션 ───────── */

    public sealed class SummonRequest
    {
        public DefinitionId DefinitionId;
        public InitialCondition Initial;
    }

    public sealed class SummonTransaction : ITransaction<SummonRequest, CharacterInstance>
    {
        public string Name => "Summon";

        public string Validate(World world, SummonRequest request)
        {
            var definition = world.FindDefinition(request.DefinitionId);
            if (definition == null) return $"알 수 없는 Definition: {request.DefinitionId}";
            if (definition.NamePool.Count == 0) return $"이름 풀이 비어 있음: {request.DefinitionId}";
            return null;
        }

        public CharacterInstance Apply(World world, SummonRequest request)
        {
            var definition = world.Definition(request.DefinitionId);
            var instance = InstanceFactory.Create(
                definition, world.Tick, world.Rng, world.Ids, request.Initial,
                // 죽은 캐릭터도 포함한다 (규칙 7: 죽어도 History에 남는다)
                world.AllInstances().Select(i => i.Identity.Name).ToList());
            world.MutateAddInstance(instance);
            return instance;
        }
    }
}
