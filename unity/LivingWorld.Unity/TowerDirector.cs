using System.Collections;
using System.Collections.Generic;
using System.Linq;
using LivingWorld.Core;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;
using LivingWorld.Core.Mission;
using LivingWorld.Core.Scenario;
using LivingWorld.Core.Sim;
using UnityEngine;

namespace LivingWorld.UnityBridge
{
    /// <summary>
    /// 시뮬레이션을 돌리고, 벌어진 일을 **이벤트로 알리는** 씬 컨트롤러.
    ///
    /// 경계가 이 클래스의 존재 이유다:
    /// - 여기서만 Core를 호출한다 (판단·트랜잭션)
    /// - 표현 컴포넌트는 이 클래스가 던지는 이벤트만 받는다. Core를 직접 만지지 않는다
    /// - 그래서 2D → 3D → 다른 엔진 전환이 표현 층 교체로 끝난다 (CORE CONTRACT 규칙 1)
    ///
    /// 씬 설정:
    /// 1. 빈 GameObject에 이 컴포넌트를 붙인다
    /// 2. characterPrefab에 걷는 캐릭터 프리팹을 넣는다 (Mixamo + Animator면 충분)
    /// 3. spawnPoints에 4개 위치를 넣는다 (비우면 자동 배치)
    /// 4. 재생하면 콘솔에 판단 근거가 흐르고 캐릭터가 그에 맞게 움직인다
    /// </summary>
    public sealed class TowerDirector : MonoBehaviour
    {
        [Header("시드 — 같은 값이면 같은 등반이 재현된다")]
        public uint seed = 77001;

        [Header("연출 속도")]
        [Tooltip("판단 하나를 보여주고 다음으로 넘어가기까지의 시간")]
        public float decisionRevealSeconds = 1.2f;
        [Tooltip("층 사이 간격")]
        public float floorIntervalSeconds = 1.8f;

        [Header("배치")]
        public GameObject characterPrefab;
        public Transform[] spawnPoints;
        public float fallbackSpacing = 2.5f;

        [Header("명령 — 등반 중에도 바꿀 수 있다")]
        public RiskPolicy riskPolicy = RiskPolicy.Balanced;
        [Range(0f, 0.6f)] public float retreatBelowHealthRatio = 0.25f;

        /* ───────── 표현 층이 구독하는 것 ───────── */

        public delegate void PartyReady(IReadOnlyList<ActorView> views);
        public delegate void FloorEntered(int floor, int threat, InstanceId fallen, bool firstVisit);
        public delegate void DecisionMade(InstanceId actor, InstanceId subject, DecisionResult decision);
        public delegate void FloorResolved(int floor, bool rescued, IReadOnlyList<InstanceId> died);
        public delegate void ActorChanged(ActorView view);
        public delegate void RunFinished(int deepestFloor, bool cleared, string abortReason);

        public event PartyReady OnPartyReady;
        public event FloorEntered OnFloorEntered;
        public event DecisionMade OnDecisionMade;
        public event FloorResolved OnFloorResolved;
        public event ActorChanged OnActorChanged;
        public event RunFinished OnRunFinished;

        private World _world;
        private List<CharacterInstance> _party;
        private readonly Dictionary<string, AgentBrain> _brains = new Dictionary<string, AgentBrain>();

        public IReadOnlyList<ActorView> Views =>
            _party == null
                ? new List<ActorView>()
                : _party.Select(c => new ActorView(c)).ToList();

        private void Start()
        {
            _world = World.Create(seed, Definitions.All);
            _party = TowerRun.BuildParty(_world);

            SpawnActors();
            OnPartyReady?.Invoke(Views);

            StartCoroutine(Climb());
        }

        private MasterOrder CurrentOrder() => new MasterOrder
        {
            Goal = GoalOrder.Advance,
            RiskPolicy = riskPolicy,
            RetreatHealthRatioBelow = retreatBelowHealthRatio,
        };

        private void SpawnActors()
        {
            if (characterPrefab == null)
            {
                Debug.LogWarning("[TowerDirector] characterPrefab이 비어 있다 — 시뮬만 돌고 화면에는 아무것도 없다.");
                return;
            }

            for (int i = 0; i < _party.Count; i += 1)
            {
                Vector3 position = spawnPoints != null && i < spawnPoints.Length && spawnPoints[i] != null
                    ? spawnPoints[i].position
                    : transform.position + Vector3.right * (i - (_party.Count - 1) * 0.5f) * fallbackSpacing;

                var go = Instantiate(characterPrefab, position, Quaternion.identity, transform);
                go.name = _party[i].Identity.Name;

                var brain = go.GetComponent<AgentBrain>() ?? go.AddComponent<AgentBrain>();
                brain.Bind(this, _party[i].InstanceId, _party[i].Identity.Name);
                _brains[_party[i].InstanceId.Value] = brain;
            }
        }

        /// <summary>
        /// 등반 코루틴.
        ///
        /// <see cref="Tower.Run"/>을 그대로 쓰지 않는 이유: 그 함수는 한 번에 끝까지 돌린다.
        /// 화면에서는 한 층씩, 판단 하나씩 보여줘야 하므로 여기서 같은 순서를 펼친다.
        /// 판단과 결과 적용은 전부 Core 함수를 호출한다 — 규칙을 여기 복제하지 않는다.
        /// </summary>
        private IEnumerator Climb()
        {
            var reachTx = new Tower.ReachFloorTransaction();
            var resolveTx = new ResolveTransaction();
            string abortReason = null;
            int deepest = 0;

            for (int floor = 1; floor <= Tower.Floors; floor += 1)
            {
                var order = CurrentOrder();
                var living = _party.Where(c => c.IsAlive).ToList();

                if (living.Count == 0) { abortReason = "party_wiped"; break; }
                if (living.Count < Tower.MinPartyToContinue) { abortReason = "too_few_to_continue"; break; }
                if (order.RetreatHealthRatioBelow > 0 &&
                    living.All(c => (double)c.Needs.Health / c.Needs.MaxHealth < order.RetreatHealthRatioBelow))
                {
                    abortReason = "party_spent";
                    break;
                }

                _world.AdvanceTick();
                deepest = floor;

                int threat = Tower.ThreatAt(floor);
                var arrival = Transactions.Run(_world, reachTx, new Tower.ReachFloorRequest
                {
                    Floor = floor, By = living[0].InstanceId,
                });

                var fallen = _world.Rng.Pick(living);
                var others = living.Where(c => c.InstanceId != fallen.InstanceId).ToList();
                var situation = Situation.AllyDown(fallen.InstanceId, threat, _world.Tick);

                OnFloorEntered?.Invoke(floor, threat, fallen.InstanceId, arrival.Ok && arrival.Value);
                NotifyFallen(fallen);

                /* 판단 — 한 명씩 보여준다 */
                var decisions = new List<ActorDecision>();
                foreach (var actor in others)
                {
                    var decision = Decider.Decide(AgentState.Build(actor, situation, order));
                    decisions.Add(new ActorDecision
                    {
                        Actor = actor.InstanceId,
                        Action = decision.Reason.Action,
                        Plan = decision.Plan?.Steps,
                    });

                    OnDecisionMade?.Invoke(actor.InstanceId, fallen.InstanceId, decision);
                    if (_brains.TryGetValue(actor.InstanceId.Value, out var brain))
                        brain.Perform(decision, PositionOf(fallen.InstanceId));

                    yield return new WaitForSeconds(decisionRevealSeconds);
                }

                /* 결과 적용 */
                var resolved = Transactions.Run(_world, resolveTx, new ResolveRequest
                {
                    Situation = situation, Decisions = decisions,
                });
                if (!resolved.Ok)
                {
                    Debug.LogError($"[TowerDirector] 결과 적용 실패: {resolved.Error}");
                    break;
                }

                OnFloorResolved?.Invoke(floor, resolved.Value.Rescued, resolved.Value.Died);
                foreach (var c in _party) OnActorChanged?.Invoke(new ActorView(c));
                foreach (var id in resolved.Value.Died)
                    if (_brains.TryGetValue(id.Value, out var brain)) brain.Fall();

                Rest();
                yield return new WaitForSeconds(floorIntervalSeconds);
            }

            bool cleared = deepest == Tower.Floors && abortReason == null;
            OnRunFinished?.Invoke(deepest, cleared, abortReason);
        }

        private void NotifyFallen(CharacterInstance fallen)
        {
            if (_brains.TryGetValue(fallen.InstanceId.Value, out var brain)) brain.Collapse();
        }

        private Vector3 PositionOf(InstanceId id) =>
            _brains.TryGetValue(id.Value, out var brain) ? brain.transform.position : transform.position;

        /// <summary>
        /// 층 사이 휴식. <see cref="Tower"/>의 수치를 그대로 쓴다 —
        /// 밸런스 상수를 두 곳에 두면 반드시 어긋난다.
        /// </summary>
        private void Rest()
        {
            foreach (var c in _party)
            {
                if (!c.IsAlive) continue;
                int heal = JsMath.Round(c.Needs.MaxHealth * Tower.RestHealRatio);
                c.Needs.Health = Mathf.Min(c.Needs.MaxHealth, c.Needs.Health + heal);
                c.Emotion.Fear = Mathf.Max(0, c.Emotion.Fear - Tower.RestFearDecay);
                OnActorChanged?.Invoke(new ActorView(c));
            }
        }
    }
}
