using System;
using System.Collections.Generic;
using System.Linq;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;
using LivingWorld.Core.Mission;
using LivingWorld.Core.Sim;

namespace LivingWorld.Core.Scenario
{
    /// <summary>
    /// CORE GAMEPLAY 시나리오 — 통과 기준을 고정하는 시나리오.
    ///
    /// 같은 Definition에서 소환한 캐릭터들이 같은 상황에서 자기 State 때문에 다르게 판단하고,
    /// 그 결과가 State와 Event를 바꾸고, 같은 상황을 다시 주면 이전과 다른 판단이 나오는 것까지.
    /// </summary>
    public static class CoreGameplay
    {
        public const uint Seed = 20260913;
        public const int EnemyThreat = 70;

        public static MasterOrder Order() => new MasterOrder
        {
            // 'defend'는 L0 규칙 2(자리 지키기)를 켜므로 이 시나리오는 'advance'를 쓴다
            Goal = GoalOrder.Advance,
            RiskPolicy = RiskPolicy.Balanced,
            // 0.3 — 첫 구조 후 부상으로는 발동하지 않는다. 즉 두 번째 판단 변화는
            // L0 강제가 아니라 L1 효용 변화로 일어난다.
            RetreatHealthRatioBelow = 0.3,
        };

        public sealed class Pair
        {
            public string Label;
            public CharacterInstance Vanguard;
            public CharacterInstance Ally;
        }

        public sealed class ScenarioWorld
        {
            public World World;
            public CharacterInstance VanguardA;
            public CharacterInstance VanguardB;
            public CharacterInstance AllyOfA;
            public CharacterInstance AllyOfB;
            public List<Pair> Squad = new List<Pair>();
        }

        public static CharacterInstance Summon(World world, DefinitionId definitionId,
                                              InitialCondition initial = null)
        {
            var result = Transactions.Run(world, new SummonTransaction(),
                new SummonRequest { DefinitionId = definitionId, Initial = initial });
            if (!result.Ok) throw new InvalidOperationException(result.Error);
            return result.Value;
        }

        public static ScenarioWorld Build()
        {
            var world = World.Create(Seed, Definitions.All);

            var allyOfA = Summon(world, Definitions.Scout.DefinitionId);
            var allyOfB = Summon(world, Definitions.Scout.DefinitionId);

            var vanguardA = Summon(world, Definitions.Vanguard.DefinitionId, new InitialCondition
            {
                Fear = 20,
                Trust = new List<(InstanceId, int)> { (allyOfA.InstanceId, 80) },
            });
            var vanguardB = Summon(world, Definitions.Vanguard.DefinitionId, new InitialCondition
            {
                Fear = 80,
                Trust = new List<(InstanceId, int)> { (allyOfB.InstanceId, 20) },
            });

            // C, D는 A/B 뒤에 소환한다 — 앞선 두 명의 난수 소비 순서를 바꾸지 않기 위함
            var allyOfC = Summon(world, Definitions.Scout.DefinitionId);
            var allyOfD = Summon(world, Definitions.Scout.DefinitionId);
            var vanguardC = Summon(world, Definitions.Vanguard.DefinitionId, new InitialCondition
            {
                Fear = 80,
                Trust = new List<(InstanceId, int)> { (allyOfC.InstanceId, 80) },
            });
            var vanguardD = Summon(world, Definitions.Vanguard.DefinitionId, new InitialCondition
            {
                Fear = 20,
                Trust = new List<(InstanceId, int)> { (allyOfD.InstanceId, 20) },
            });

            return new ScenarioWorld
            {
                World = world,
                VanguardA = vanguardA, VanguardB = vanguardB,
                AllyOfA = allyOfA, AllyOfB = allyOfB,
                Squad = new List<Pair>
                {
                    new Pair { Label = "fear=20 trust=80", Vanguard = vanguardA, Ally = allyOfA },
                    new Pair { Label = "fear=80 trust=20", Vanguard = vanguardB, Ally = allyOfB },
                    new Pair { Label = "fear=80 trust=80", Vanguard = vanguardC, Ally = allyOfC },
                    new Pair { Label = "fear=20 trust=20", Vanguard = vanguardD, Ally = allyOfD },
                },
            };
        }

        public sealed class Encounter
        {
            public CharacterInstance Actor;
            public CharacterInstance Subject;
            public Situation Situation;
            public AgentState State;
            public DecisionResult Decision;
            public List<InstanceId> Died = new List<InstanceId>();
            public int DamageTaken;
        }

        /// <summary>한 번의 조우: 상황 제시 → 판단 → 결과 적용.</summary>
        public static Encounter RunEncounter(World world, CharacterInstance actor,
                                            CharacterInstance subject, int tick)
        {
            var situation = Situation.AllyDown(subject.InstanceId, EnemyThreat, tick);
            var state = AgentState.Build(actor, situation, Order());
            var decision = Decider.Decide(state);

            // 1대1 조우는 판단이 하나인 조우다 — 규칙 구현은 파티와 공유한다
            var result = Transactions.Run(world, new ResolveTransaction(), new ResolveRequest
            {
                Situation = situation,
                Decisions = new List<ActorDecision>
                {
                    new ActorDecision
                    {
                        Actor = actor.InstanceId,
                        Action = decision.Reason.Action,
                        Plan = decision.Plan?.Steps,
                    },
                },
            });
            if (!result.Ok) throw new InvalidOperationException(result.Error);

            return new Encounter
            {
                Actor = actor, Subject = subject, Situation = situation, State = state,
                Decision = decision, Died = result.Value.Died.ToList(),
                DamageTaken = result.Value.DamageByActor.TryGetValue(actor.InstanceId, out var d) ? d : 0,
            };
        }
    }

    /// <summary>탑 등반 시나리오 — 파티를 만들고 10층에 올려보낸다.</summary>
    public static class TowerRun
    {
        public const uint Seed = 77001;
        /// <summary>편성 시점의 상호 신뢰 — 처음 만난 동료.</summary>
        public const int BaseTrust = 50;

        public static MasterOrder Order() => new MasterOrder
        {
            Goal = GoalOrder.Advance,
            RiskPolicy = RiskPolicy.Balanced,
            RetreatHealthRatioBelow = 0.25,
        };

        /// <summary>선봉 2명 + 정찰 2명. 전부 다른 개체다 (규칙 8).</summary>
        public static List<CharacterInstance> BuildParty(World world)
        {
            var party = new List<CharacterInstance>
            {
                CoreGameplay.Summon(world, Definitions.Vanguard.DefinitionId),
                CoreGameplay.Summon(world, Definitions.Vanguard.DefinitionId),
                CoreGameplay.Summon(world, Definitions.Scout.DefinitionId),
                CoreGameplay.Summon(world, Definitions.Scout.DefinitionId),
            };

            var formed = Transactions.Run(world, new Tower.FormPartyTransaction(),
                new Tower.FormPartyRequest
                {
                    Members = party.Select(c => c.InstanceId).ToList(),
                    BaseTrust = BaseTrust,
                });
            if (!formed.Ok) throw new InvalidOperationException(formed.Error);

            return party;
        }

        public sealed class Run
        {
            public World World;
            public List<CharacterInstance> Party;
            public Tower.MissionResult Result;
        }

        public static Run Execute(uint seed = Seed)
        {
            var world = World.Create(seed, Definitions.All);
            var party = BuildParty(world);
            var result = Tower.Run(world, party.Select(c => c.InstanceId).ToList(), Order());
            return new Run { World = world, Party = party, Result = result };
        }
    }
}
