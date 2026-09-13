using System.Collections.Generic;
using System.Linq;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;
using LivingWorld.Core.Persistence;
using LivingWorld.Core.Scenario;
using NUnit.Framework;

namespace LivingWorld.Core.Tests
{
    /// <summary>
    /// 규칙 3의 저장 절반 — "Snapshot + ImportantEventLog", 그리고 통과 기준의
    /// "저장 → 프로세스 재시작 → 복원 → 동일 State, 동일 Event Log".
    ///
    /// 판단이 같다는 것(GoldenTests)과 세이브가 같다는 것은 다른 주장이다.
    /// 두 언어가 같은 규칙을 돌려도 저장 스키마가 어긋나면 한쪽 세이브를 다른 쪽이 못 읽는다.
    /// 그래서 여기서는 **TS가 쓴 세이브 파일과 바이트 단위로** 대조한다.
    ///
    /// 골든 파일 재생성: 레포 루트에서 <c>npm run golden</c>
    /// </summary>
    [TestFixture]
    public class SnapshotTests
    {
        private const string GoldenFile = "tower-snapshot.json";

        private static string Golden() => TestPaths.NormalizeText(TestPaths.ReadGolden(GoldenFile));

        /* ───────── 저장 ───────── */

        [Test]
        public void Saving_the_tower_run_produces_the_same_bytes_as_the_TypeScript_implementation()
        {
            var run = TowerRun.Execute();

            string actual = SnapshotJson.Write(Snapshots.Take(run.World));

            // 줄 단위로 비교한다 — 1500줄 파일에서 "문자열이 다르다"는 메시지는 쓸모가 없다
            string[] expectedLines = Golden().Split('\n');
            string[] actualLines = actual.Split('\n');
            int limit = System.Math.Min(expectedLines.Length, actualLines.Length);
            for (int i = 0; i < limit; i += 1)
            {
                Assert.That(actualLines[i], Is.EqualTo(expectedLines[i]),
                    $"세이브 {i + 1}번째 줄이 TS와 다르다");
            }
            Assert.That(actualLines.Length, Is.EqualTo(expectedLines.Length), "세이브 줄 수");
        }

        /* ───────── 복원 ───────── */

        [Test]
        public void Restoring_a_TypeScript_save_and_saving_again_reproduces_the_same_file()
        {
            // TS가 저장한 파일을 C#이 읽고, 다시 저장했을 때 같은 바이트가 나오는가.
            // 읽기에서 필드 하나를 흘리면 여기서 잡힌다.
            Snapshot loaded = SnapshotJson.Read(Golden());

            World world = Snapshots.Restore(loaded, Definitions.All);
            string again = SnapshotJson.Write(Snapshots.Take(world));

            Assert.That(again, Is.EqualTo(Golden()));
        }

        [Test]
        public void Restoring_keeps_the_event_log_identical_including_ids_and_order()
        {
            Snapshot loaded = SnapshotJson.Read(Golden());
            World world = Snapshots.Restore(loaded, Definitions.All);

            var live = TowerRun.Execute();

            Assert.That(world.Events.Count, Is.EqualTo(live.World.Events.Count), "이벤트 개수");
            Assert.That(world.Events.All().Select(e => $"{e.Seq}:{e.EventId.Value}:{e.Kind}").ToArray(),
                Is.EqualTo(live.World.Events.All().Select(e => $"{e.Seq}:{e.EventId.Value}:{e.Kind}").ToArray()),
                "복원된 로그의 순서/ID/종류");

            // 복원 후 새 이벤트가 1번부터 다시 번호를 받으면 로그가 덮어써진 것과 같다
            Assert.That(world.Ids.Peek(), Is.EqualTo(live.World.Ids.Peek()), "ID 카운터");
        }

        [Test]
        public void A_restored_character_judges_exactly_as_the_live_one_does()
        {
            // 세이브의 목적은 파일이 같은 것이 아니라 **판단이 이어지는 것**이다.
            // 기억·목표·신뢰가 하나라도 빠지면 같은 상황에서 다른 ReasonCode가 나온다.
            var live = TowerRun.Execute();
            World restored = Snapshots.Restore(SnapshotJson.Read(Golden()), Definitions.All);

            // 파티 전원에 대해 본다 — 생존자는 한 명일 수도 있고, 죽은 동료를 향한
            // 신뢰와 기억도 판단에 실린다
            var party = live.Party.Select(c => c.InstanceId).ToList();
            Assert.That(party.Count, Is.GreaterThan(1), "비교할 파티원이 둘 이상이어야 한다");

            var order = TowerRun.Order();
            for (int i = 0; i < party.Count; i += 1)
            {
                InstanceId self = party[i];
                InstanceId fallen = party[(i + 1) % party.Count];
                var situation = Situation.AllyDown(fallen, 55, live.World.Tick);

                string liveReason = Decider
                    .Decide(AgentState.Build(live.World.Instance(self), situation, order))
                    .Reason.Format();
                string restoredReason = Decider
                    .Decide(AgentState.Build(restored.Instance(self), situation, order))
                    .Reason.Format();

                Assert.That(restoredReason, Is.EqualTo(liveReason),
                    $"{live.World.Instance(self).Identity.Name}의 판단이 복원 후 달라졌다");
            }
        }

        [Test]
        public void A_save_from_another_version_is_rejected_rather_than_half_loaded()
        {
            string bumped = Golden().Replace("\"version\": 1", "\"version\": 2");

            Assert.That(() => SnapshotJson.Read(bumped),
                Throws.TypeOf<System.InvalidOperationException>());
        }

        [Test]
        public void A_save_missing_a_field_fails_loudly_instead_of_defaulting_to_zero()
        {
            // 깨진 세이브를 조용히 기본값으로 채우는 것이 가장 나쁜 실패다 —
            // 캐릭터가 기억을 잃고도 게임이 계속 돌아간다.
            string broken = Golden().Replace("\"rngState\"", "\"rngStateTypo\"");

            Assert.That(() => SnapshotJson.Read(broken), Throws.TypeOf<System.FormatException>());
        }

        /* ───────── 직렬화 규칙 ───────── */

        [Test]
        public void The_writer_follows_the_same_escaping_and_key_order_rules_as_JSON_stringify()
        {
            // 한글은 이스케이프하지 않고, 키는 정렬되고, 빈 배열은 한 줄로 쓴다.
            string json = new JsonObject()
                .Set("zeta", 1)
                .Set("alpha", "따옴표 \" 와 줄바꿈 \n")
                .Set("empty", new JsonArray())
                .ToJson();

            Assert.That(json, Is.EqualTo(
                "{\n" +
                "  \"alpha\": \"따옴표 \\\" 와 줄바꿈 \\n\",\n" +
                "  \"empty\": [],\n" +
                "  \"zeta\": 1\n" +
                "}"));
        }

        [Test]
        public void An_absent_optional_field_is_omitted_rather_than_written_as_null()
        {
            // TS의 undefined 필드는 JSON에 키가 없다. null을 쓰면 바이트가 달라진다.
            Snapshot loaded = SnapshotJson.Read(Golden());
            var alive = loaded.Instances.First(c => c.IsAlive);
            Assert.That(alive.Legacy.DiedAtTick, Is.Null, "살아있는 캐릭터는 사망 tick이 없다");

            string json = SnapshotJson.Write(new Snapshot
            {
                Instances = new List<CharacterInstance> { alive },
            });

            Assert.That(json, Does.Not.Contain("diedAtTick"));
        }
    }
}
