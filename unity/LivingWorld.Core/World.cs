using System;
using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core
{
    /* ───────── 트랜잭션 — 규칙 4 ───────── */

    /// <summary>
    /// "싱글플레이여도 Request → Validate → Apply → Event 형태의 함수를 통해서만
    ///  소환/소비/획득이 일어난다. 상태 직접 변경 금지."
    ///
    /// MVP에는 서버도 DB도 없지만 시그니처는 지금 고정한다. 나중에 이 본문이
    /// 서버 핸들러로 이동하면 호출부는 바뀌지 않는다.
    ///
    /// 롤백: Apply 중 예외가 나면 이미 append된 이벤트를 되돌릴 수 없다.
    /// 그래서 Apply는 예외를 던지지 않게 작성하고, 검증은 전부 Validate에서 끝낸다.
    /// </summary>
    public interface ITransaction<TRequest, TResult>
    {
        string Name { get; }
        /// <summary>실패 이유를 문자열로 반환. 통과하면 null.</summary>
        string Validate(World world, TRequest request);
        TResult Apply(World world, TRequest request);
    }

    public sealed class TransactionResult<T>
    {
        public bool Ok;
        public T Value;
        public string Error;
        public IReadOnlyList<WorldEvent> Events = new List<WorldEvent>();

        public static TransactionResult<T> Failed(string error) =>
            new TransactionResult<T> { Ok = false, Error = error };
    }

    public static class Transactions
    {
        public static TransactionResult<TResult> Run<TRequest, TResult>(
            World world, ITransaction<TRequest, TResult> transaction, TRequest request)
        {
            string error = transaction.Validate(world, request);
            if (error != null)
                return TransactionResult<TResult>.Failed($"{transaction.Name}: {error}");

            int before = world.Events.Count;
            TResult value = transaction.Apply(world, request);

            return new TransactionResult<TResult>
            {
                Ok = true,
                Value = value,
                Events = world.Events.All().Skip(before).ToList(),
            };
        }
    }

    /* ───────── World — 상태 보관소 ───────── */

    /// <summary>
    /// Instance 목록, 이벤트 로그, tick, 난수 상태, ID 카운터를 들고 있다.
    /// Snapshot 저장/복원의 단위가 이 객체다.
    ///
    /// Instance는 **삽입 순서를 유지하는 리스트**로 보관한다. Dictionary만 쓰면 순서가
    /// 보장되지 않고, 이름 중복 회피와 Snapshot 직렬화 순서가 실행마다 달라진다.
    /// </summary>
    public sealed class World
    {
        private readonly List<CharacterInstance> _instances = new List<CharacterInstance>();
        private readonly Dictionary<InstanceId, CharacterInstance> _byId =
            new Dictionary<InstanceId, CharacterInstance>();
        private readonly Dictionary<DefinitionId, CharacterDefinition> _definitions =
            new Dictionary<DefinitionId, CharacterDefinition>();

        public int Tick { get; private set; }
        public Rng Rng { get; }
        public IdSequence Ids { get; }
        public EventLog Events { get; }

        private World(int tick, IEnumerable<CharacterInstance> instances,
                     IEnumerable<CharacterDefinition> definitions,
                     Rng rng, IdSequence ids, IEnumerable<WorldEvent> restoredEvents)
        {
            Tick = tick;
            Rng = rng;
            Ids = ids;
            foreach (var d in definitions) _definitions[d.DefinitionId] = d;
            foreach (var i in instances) { _instances.Add(i); _byId[i.InstanceId] = i; }
            Events = new EventLog(ids, restoredEvents);
        }

        public static World Create(uint seed, IEnumerable<CharacterDefinition> definitions) =>
            new World(0, Array.Empty<CharacterInstance>(), definitions,
                      new Rng(seed), new IdSequence(0), null);

        public static World Restore(int tick, IEnumerable<CharacterInstance> instances,
                                   IEnumerable<CharacterDefinition> definitions,
                                   uint rngState, int idCounter, IEnumerable<WorldEvent> events) =>
            new World(tick, instances, definitions, Rng.Restore(rngState),
                      IdSequence.Restore(idCounter), events);

        public CharacterDefinition FindDefinition(DefinitionId id) =>
            _definitions.TryGetValue(id, out var d) ? d : null;

        public CharacterDefinition Definition(DefinitionId id) =>
            FindDefinition(id) ?? throw new InvalidOperationException($"알 수 없는 Definition: {id}");

        public CharacterInstance Find(InstanceId id) =>
            _byId.TryGetValue(id, out var i) ? i : null;

        public CharacterInstance Instance(InstanceId id) =>
            Find(id) ?? throw new InvalidOperationException($"알 수 없는 Instance: {id}");

        public IReadOnlyList<CharacterInstance> AllInstances() => _instances;

        public IReadOnlyList<CharacterInstance> Living() =>
            _instances.Where(i => i.IsAlive).ToList();

        /// <summary>트랜잭션 전용. 직접 호출하지 않는다.</summary>
        public void MutateAddInstance(CharacterInstance instance)
        {
            if (_byId.ContainsKey(instance.InstanceId))
                throw new InvalidOperationException($"중복 Instance: {instance.InstanceId}");
            _instances.Add(instance);
            _byId[instance.InstanceId] = instance;
        }

        public int AdvanceTick() => ++Tick;
    }
}
