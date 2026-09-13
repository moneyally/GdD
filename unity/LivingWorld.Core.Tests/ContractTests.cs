using System;
using System.Collections.Generic;
using System.Linq;
using System.Reflection;
using LivingWorld.Core;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;
using LivingWorld.Core.Mission;
using LivingWorld.Core.Scenario;
using LivingWorld.Core.Sim;
using NUnit.Framework;

namespace LivingWorld.Core.Tests
{
    /// <summary>
    /// CORE CONTRACT 규칙 자체를 검증한다.
    ///
    /// 골든 테스트는 "TS와 같은가"를 본다. 이 파일은 "계약을 지키는가"를 본다 —
    /// 두 구현이 똑같이 계약을 깨고 있으면 골든 테스트는 통과하기 때문에 둘 다 필요하다.
    /// </summary>
    [TestFixture]
    public class ContractTests
    {
        private static World FreshWorld(uint seed = 1234) => World.Create(seed, Definitions.All);

        /* ───────── 규칙 1 — 4단 분리 ───────── */

        [Test]
        public void Rule1_identifiers_of_different_layers_cannot_be_mixed()
        {
            // TS에서는 branded type으로 막았던 것이 C#에서는 타입으로 막힌다.
            // 아래 주석을 풀면 컴파일되지 않는다:
            //   DefinitionId id = new InstanceId("0001");
            // 런타임에서도 접두사로 구분된다.
            Assert.That(new DefinitionId("vanguard").Value, Does.StartWith("CHD_"));
            Assert.That(new InstanceId("0001").Value, Does.StartWith("CHR_"));
            Assert.That(new MemoryId("0001").Value, Does.StartWith("MEM_"));
        }

        [Test]
        public void Rule1_agent_state_is_a_snapshot_taken_at_decision_time()
        {
            var world = FreshWorld(11);
            var party = TowerRun.BuildParty(world);
            var actor = party[1];
            var situation = Situation.AllyDown(party[0].InstanceId, 50, 1);

            var state = AgentState.Build(actor, situation, TowerRun.Order());
            Assert.That(state.Goals, Is.Empty, "판단 시점에는 목표가 없었다");

            // 판단 이후 Instance가 변해도 이미 만들어진 AgentState는 변하지 않아야 한다.
            // 참조를 그대로 들고 있으면 디버거가 거짓 근거를 보여준다 — 실제로 겪은 결함이다.
            actor.Goals.Add(new Goal { Kind = GoalKind.NeverAbandonAlly, Priority = 85 });
            Assert.That(state.Goals, Is.Empty, "AgentState가 이후 변경을 비추면 안 된다");
        }

        [Test]
        public void Rule1_core_has_no_dependency_on_a_game_engine()
        {
            // 판단 로직이 렌더 코드를 참조하지 않는다는 것을 어셈블리 수준에서 확인한다.
            var referenced = typeof(Decider).Assembly.GetReferencedAssemblies()
                                            .Select(a => a.Name).ToList();
            Assert.That(referenced.Any(n => n.StartsWith("UnityEngine", StringComparison.Ordinal)),
                Is.False, "코어가 UnityEngine을 참조하면 규칙 1이 깨진다");
            Assert.That(referenced.Any(n => n.StartsWith("UnityEditor", StringComparison.Ordinal)),
                Is.False);
        }

        /* ───────── 규칙 3 — Event 6종, append-only ───────── */

        [Test]
        public void Rule3_only_six_event_kinds_are_ever_recorded()
        {
            var run = TowerRun.Execute();
            var allowed = new[]
            {
                EventKind.Death, EventKind.RelationshipChange, EventKind.MajorMemory,
                EventKind.MissionOutcome, EventKind.WorldDiscovery, EventKind.LegacyCreation,
            };

            Assert.That(run.World.Events.Count, Is.GreaterThan(0));
            foreach (var e in run.World.Events.All())
                Assert.That(allowed, Contains.Item(e.Kind), "6종 밖의 이벤트가 기록됐다");
        }

        [Test]
        public void Rule3_event_log_exposes_no_mutation_path()
        {
            var methods = typeof(EventLog)
                .GetMethods(BindingFlags.Public | BindingFlags.Instance)
                .Select(m => m.Name)
                .ToList();

            foreach (var forbidden in new[] { "Remove", "RemoveAt", "Clear", "Insert", "Set", "Update" })
                Assert.That(methods, Does.Not.Contain(forbidden), $"EventLog에 {forbidden} 경로가 있다");
        }

        [Test]
        public void Rule3_sequence_numbers_start_at_one_with_no_gaps()
        {
            var run = TowerRun.Execute();
            var seqs = run.World.Events.All().Select(e => e.Seq).ToArray();
            Assert.That(seqs, Is.EqualTo(Enumerable.Range(1, seqs.Length).ToArray()));
        }

        /* ───────── 규칙 4 — 트랜잭션 경유 ───────── */

        [Test]
        public void Rule4_a_failed_validation_changes_nothing()
        {
            var world = FreshWorld();
            int before = world.AllInstances().Count;

            var result = Transactions.Run(world, new SummonTransaction(),
                new SummonRequest { DefinitionId = new DefinitionId("does_not_exist") });

            Assert.That(result.Ok, Is.False);
            Assert.That(result.Error, Does.Contain("알 수 없는 Definition"));
            Assert.That(world.AllInstances().Count, Is.EqualTo(before));
            Assert.That(world.Events.Count, Is.Zero);
        }

        [Test]
        public void Rule4_resolve_rejects_a_duplicated_actor()
        {
            var world = FreshWorld(12);
            var party = TowerRun.BuildParty(world);

            var result = Transactions.Run(world, new ResolveTransaction(), new ResolveRequest
            {
                Situation = Situation.AllyDown(party[0].InstanceId, 50, world.Tick),
                Decisions = new List<ActorDecision>
                {
                    new ActorDecision { Actor = party[1].InstanceId, Action = Decision.Action.Rescue },
                    new ActorDecision { Actor = party[1].InstanceId, Action = Decision.Action.Retreat },
                },
            });

            Assert.That(result.Ok, Is.False);
            Assert.That(result.Error, Does.Contain("두 번"));
        }

        [Test]
        public void Rule4_the_fallen_character_does_not_decide()
        {
            var world = FreshWorld(13);
            var party = TowerRun.BuildParty(world);

            var result = Transactions.Run(world, new ResolveTransaction(), new ResolveRequest
            {
                Situation = Situation.AllyDown(party[0].InstanceId, 50, world.Tick),
                Decisions = new List<ActorDecision>
                {
                    new ActorDecision { Actor = party[0].InstanceId, Action = Decision.Action.Rescue },
                },
            });

            Assert.That(result.Ok, Is.False);
        }

        /* ───────── 규칙 5 — LLM은 행동을 결정하지 않는다 ───────── */

        [Test]
        public void Rule5_the_decision_stack_reaches_no_network_and_no_llm_sdk()
        {
            var referenced = typeof(Decider).Assembly.GetReferencedAssemblies()
                                            .Select(a => a.Name)
                                            .ToList();

            foreach (var forbidden in new[] { "System.Net.Http", "Anthropic", "OpenAI", "Newtonsoft.Json" })
                Assert.That(referenced.Any(n => n.Contains(forbidden)), Is.False,
                    $"코어가 {forbidden} 을 참조한다 — 판단이 외부에 의존하면 규칙 5가 깨진다");
        }

        [Test]
        public void Rule5_the_same_seed_always_produces_the_same_run()
        {
            string Summarize()
            {
                var run = TowerRun.Execute();
                var lines = run.Result.Floors.SelectMany(f =>
                    f.Decisions.Select(d => $"{f.Floor}:{d.Decision.Reason.Format()}"));
                return string.Join("|", lines) + "||" +
                       string.Join(",", run.World.Events.All().Select(e => $"{e.Seq}:{e.Kind}"));
            }

            Assert.That(Summarize(), Is.EqualTo(Summarize()));
        }

        /* ───────── 규칙 6 — 모든 Decision은 ReasonCode를 가진다 ───────── */

        [Test]
        public void Rule6_every_decision_carries_a_reason_code()
        {
            var run = TowerRun.Execute();

            foreach (var floor in run.Result.Floors)
            foreach (var d in floor.Decisions)
            {
                Assert.That(d.Decision.Reason, Is.Not.Null);
                Assert.That(d.Decision.Reason.Factors, Is.Not.Empty, "근거가 비어 있다");
                Assert.That(d.Decision.Reason.Format(), Does.Match(@"^[A-Z_]+\(.+\)$"));
            }
        }

        [Test]
        public void Rule6_reason_codes_render_in_the_documented_format()
        {
            Assert.That(new ReasonCode
            {
                Action = Decision.Action.Retreat,
                Layer = DecisionLayer.L1,
                Factors = new List<Factor> { Factor.Compare("fear", 72, ">", 60) },
            }.Format(), Is.EqualTo("RETREAT(fear=72>threshold=60)"));

            Assert.That(new ReasonCode
            {
                Action = Decision.Action.Rescue,
                Layer = DecisionLayer.L1,
                Factors = new List<Factor>
                {
                    Factor.Of("target", "Mira"),
                    Factor.Of("trust", 81),
                    Factor.Of("self_risk", 45),
                },
            }.Format(), Is.EqualTo("RESCUE(target=Mira,trust=81,self_risk=45)"));

            Assert.That(new ReasonCode
            {
                Action = Decision.Action.Hold,
                Layer = DecisionLayer.L0,
                Factors = new List<Factor> { Factor.Of("order", "defend"), Factor.Of("loyalty", 90) },
                Overrides = new List<Factor> { Factor.Of("fear", 65) },
            }.Format(), Is.EqualTo("HOLD(order=defend,loyalty=90 overrides fear=65)"));
        }

        /* ───────── 규칙 7 — 죽음은 최종 ───────── */

        [Test]
        public void Rule7_the_dead_are_not_deleted_and_leave_a_legacy()
        {
            var run = TowerRun.Execute();
            Assert.That(run.Result.Deaths, Is.Not.Empty, "이 시드에서는 사망자가 나와야 한다");

            foreach (var id in run.Result.Deaths)
            {
                var dead = run.World.Find(id);
                Assert.That(dead, Is.Not.Null, "죽은 개체가 삭제됐다");
                Assert.That(dead.Status, Is.EqualTo(LifeStatus.Dead));
                Assert.That(dead.Needs.Health, Is.Zero);
                Assert.That(dead.Legacy.DiedAtTick, Is.Not.Null);
            }

            Assert.That(run.World.Events.OfKind<LegacyCreationEvent>().Count,
                Is.EqualTo(run.Result.Deaths.Count), "사망마다 Legacy가 하나씩 남아야 한다");
        }

        /* ───────── 규칙 8 — 중복 = 새 Instance ───────── */

        [Test]
        public void Rule8_summoning_the_same_definition_twice_yields_different_characters()
        {
            var world = FreshWorld();
            var first = CoreGameplay.Summon(world, Definitions.Vanguard.DefinitionId);
            var second = CoreGameplay.Summon(world, Definitions.Vanguard.DefinitionId);

            Assert.That(first.InstanceId, Is.Not.EqualTo(second.InstanceId));
            Assert.That(first.Identity.DefinitionId, Is.EqualTo(second.Identity.DefinitionId));
            Assert.That(first.Identity.Name, Is.Not.EqualTo(second.Identity.Name));
            Assert.That(first.Memory, Is.Not.SameAs(second.Memory));
            Assert.That(first.Relationships, Is.Not.SameAs(second.Relationships));
        }

        [Test]
        public void Rule8_names_stay_unique_even_after_the_pool_runs_out()
        {
            var world = FreshWorld(4242);
            var names = Enumerable.Range(0, 7)
                .Select(_ => CoreGameplay.Summon(world, Definitions.Scout.DefinitionId).Identity.Name)
                .ToList();

            Assert.That(names.Distinct().Count(), Is.EqualTo(names.Count),
                $"이름이 중복됐다: {string.Join(", ", names)}");
        }

        [Test]
        public void Rule8_personality_stays_inside_the_definition_ranges()
        {
            var world = FreshWorld(777);
            var r = Definitions.Scout.PersonalityRanges;

            for (int i = 0; i < 20; i += 1)
            {
                var c = CoreGameplay.Summon(world, Definitions.Scout.DefinitionId);
                Assert.That(c.Personality.Risk, Is.InRange(r.Risk.Min, r.Risk.Max));
                Assert.That(c.Personality.Loyalty, Is.InRange(r.Loyalty.Min, r.Loyalty.Max));
                Assert.That(c.Personality.Aggression, Is.InRange(r.Aggression.Min, r.Aggression.Max));
            }
        }

        /* ───────── 판단 규칙 ───────── */

        [Test]
        public void Attacking_does_not_rescue_the_fallen_ally()
        {
            var world = FreshWorld(14);
            var party = TowerRun.BuildParty(world);
            world.AdvanceTick();
            var fallen = party[0];

            var result = Transactions.Run(world, new ResolveTransaction(), new ResolveRequest
            {
                Situation = Situation.AllyDown(fallen.InstanceId, 40, world.Tick),
                Decisions = new List<ActorDecision>
                {
                    new ActorDecision { Actor = party[1].InstanceId, Action = Decision.Action.Attack },
                },
            });

            Assert.That(result.Ok, Is.True);
            Assert.That(result.Value.Rescued, Is.False, "ATTACK은 구조가 아니다");
            Assert.That(fallen.Status, Is.EqualTo(LifeStatus.Dead));
            Assert.That(party[1].Memory.Select(m => m.Tag), Contains.Item(MemoryTag.AllyDiedUnrescued));
            Assert.That(party[1].Memory.Select(m => m.Tag), Does.Not.Contain(MemoryTag.RescuedAlly));
        }

        [Test]
        public void A_plan_never_puts_falling_back_before_the_rescue()
        {
            var state = TestState(fear: 20);
            var result = L2Goap.Apply(state);

            Assert.That(result, Is.Not.Null);
            var steps = result.Plan.Steps.ToList();
            Assert.That(steps, Contains.Item(PlanStep.Rescue));
            Assert.That(steps, Contains.Item(PlanStep.FallBack));
            Assert.That(steps.IndexOf(PlanStep.Rescue), Is.LessThan(steps.IndexOf(PlanStep.FallBack)));
        }

        [Test]
        public void Fear_does_not_erase_the_goal_but_changes_the_method()
        {
            var calm = L2Goap.Apply(TestState(fear: 20)).Plan.Steps.ToList();
            var afraid = L2Goap.Apply(TestState(fear: 80)).Plan.Steps.ToList();

            Assert.That(calm, Does.Not.Contain(PlanStep.Suppress), "감당 가능하면 연막을 낭비하지 않는다");
            Assert.That(afraid, Contains.Item(PlanStep.Suppress), "겁에 질리면 연막을 먼저 친다");
            Assert.That(calm, Contains.Item(PlanStep.Rescue));
            Assert.That(afraid, Contains.Item(PlanStep.Rescue));
        }

        [Test]
        public void When_no_plan_exists_the_decision_falls_through_to_utility()
        {
            // 중상: 체감 위협이 오르고 감당 상한은 내려가 연막으로도 메울 수 없다
            var state = TestState(fear: 80, healthRatio: 0.45, selfRisk: 93, stamina: 45);
            Assert.That(L2Goap.Apply(state), Is.Null);
            Assert.That(Decider.Decide(state).Reason.Layer, Is.EqualTo(DecisionLayer.L1));
        }

        private static AgentState TestState(int fear, double healthRatio = 1,
                                           double selfRisk = 70, double stamina = 100) =>
            new AgentState
            {
                Self = new InstanceId("0100"),
                Personality = new Personality
                {
                    Risk = 50, Loyalty = 70, Sociability = 50, Aggression = 55, Honesty = 60,
                },
                HealthRatio = healthRatio,
                Fear = fear,
                Subject = new InstanceId("0101"),
                TrustInSubject = 20,
                SelfRisk = selfRisk,
                Stamina = stamina,
                MemoryInfluences = new List<MemoryInfluence>
                {
                    new MemoryInfluence
                    {
                        Tag = MemoryTag.AllyDiedUnrescued,
                        Importance = 90,
                        MemoryId = new MemoryId("0001"),
                    },
                },
                Goals = new List<Goal>
                {
                    new Goal
                    {
                        Kind = GoalKind.NeverAbandonAlly,
                        Priority = 85,
                        SourceMemory = new MemoryId("0001"),
                    },
                },
                Order = TowerRun.Order(),
                Tick = 1,
            };
    }
}
