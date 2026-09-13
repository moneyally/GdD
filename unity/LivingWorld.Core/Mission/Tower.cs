using System;
using System.Collections.Generic;
using System.Linq;
using LivingWorld.Core.Decision;
using LivingWorld.Core.Sim;

namespace LivingWorld.Core.Mission
{
    /// <summary>
    /// 탑 등반.
    ///
    /// 게임 정의의 한 문장이 "탑은 이전 등반자들의 실패를 기억한다"이므로, 탑은 단순한
    /// 스테이지 묶음이 아니라 **기록의 장소**다. 좌표 도달은 WorldDiscovery로 남고,
    /// 같은 좌표를 다시 오르면 다시 발견되지 않는다.
    ///
    /// 좌표마다: 위협 상승 → 한 명이 쓰러짐 → 나머지가 각자 판단 → 결과 적용 → 피로 누적.
    ///
    /// 주의: 이 구현은 아직 **선형 등반**이다. 차원문 선택(docs/proposal/holo-gates.md)은
    /// 웹 프로토타입에만 있고 여기로 역이식해야 한다.
    /// </summary>
    public static class Tower
    {
        public const int Floors = 10;
        /// <summary>1층 25 → 10층 70.</summary>
        public static int ThreatAt(int floor) => 20 + floor * 5;
        public const int RestFearDecay = 4;
        /// <summary>
        /// 층 사이 체력 회복 비율.
        ///
        /// 회복이 없으면 체력이 단조 감소만 하므로 누적 피해가 총 체력을 넘는 층에서 등반이
        /// 반드시 멈춘다 — 실측 200회 전부 8층 미달이었다. 10층이 존재하지만 아무도 볼 수
        /// 없는 상태였다. 그래서 회복은 체력으로 주고 한계는 **피로**로 준다.
        /// 피로는 회복되지 않고 stamina를 깎으므로 후반 층에서는 계획 자체가 불가능해진다.
        /// </summary>
        public const double RestHealRatio = 0.12;
        public const int MinPartyToContinue = 2;

        public static string FloorKey(int floor) => $"tower_floor_{floor}";

        public enum AbortReason { None, PartyWiped, TooFewToContinue, PartySpent }

        public static string Wire(AbortReason reason)
        {
            switch (reason)
            {
                case AbortReason.PartyWiped: return "party_wiped";
                case AbortReason.TooFewToContinue: return "too_few_to_continue";
                case AbortReason.PartySpent: return "party_spent";
                default: return null;
            }
        }

        public sealed class FloorDecisionLog
        {
            public CharacterInstance Actor;
            public DecisionResult Decision;
            public int Damage;
        }

        public sealed class FloorLog
        {
            public int Floor;
            public int Threat;
            public CharacterInstance Fallen;
            public List<FloorDecisionLog> Decisions = new List<FloorDecisionLog>();
            public bool Rescued;
            public List<InstanceId> Died = new List<InstanceId>();
            public bool FirstVisit;
        }

        public sealed class MissionResult
        {
            public int DeepestFloor;
            public bool Cleared;
            public List<FloorLog> Floors = new List<FloorLog>();
            public List<InstanceId> Deaths = new List<InstanceId>();
            public List<InstanceId> Survivors = new List<InstanceId>();
            public AbortReason Abort = AbortReason.None;
        }

        /* ───────── 파티 편성 ───────── */

        public sealed class FormPartyRequest
        {
            public IReadOnlyList<InstanceId> Members = new List<InstanceId>();
            public int BaseTrust;
        }

        /// <summary>
        /// 파티 편성도 관계 변화이므로 트랜잭션을 거치고 Event로 남는다 (규칙 3, 4).
        /// 이게 없으면 서로 신뢰 0인 채로 탑에 들어가 1층부터 동료를 버린다.
        /// </summary>
        public sealed class FormPartyTransaction : ITransaction<FormPartyRequest, bool>
        {
            public string Name => "FormParty";

            public string Validate(World world, FormPartyRequest request)
            {
                if (request.Members.Count < MinPartyToContinue)
                    return $"파티는 최소 {MinPartyToContinue}명이다";
                foreach (var id in request.Members)
                {
                    var member = world.Find(id);
                    if (member == null) return $"알 수 없는 Instance: {id}";
                    if (!member.IsAlive) return $"죽은 캐릭터는 편성할 수 없다: {id}";
                }
                return null;
            }

            public bool Apply(World world, FormPartyRequest request)
            {
                foreach (var id in request.Members)
                {
                    var member = world.Instance(id);
                    foreach (var other in request.Members)
                    {
                        if (other == id) continue;
                        if (member.Relationships.Any(r => r.Target == other)) continue;
                        member.Relationships.Add(new Relationship { Target = other, Trust = request.BaseTrust });
                        world.Events.Append(new RelationshipChangeEvent
                        {
                            Tick = world.Tick, From = id, To = other,
                            TrustBefore = 0, TrustAfter = request.BaseTrust, Cause = "party_formed",
                        });
                    }
                }
                return true;
            }
        }

        /* ───────── 좌표 도달 ───────── */

        public sealed class ReachFloorRequest
        {
            public int Floor;
            public InstanceId By;
        }

        /// <summary>
        /// 처음 도달한 좌표만 WorldDiscovery로 남는다.
        ///
        /// 이미 발견됐는지는 **이벤트 로그를 읽어서** 판정한다. 별도의 진행도 필드를 두지 않는
        /// 이유는 탑의 기록이 곧 진실이어야 하기 때문이다.
        /// </summary>
        public sealed class ReachFloorTransaction : ITransaction<ReachFloorRequest, bool>
        {
            public string Name => "ReachFloor";

            public string Validate(World world, ReachFloorRequest request)
            {
                if (request.Floor < 1 || request.Floor > Floors)
                    return $"탑에 없는 층: {request.Floor}";
                if (world.Find(request.By) == null) return $"알 수 없는 Instance: {request.By}";
                return null;
            }

            public bool Apply(World world, ReachFloorRequest request)
            {
                bool known = world.Events.OfKind<WorldDiscoveryEvent>()
                                  .Any(e => e.What == FloorKey(request.Floor));
                if (known) return false;

                world.Events.Append(new WorldDiscoveryEvent
                {
                    Tick = world.Tick, DiscoveredBy = request.By, What = FloorKey(request.Floor),
                });
                return true;
            }
        }

        /* ───────── 등반 ───────── */

        public static MissionResult Run(World world, IReadOnlyList<InstanceId> party, MasterOrder order)
        {
            var result = new MissionResult();
            var reachTx = new ReachFloorTransaction();
            var resolveTx = new ResolveTransaction();

            for (int floor = 1; floor <= Floors; floor += 1)
            {
                var living = party.Select(world.Instance).Where(c => c.IsAlive).ToList();

                if (living.Count == 0) { result.Abort = AbortReason.PartyWiped; break; }
                if (living.Count < MinPartyToContinue) { result.Abort = AbortReason.TooFewToContinue; break; }

                // Master가 지정한 퇴각선 아래로 전원이 떨어지면 더 오르지 않는다.
                // 이게 없으면 체력 12%인 파티가 계속 등반한다.
                double line = order.RetreatHealthRatioBelow;
                if (line > 0 && living.All(c => (double)c.Needs.Health / c.Needs.MaxHealth < line))
                {
                    result.Abort = AbortReason.PartySpent;
                    break;
                }

                world.AdvanceTick();
                result.DeepestFloor = floor;

                var arrival = Transactions.Run(world, reachTx,
                    new ReachFloorRequest { Floor = floor, By = living[0].InstanceId });
                if (!arrival.Ok) throw new InvalidOperationException(arrival.Error);

                var log = RunFloor(world, resolveTx, living, floor, order, arrival.Value);
                result.Floors.Add(log);
                result.Deaths.AddRange(log.Died);

                Rest(world, party);
            }

            result.Survivors = party.Where(id => world.Instance(id).IsAlive).ToList();
            result.Cleared = result.DeepestFloor == Floors && result.Abort == AbortReason.None;
            return result;
        }

        private static FloorLog RunFloor(World world, ResolveTransaction resolveTx,
                                        IReadOnlyList<CharacterInstance> living,
                                        int floor, MasterOrder order, bool firstVisit)
        {
            int threat = ThreatAt(floor);
            // 누가 쓰러지는지는 난수로 정한다. 시드 기반이므로 재현된다
            var fallen = world.Rng.Pick(living);
            var others = living.Where(c => c.InstanceId != fallen.InstanceId).ToList();
            var situation = Situation.AllyDown(fallen.InstanceId, threat, world.Tick);

            var decisions = new List<ActorDecision>();
            var byActor = new Dictionary<InstanceId, DecisionResult>();
            foreach (var actor in others)
            {
                var decision = Decider.Decide(AgentState.Build(actor, situation, order));
                byActor[actor.InstanceId] = decision;
                decisions.Add(new ActorDecision
                {
                    Actor = actor.InstanceId,
                    Action = decision.Reason.Action,
                    Plan = decision.Plan?.Steps,
                });
            }

            var resolved = Transactions.Run(world, resolveTx,
                new ResolveRequest { Situation = situation, Decisions = decisions });
            if (!resolved.Ok) throw new InvalidOperationException(resolved.Error);

            return new FloorLog
            {
                Floor = floor,
                Threat = threat,
                Fallen = fallen,
                Decisions = others.Select(actor => new FloorDecisionLog
                {
                    Actor = actor,
                    Decision = byActor[actor.InstanceId],
                    Damage = resolved.Value.DamageByActor.TryGetValue(actor.InstanceId, out var d) ? d : 0,
                }).ToList(),
                Rescued = resolved.Value.Rescued,
                Died = resolved.Value.Died.ToList(),
                FirstVisit = firstVisit,
            };
        }

        /// <summary>
        /// 층 사이 휴식. 체력과 공포는 조금 회복되고 **피로는 그대로 남는다.**
        /// 이 비대칭이 후반 층을 어렵게 만드는 유일한 장치다.
        /// </summary>
        private static void Rest(World world, IReadOnlyList<InstanceId> party)
        {
            foreach (var id in party)
            {
                var member = world.Instance(id);
                if (!member.IsAlive) continue;
                int heal = JsMath.Round(member.Needs.MaxHealth * RestHealRatio);
                member.Needs.Health = Math.Min(member.Needs.MaxHealth, member.Needs.Health + heal);
                member.Emotion.Fear = Math.Max(0, member.Emotion.Fear - RestFearDecay);
            }
        }
    }
}
