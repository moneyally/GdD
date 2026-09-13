using System;
using System.Collections.Generic;

namespace LivingWorld.Core.Persistence
{
    /// <summary>
    /// Snapshot ⇄ JSON. **TS 구현과 바이트가 같아야 한다.**
    ///
    /// 왜 바이트까지 맞추는가: 판단이 같다는 것과 세이브 형식이 같다는 것은 다른 주장이다.
    /// 두 언어가 같은 규칙을 돌려도 저장 스키마가 어긋나면, 한쪽에서 만든 세이브를
    /// 다른 쪽이 못 읽는다 — 그건 포팅을 한 게 아니다.
    /// <c>golden/tower-snapshot.json</c>과의 문자열 비교가 그 주장을 검증한다.
    ///
    /// 규칙 (TS <c>serialize()</c>와 동일):
    /// - 키는 정렬된다 (<see cref="JsonObject"/>가 보장)
    /// - 값이 없는 선택 필드는 **키를 쓰지 않는다** (TS의 undefined)
    /// - enum은 TS의 리터럴 문자열과 같은 와이어 이름으로 쓴다
    /// </summary>
    public static class SnapshotJson
    {
        /* ───────── 쓰기 ───────── */

        public static string Write(Snapshot snapshot)
        {
            return new JsonObject()
                .Set("version", snapshot.Version)
                .Set("tick", snapshot.Tick)
                .Set("rngState", snapshot.RngState)
                .Set("idCounter", snapshot.IdCounter)
                .Set("instances", JsonArray.Of(snapshot.Instances, WriteInstance))
                .Set("events", JsonArray.Of(snapshot.Events, WriteEvent))
                .ToJson();
        }

        private static JsonValue WriteInstance(CharacterInstance c) =>
            new JsonObject()
                .Set("instanceId", c.InstanceId.Value)
                .Set("status", LifeStatusNames.Wire(c.Status))
                .Set("identity", new JsonObject()
                    .Set("name", c.Identity.Name)
                    .Set("definitionId", c.Identity.DefinitionId.Value)
                    .Set("bornAtTick", c.Identity.BornAtTick))
                .Set("personality", new JsonObject()
                    .Set("risk", c.Personality.Risk)
                    .Set("loyalty", c.Personality.Loyalty)
                    .Set("sociability", c.Personality.Sociability)
                    .Set("aggression", c.Personality.Aggression)
                    .Set("honesty", c.Personality.Honesty))
                .Set("needs", new JsonObject()
                    .Set("health", c.Needs.Health)
                    .Set("maxHealth", c.Needs.MaxHealth)
                    .Set("fatigue", c.Needs.Fatigue))
                .Set("emotion", new JsonObject().Set("fear", c.Emotion.Fear))
                .Set("memory", JsonArray.Of(c.Memory, WriteMemory))
                .Set("relationships", JsonArray.Of(c.Relationships, r => (JsonValue)new JsonObject()
                    .Set("target", r.Target.Value)
                    .Set("trust", r.Trust)))
                .Set("goals", JsonArray.Of(c.Goals, WriteGoal))
                .Set("legacy", WriteLegacy(c.Legacy));

        private static JsonValue WriteMemory(MemoryEntry m) =>
            new JsonObject()
                .Set("memoryId", m.MemoryId.Value)
                .Set("kind", MemoryKindNames.Wire(m.Kind))
                .Set("tag", MemoryTagNames.Wire(m.Tag))
                .Set("importance", m.Importance)
                .Set("atTick", m.AtTick)
                .SetIfPresent("subject", m.Subject.HasValue
                    ? JsonValue.Of(m.Subject.Value.Value) : null)
                .Set("text", m.Text);

        private static JsonValue WriteGoal(Goal g) =>
            new JsonObject()
                .Set("goalId", g.GoalId.Value)
                .Set("kind", GoalKindNames.Wire(g.Kind))
                .Set("priority", g.Priority)
                .SetIfPresent("sourceMemory", g.SourceMemory.HasValue
                    ? JsonValue.Of(g.SourceMemory.Value.Value) : null)
                .Set("createdAtTick", g.CreatedAtTick);

        private static JsonValue WriteLegacy(Legacy l) =>
            new JsonObject()
                .Set("relics", JsonArray.Of(l.Relics, r => JsonValue.Of(r)))
                .Set("inheritedMemories", JsonArray.Of(l.InheritedMemories, m => JsonValue.Of(m.Value)))
                .Set("reputation", l.Reputation)
                .SetIfPresent("diedAtTick", l.DiedAtTick.HasValue
                    ? JsonValue.Of(l.DiedAtTick.Value) : null);

        private static JsonValue WriteEvent(WorldEvent e)
        {
            var obj = new JsonObject()
                .Set("eventId", e.EventId.Value)
                .Set("seq", e.Seq)
                .Set("tick", e.Tick)
                .Set("kind", e.Kind.ToString());

            switch (e)
            {
                case DeathEvent d:
                    return obj
                        .Set("subject", d.Subject.Value)
                        .Set("cause", DeathCauseNames.Wire(d.Cause))
                        .Set("witnesses", JsonArray.Of(d.Witnesses, w => JsonValue.Of(w.Value)));
                case RelationshipChangeEvent r:
                    return obj
                        .Set("from", r.From.Value)
                        .Set("to", r.To.Value)
                        .Set("trustBefore", r.TrustBefore)
                        .Set("trustAfter", r.TrustAfter)
                        .Set("cause", r.Cause);
                case MajorMemoryEvent m:
                    return obj
                        .Set("owner", m.Owner.Value)
                        .Set("memoryId", m.MemoryId.Value)
                        .Set("tag", MemoryTagNames.Wire(m.Tag))
                        .Set("importance", m.Importance);
                case MissionOutcomeEvent o:
                    return obj
                        .Set("participants", JsonArray.Of(o.Participants, p => JsonValue.Of(p.Value)))
                        .Set("outcome", MissionOutcomeNames.Wire(o.Outcome))
                        .Set("summary", o.Summary);
                case WorldDiscoveryEvent w:
                    return obj
                        .Set("discoveredBy", w.DiscoveredBy.Value)
                        .Set("what", w.What);
                case LegacyCreationEvent g:
                    return obj
                        .Set("from", g.From.Value)
                        .Set("relics", JsonArray.Of(g.Relics, r => JsonValue.Of(r)))
                        .Set("inheritedMemories",
                             JsonArray.Of(g.InheritedMemories, m => JsonValue.Of(m.Value)));
                default:
                    throw new NotSupportedException($"직렬화되지 않는 이벤트: {e.GetType().Name}");
            }
        }

        /* ───────── 읽기 ───────── */

        public static Snapshot Read(string text)
        {
            JsonObject root = Json.Parse(text).AsObject();

            var snapshot = new Snapshot
            {
                Version = root.Get("version").AsInt(),
                Tick = root.Get("tick").AsInt(),
                RngState = root.Get("rngState").AsUInt(),
                IdCounter = root.Get("idCounter").AsInt(),
            };
            Snapshots.AssertVersion(snapshot);

            var instances = new List<CharacterInstance>();
            foreach (JsonValue v in root.Get("instances").AsArray()) instances.Add(ReadInstance(v));
            snapshot.Instances = instances;

            var events = new List<WorldEvent>();
            foreach (JsonValue v in root.Get("events").AsArray()) events.Add(ReadEvent(v));
            snapshot.Events = events;

            return snapshot;
        }

        private static CharacterInstance ReadInstance(JsonValue value)
        {
            JsonObject o = value.AsObject();
            JsonObject identity = o.Get("identity").AsObject();
            JsonObject personality = o.Get("personality").AsObject();
            JsonObject needs = o.Get("needs").AsObject();
            JsonObject legacy = o.Get("legacy").AsObject();

            var instance = new CharacterInstance
            {
                InstanceId = new InstanceId(o.Get("instanceId").AsString()),
                Status = LifeStatusNames.Parse(o.Get("status").AsString()),
                Identity = new Identity
                {
                    Name = identity.Get("name").AsString(),
                    DefinitionId = new DefinitionId(identity.Get("definitionId").AsString()),
                    BornAtTick = identity.Get("bornAtTick").AsInt(),
                },
                Personality = new Personality
                {
                    Risk = personality.Get("risk").AsInt(),
                    Loyalty = personality.Get("loyalty").AsInt(),
                    Sociability = personality.Get("sociability").AsInt(),
                    Aggression = personality.Get("aggression").AsInt(),
                    Honesty = personality.Get("honesty").AsInt(),
                },
                Needs = new Needs
                {
                    Health = needs.Get("health").AsInt(),
                    MaxHealth = needs.Get("maxHealth").AsInt(),
                    Fatigue = needs.Get("fatigue").AsInt(),
                },
                Emotion = new Emotion { Fear = o.Get("emotion").AsObject().Get("fear").AsInt() },
                Legacy = new Legacy
                {
                    Reputation = legacy.Get("reputation").AsInt(),
                    DiedAtTick = legacy.Optional("diedAtTick") is JsonValue d ? d.AsInt() : (int?)null,
                },
            };

            foreach (JsonValue r in legacy.Get("relics").AsArray())
                instance.Legacy.Relics.Add(r.AsString());
            foreach (JsonValue m in legacy.Get("inheritedMemories").AsArray())
                instance.Legacy.InheritedMemories.Add(new MemoryId(m.AsString()));

            foreach (JsonValue v in o.Get("memory").AsArray())
            {
                JsonObject m = v.AsObject();
                instance.Memory.Add(new MemoryEntry
                {
                    MemoryId = new MemoryId(m.Get("memoryId").AsString()),
                    Kind = MemoryKindNames.Parse(m.Get("kind").AsString()),
                    Tag = MemoryTagNames.Parse(m.Get("tag").AsString()),
                    Importance = m.Get("importance").AsInt(),
                    AtTick = m.Get("atTick").AsInt(),
                    Subject = m.Optional("subject") is JsonValue s
                        ? new InstanceId(s.AsString()) : (InstanceId?)null,
                    Text = m.Get("text").AsString(),
                });
            }

            foreach (JsonValue v in o.Get("relationships").AsArray())
            {
                JsonObject r = v.AsObject();
                instance.Relationships.Add(new Relationship
                {
                    Target = new InstanceId(r.Get("target").AsString()),
                    Trust = r.Get("trust").AsInt(),
                });
            }

            foreach (JsonValue v in o.Get("goals").AsArray())
            {
                JsonObject g = v.AsObject();
                instance.Goals.Add(new Goal
                {
                    GoalId = new GoalId(g.Get("goalId").AsString()),
                    Kind = GoalKindNames.Parse(g.Get("kind").AsString()),
                    Priority = g.Get("priority").AsInt(),
                    SourceMemory = g.Optional("sourceMemory") is JsonValue sm
                        ? new MemoryId(sm.AsString()) : (MemoryId?)null,
                    CreatedAtTick = g.Get("createdAtTick").AsInt(),
                });
            }

            return instance;
        }

        private static WorldEvent ReadEvent(JsonValue value)
        {
            JsonObject o = value.AsObject();
            string kind = o.Get("kind").AsString();

            WorldEvent e;
            switch (kind)
            {
                case "Death":
                    var witnesses = new List<InstanceId>();
                    foreach (JsonValue w in o.Get("witnesses").AsArray())
                        witnesses.Add(new InstanceId(w.AsString()));
                    e = new DeathEvent
                    {
                        Subject = new InstanceId(o.Get("subject").AsString()),
                        Cause = DeathCauseNames.Parse(o.Get("cause").AsString()),
                        Witnesses = witnesses,
                    };
                    break;
                case "RelationshipChange":
                    e = new RelationshipChangeEvent
                    {
                        From = new InstanceId(o.Get("from").AsString()),
                        To = new InstanceId(o.Get("to").AsString()),
                        TrustBefore = o.Get("trustBefore").AsInt(),
                        TrustAfter = o.Get("trustAfter").AsInt(),
                        Cause = o.Get("cause").AsString(),
                    };
                    break;
                case "MajorMemory":
                    e = new MajorMemoryEvent
                    {
                        Owner = new InstanceId(o.Get("owner").AsString()),
                        MemoryId = new MemoryId(o.Get("memoryId").AsString()),
                        Tag = MemoryTagNames.Parse(o.Get("tag").AsString()),
                        Importance = o.Get("importance").AsInt(),
                    };
                    break;
                case "MissionOutcome":
                    var participants = new List<InstanceId>();
                    foreach (JsonValue p in o.Get("participants").AsArray())
                        participants.Add(new InstanceId(p.AsString()));
                    e = new MissionOutcomeEvent
                    {
                        Participants = participants,
                        Outcome = MissionOutcomeNames.Parse(o.Get("outcome").AsString()),
                        Summary = o.Get("summary").AsString(),
                    };
                    break;
                case "WorldDiscovery":
                    e = new WorldDiscoveryEvent
                    {
                        DiscoveredBy = new InstanceId(o.Get("discoveredBy").AsString()),
                        What = o.Get("what").AsString(),
                    };
                    break;
                case "LegacyCreation":
                    var relics = new List<string>();
                    foreach (JsonValue r in o.Get("relics").AsArray()) relics.Add(r.AsString());
                    var inherited = new List<MemoryId>();
                    foreach (JsonValue m in o.Get("inheritedMemories").AsArray())
                        inherited.Add(new MemoryId(m.AsString()));
                    e = new LegacyCreationEvent
                    {
                        From = new InstanceId(o.Get("from").AsString()),
                        Relics = relics,
                        InheritedMemories = inherited,
                    };
                    break;
                default:
                    throw new FormatException($"알 수 없는 이벤트 종류: {kind}");
            }

            // eventId / seq는 발급된 값을 그대로 되돌린다 — 복원 후 로그가 재번호되면
            // "동일 Event Log"가 거짓이 된다
            e.EventId = new EventId(o.Get("eventId").AsString());
            e.Seq = o.Get("seq").AsInt();
            e.Tick = o.Get("tick").AsInt();
            return e;
        }
    }
}
