using System;
using System.Collections.Generic;
using System.IO;
using System.Linq;
using System.Text.Json;
using LivingWorld.Core;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;
using LivingWorld.Core.Mission;
using LivingWorld.Core.Scenario;
using NUnit.Framework;

namespace LivingWorld.Core.Tests
{
    /// <summary>
    /// TS 구현이 만든 골든 파일과 C# 구현의 결과를 대조한다.
    ///
    /// 두 언어로 같은 규칙을 구현했다는 주장은 코드를 눈으로 비교하는 것으로는 증명되지 않는다.
    /// 같은 시드에서 같은 판단·같은 ReasonCode 문자열·같은 이벤트 순서가 나오는지가 증명이다.
    ///
    /// 골든 파일 재생성: 레포 루트에서 <c>npm run golden</c>
    /// </summary>
    [TestFixture]
    public class GoldenTests
    {
        private static string GoldenDir()
        {
            var dir = new DirectoryInfo(AppContext.BaseDirectory);
            while (dir != null)
            {
                string candidate = Path.Combine(dir.FullName, "golden");
                if (Directory.Exists(candidate)) return candidate;
                dir = dir.Parent;
            }
            throw new DirectoryNotFoundException(
                "golden/ 를 찾지 못했다. 레포 루트에서 `npm run golden` 을 먼저 실행할 것.");
        }

        private static JsonElement Load(string name)
        {
            string path = Path.Combine(GoldenDir(), name);
            using var doc = JsonDocument.Parse(File.ReadAllText(path));
            return doc.RootElement.Clone();
        }

        private static string[] Strings(JsonElement array) =>
            array.EnumerateArray().Select(e => e.GetString()).ToArray();

        /* ───────── 난수 ───────── */

        [Test]
        public void Rng_produces_the_same_stream_as_the_TypeScript_implementation()
        {
            var golden = Load("rng.json");

            var rng = new Rng((uint)golden.GetProperty("seed").GetInt64());
            var draws = golden.GetProperty("draws").EnumerateArray().Select(e => e.GetInt64()).ToArray();
            for (int i = 0; i < draws.Length; i += 1)
            {
                long actual = JsMath.Round(rng.Next() * 1e9);
                Assert.That(actual, Is.EqualTo(draws[i]), $"draw #{i} 가 어긋났다");
            }

            var rng2 = new Rng((uint)golden.GetProperty("intSeed").GetInt64());
            var ints = golden.GetProperty("ints").EnumerateArray().Select(e => e.GetInt32()).ToArray();
            for (int i = 0; i < ints.Length; i += 1)
                Assert.That(rng2.IntBetween(40, 90), Is.EqualTo(ints[i]), $"intBetween #{i} 가 어긋났다");
        }

        /* ───────── CORE GAMEPLAY ───────── */

        [Test]
        public void Core_gameplay_scenario_matches_the_golden_output()
        {
            var golden = Load("core-gameplay.json");
            var s = CoreGameplay.Build();
            var world = s.World;

            world.AdvanceTick();
            var firstA = CoreGameplay.RunEncounter(world, s.VanguardA, s.AllyOfA, world.Tick);
            var firstB = CoreGameplay.RunEncounter(world, s.VanguardB, s.AllyOfB, world.Tick);

            world.AdvanceTick();
            var newAlly = CoreGameplay.Summon(world, Definitions.Scout.DefinitionId);
            var secondA = CoreGameplay.RunEncounter(world, s.VanguardA, s.AllyOfA, world.Tick);
            var secondB = CoreGameplay.RunEncounter(world, s.VanguardB, newAlly, world.Tick);

            Assert.That(world.AllInstances().Select(i => i.Identity.Name).ToArray(),
                Is.EqualTo(Strings(golden.GetProperty("names"))), "소환된 이름 목록이 어긋났다");

            var encounters = golden.GetProperty("encounters").EnumerateArray().ToArray();
            var actual = new[] { firstA, firstB, secondA, secondB };

            for (int i = 0; i < encounters.Length; i += 1)
                AssertEncounter(encounters[i], actual[i]);

            Assert.That(EventSignature(world), Is.EqualTo(Strings(golden.GetProperty("events"))),
                "이벤트 순서/종류가 어긋났다");
        }

        private static void AssertEncounter(JsonElement expected, CoreGameplay.Encounter actual)
        {
            string label = expected.GetProperty("label").GetString();
            Assert.That(actual.Actor.Identity.Name, Is.EqualTo(expected.GetProperty("actor").GetString()),
                $"{label} 행동자");
            Assert.That(ActionNames.Wire(actual.Decision.Reason.Action),
                Is.EqualTo(expected.GetProperty("action").GetString()), $"{label} 행동");
            Assert.That(actual.Decision.Reason.Layer.ToString(),
                Is.EqualTo(expected.GetProperty("layer").GetString()), $"{label} 판단 계층");
            Assert.That(actual.Decision.Reason.Format(),
                Is.EqualTo(expected.GetProperty("reason").GetString()), $"{label} ReasonCode");
            Assert.That(actual.DamageTaken, Is.EqualTo(expected.GetProperty("damage").GetInt32()),
                $"{label} 피해");
            AssertPlan(expected.GetProperty("plan"), actual.Decision.Plan, label);
        }

        private static void AssertPlan(JsonElement expected, Plan actual, string label)
        {
            if (expected.ValueKind == JsonValueKind.Null)
            {
                Assert.That(actual, Is.Null, $"{label} 계획이 없어야 한다");
                return;
            }
            Assert.That(actual, Is.Not.Null, $"{label} 계획이 있어야 한다");
            Assert.That(actual.Steps.Select(PlanStepNames.Wire).ToArray(),
                Is.EqualTo(Strings(expected)), $"{label} 계획 순서");
        }

        private static string[] EventSignature(World world) =>
            world.Events.All().Select(e => $"{e.Seq}:{e.Kind}").ToArray();

        /* ───────── 탑 등반 ───────── */

        [Test]
        public void Tower_run_matches_the_golden_output()
        {
            var golden = Load("tower-run.json");
            var run = TowerRun.Execute();
            var world = run.World;

            /* 파티 — 소환 결과가 어긋나면 그 뒤는 볼 필요가 없다 */
            var expectedParty = golden.GetProperty("party").EnumerateArray().ToArray();
            Assert.That(run.Party.Count, Is.EqualTo(expectedParty.Length), "파티 인원");
            for (int i = 0; i < expectedParty.Length; i += 1)
            {
                var e = expectedParty[i];
                var c = run.Party[i];
                string who = $"party[{i}]";
                Assert.That(c.Identity.Name, Is.EqualTo(e.GetProperty("name").GetString()), $"{who} 이름");
                Assert.That(c.Identity.DefinitionId.Value,
                    Is.EqualTo(e.GetProperty("definition").GetString()), $"{who} Definition");
                Assert.That(c.Personality.Risk, Is.EqualTo(e.GetProperty("risk").GetInt32()), $"{who} risk");
                Assert.That(c.Personality.Loyalty, Is.EqualTo(e.GetProperty("loyalty").GetInt32()), $"{who} loyalty");
                Assert.That(c.Personality.Aggression,
                    Is.EqualTo(e.GetProperty("aggression").GetInt32()), $"{who} aggression");
                Assert.That(c.Needs.MaxHealth, Is.EqualTo(e.GetProperty("maxHealth").GetInt32()), $"{who} 최대체력");
            }

            /* 층별 판단 */
            var expectedFloors = golden.GetProperty("floors").EnumerateArray().ToArray();
            Assert.That(run.Result.Floors.Count, Is.EqualTo(expectedFloors.Length), "층 수");

            for (int i = 0; i < expectedFloors.Length; i += 1)
            {
                var e = expectedFloors[i];
                var f = run.Result.Floors[i];
                string at = $"{f.Floor}층";

                Assert.That(f.Floor, Is.EqualTo(e.GetProperty("floor").GetInt32()), $"{at} 번호");
                Assert.That(f.Threat, Is.EqualTo(e.GetProperty("threat").GetInt32()), $"{at} 위협도");
                Assert.That(f.Fallen.Identity.Name,
                    Is.EqualTo(e.GetProperty("fallen").GetString()), $"{at} 쓰러진 사람");
                Assert.That(f.FirstVisit, Is.EqualTo(e.GetProperty("firstVisit").GetBoolean()), $"{at} 최초 도달");
                Assert.That(f.Rescued, Is.EqualTo(e.GetProperty("rescued").GetBoolean()), $"{at} 구조 여부");

                var expectedDecisions = e.GetProperty("decisions").EnumerateArray().ToArray();
                Assert.That(f.Decisions.Count, Is.EqualTo(expectedDecisions.Length), $"{at} 판단 수");

                for (int j = 0; j < expectedDecisions.Length; j += 1)
                {
                    var ed = expectedDecisions[j];
                    var d = f.Decisions[j];
                    string who = $"{at} {d.Actor.Identity.Name}";

                    Assert.That(d.Actor.Identity.Name, Is.EqualTo(ed.GetProperty("actor").GetString()), $"{who} 행동자");
                    Assert.That(ActionNames.Wire(d.Decision.Reason.Action),
                        Is.EqualTo(ed.GetProperty("action").GetString()), $"{who} 행동");
                    Assert.That(d.Decision.Reason.Layer.ToString(),
                        Is.EqualTo(ed.GetProperty("layer").GetString()), $"{who} 계층");
                    Assert.That(d.Decision.Reason.Format(),
                        Is.EqualTo(ed.GetProperty("reason").GetString()), $"{who} ReasonCode");
                    Assert.That(d.Damage, Is.EqualTo(ed.GetProperty("damage").GetInt32()), $"{who} 피해");
                    AssertPlan(ed.GetProperty("plan"), d.Decision.Plan, who);
                }

                Assert.That(f.Died.Select(id => world.Instance(id).Identity.Name).ToArray(),
                    Is.EqualTo(Strings(e.GetProperty("died"))), $"{at} 사망자");
            }

            /* 결과 */
            var er = golden.GetProperty("result");
            Assert.That(run.Result.DeepestFloor, Is.EqualTo(er.GetProperty("deepestFloor").GetInt32()), "도달 층");
            Assert.That(run.Result.Cleared, Is.EqualTo(er.GetProperty("cleared").GetBoolean()), "클리어");
            string expectedAbort = er.GetProperty("abortReason").ValueKind == JsonValueKind.Null
                ? null : er.GetProperty("abortReason").GetString();
            Assert.That(Tower.Wire(run.Result.Abort), Is.EqualTo(expectedAbort), "중단 사유");
            Assert.That(run.Result.Survivors.Select(id => world.Instance(id).Identity.Name).ToArray(),
                Is.EqualTo(Strings(er.GetProperty("survivors"))), "생존자");
            Assert.That(run.Result.Deaths.Select(id => world.Instance(id).Identity.Name).ToArray(),
                Is.EqualTo(Strings(er.GetProperty("deaths"))), "사망자");

            /* 생존자 State — 기억과 목표까지 같아야 한다 */
            var expectedState = golden.GetProperty("survivorState").EnumerateArray().ToArray();
            for (int i = 0; i < expectedState.Length; i += 1)
            {
                var e = expectedState[i];
                var c = world.Instance(run.Result.Survivors[i]);
                string who = c.Identity.Name;

                Assert.That(c.Identity.Name, Is.EqualTo(e.GetProperty("name").GetString()), "생존자 이름");
                Assert.That(c.Needs.Health, Is.EqualTo(e.GetProperty("health").GetInt32()), $"{who} 체력");
                Assert.That(c.Needs.Fatigue, Is.EqualTo(e.GetProperty("fatigue").GetInt32()), $"{who} 피로");
                Assert.That(c.Emotion.Fear, Is.EqualTo(e.GetProperty("fear").GetInt32()), $"{who} 공포");
                Assert.That(c.Memory.Select(m => $"{MemoryTagNames.Wire(m.Tag)}:{m.Importance}").ToArray(),
                    Is.EqualTo(Strings(e.GetProperty("memory"))), $"{who} 기억");
                Assert.That(c.Goals.Select(g => GoalKindNames.Wire(g.Kind)).ToArray(),
                    Is.EqualTo(Strings(e.GetProperty("goals"))), $"{who} 목표");
            }

            Assert.That(EventSignature(world), Is.EqualTo(Strings(golden.GetProperty("events"))),
                "이벤트 순서/종류가 어긋났다");
        }
    }
}
