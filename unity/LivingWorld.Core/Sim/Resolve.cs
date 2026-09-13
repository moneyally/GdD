using System;
using System.Collections.Generic;
using System.Linq;
using LivingWorld.Core.Data;
using LivingWorld.Core.Decision;

namespace LivingWorld.Core.Sim
{
    /// <summary>결과 수치는 전부 여기 모아둔다.</summary>
    public static class Outcome
    {
        public const double RescueDamageRatio = 0.7;
        public const int RescuedTrustGain = 18;
        /// <summary>구조한 쪽의 신뢰 상승. 구조된 쪽보다 작다 — 목숨을 구해준 쪽의 체감이 더 크다.</summary>
        public const int RescuerTrustGain = 8;
        public const double RescueFearGainRatio = 0.5;
        public const int RetreatFearDecay = 8;
        public const int AbandonMemoryImportance = 90;
        public const int NeverAbandonGoalPriority = 85;
        public const int RescueMemoryImportance = 55;
        public const int WoundMemoryImportance = 45;
        /// <summary>동료의 죽음을 목격한 기억의 중요도. 내 탓(Abandon 90)보다 약하다.</summary>
        public const int WitnessMemoryImportance = 60;
        /// <summary>조우 1회당 누적 피로. 오래 버틸수록 행동 여력이 줄어든다.</summary>
        public const int FatiguePerEncounter = 6;
        /// <summary>같은 일이 반복될 때 기존 기억이 강화되는 정도.</summary>
        public const int MemoryReinforcement = 3;
    }

    /// <summary>한 명의 판단.</summary>
    public sealed class ActorDecision
    {
        public InstanceId Actor;
        public Decision.Action Action;
        /// <summary>L2가 세운 계획. 연막이 포함되면 실제 위협이 줄어 피해도 줄어든다.</summary>
        public IReadOnlyList<PlanStep> Plan;
    }

    /// <summary>
    /// 한 조우의 결과.
    ///
    /// 여러 명이 같은 상황을 보고 각자 판단하므로 결과는 판단의 **집합**에서 나온다:
    /// 한 명이라도 구하러 가면 쓰러진 동료는 살고, 아무도 안 가면 죽는다.
    /// 그래서 행동자별로 따로 처리할 수 없다 — 한 트랜잭션이 전원의 판단을 함께 받는다.
    /// </summary>
    public sealed class ResolveRequest
    {
        public Situation Situation;
        public IReadOnlyList<ActorDecision> Decisions = new List<ActorDecision>();
    }

    public sealed class ResolveResult
    {
        public List<InstanceId> Died = new List<InstanceId>();
        public Dictionary<InstanceId, int> DamageByActor = new Dictionary<InstanceId, int>();
        public bool Rescued;
        public IReadOnlyList<WorldEvent> Events = new List<WorldEvent>();
    }

    public sealed class ResolveTransaction : ITransaction<ResolveRequest, ResolveResult>
    {
        public string Name => "ResolveAction";

        public string Validate(World world, ResolveRequest request)
        {
            if (request.Decisions.Count == 0) return "판단이 비어 있다";
            var subject = world.Find(request.Situation.Subject);
            if (subject == null) return $"알 수 없는 대상: {request.Situation.Subject}";
            if (!subject.IsAlive) return $"이미 죽은 대상: {request.Situation.Subject}";

            var seen = new HashSet<InstanceId>();
            foreach (var decision in request.Decisions)
            {
                var actor = world.Find(decision.Actor);
                if (actor == null) return $"알 수 없는 Instance: {decision.Actor}";
                if (!actor.IsAlive) return $"죽은 캐릭터는 행동할 수 없다: {decision.Actor}";
                if (actor.InstanceId == subject.InstanceId) return "쓰러진 당사자는 판단하지 않는다";
                if (!seen.Add(decision.Actor))
                    return $"같은 캐릭터의 판단이 두 번 들어왔다: {decision.Actor}";
            }
            return null;
        }

        public ResolveResult Apply(World world, ResolveRequest request)
        {
            int before = world.Events.Count;
            var subject = world.Instance(request.Situation.Subject);
            int tick = request.Situation.Tick;
            var result = new ResolveResult();

            /*
             * 구조는 RESCUE만이다.
             *
             * 한때 ATTACK도 구조로 처리했는데, 그러면 동료에게 관심 없는 캐릭터가 적에게
             * 달려들면서 우연히 동료를 구한다. 실측에서 편성(신뢰 50)과 미편성(신뢰 0)의
             * 구조율이 93% 대 92%로 같아졌다 — 관계가 판단에 영향을 준다는 전제가
             * ATTACK 경로로 새고 있었다. 적을 치는 것과 쓰러진 사람을 끌어내는 것은 다른 행동이다.
             */
            result.Rescued = request.Decisions.Any(d => d.Action == Decision.Action.Rescue);

            foreach (var decision in request.Decisions)
            {
                var actor = world.Instance(decision.Actor);
                actor.Needs.Fatigue = JsMath.ClampInt(
                    actor.Needs.Fatigue + Outcome.FatiguePerEncounter, 0, 100);

                bool engaged = decision.Action == Decision.Action.Rescue
                            || decision.Action == Decision.Action.Attack;

                if (engaged)
                {
                    bool isRescue = decision.Action == Decision.Action.Rescue;
                    int threat = L2Goap.EffectiveThreat(request.Situation.EnemyThreat, decision.Plan);
                    // 인원수로 나누지 않는다. 나누면 self_risk와 실제 피해가 달라져
                    // ReasonCode의 근거가 거짓이 된다.
                    int damage = JsMath.Round(threat * Outcome.RescueDamageRatio);
                    result.DamageByActor[actor.InstanceId] = damage;

                    actor.Needs.Health = JsMath.ClampInt(
                        actor.Needs.Health - damage, 0, actor.Needs.MaxHealth);
                    actor.Emotion.Fear = JsMath.ClampInt(
                        actor.Emotion.Fear + JsMath.Round(damage * Outcome.RescueFearGainRatio), 0, 100);

                    if (isRescue)
                    {
                        // 관계는 양방향으로 변한다 — 둘 다 Event로 기록 (규칙 3)
                        RaiseTrust(world, subject, actor.InstanceId, Outcome.RescuedTrustGain, tick, "rescued_by");
                        RaiseTrust(world, actor, subject.InstanceId, Outcome.RescuerTrustGain, tick, "rescued_them");

                        AddMemory(world, actor, MemoryTag.RescuedAlly, Outcome.RescueMemoryImportance,
                            tick, subject.InstanceId, $"{Josa.Object(subject.Identity.Name)} 적 앞에서 끌어냈다.");

                        if (damage > 0)
                            AddMemory(world, actor, MemoryTag.WoundedInRescue, Outcome.WoundMemoryImportance,
                                tick, null, "그 대가로 깊은 상처를 입었다.");
                    }

                    if (actor.Needs.Health <= 0)
                    {
                        Kill(world, actor, DeathCause.KilledByEnemy,
                             new List<InstanceId> { subject.InstanceId }, tick);
                        result.Died.Add(actor.InstanceId);
                    }
                }
                else
                {
                    result.DamageByActor[actor.InstanceId] = 0;
                    actor.Emotion.Fear = JsMath.ClampInt(
                        actor.Emotion.Fear - Outcome.RetreatFearDecay, 0, 100);
                }
            }

            if (!result.Rescued)
            {
                // 아무도 구하지 않았으므로 쓰러진 동료는 죽는다
                Kill(world, subject, DeathCause.Abandoned,
                     request.Decisions.Select(d => d.Actor).ToList(), tick);
                result.Died.Add(subject.InstanceId);

                // 구하지 않은 각자에게 기억이 생기고, 기억이 목표를 만든다.
                // 교전을 택한 사람도 포함된다 — 그도 구하지는 않았다.
                foreach (var decision in request.Decisions)
                {
                    var actor = world.Instance(decision.Actor);
                    if (!actor.IsAlive) continue;
                    string text = decision.Action == Decision.Action.Attack
                        ? $"나는 적을 쫓았고, {Josa.Topic(subject.Identity.Name)} 그 사이에 죽었다."
                        : $"내가 물러섰고, {Josa.Topic(subject.Identity.Name)} 거기서 죽었다.";
                    var memory = AddMemory(world, actor, MemoryTag.AllyDiedUnrescued,
                        Outcome.AbandonMemoryImportance, tick, subject.InstanceId, text);
                    AddGoalFromMemory(actor, memory.MemoryId, tick);
                }
            }

            /*
             * 죽음을 목격하면 기억이 남는다.
             *
             * 이 블록이 없던 동안 WitnessedAllyDeath 태그는 정의되고 L1 가중치까지 있는데
             * 아무도 만들지 않았다 — 동료가 눈앞에서 죽어도 아무 기억이 안 남았다.
             * "그 역사 때문에 다음 캐릭터의 행동이 달라진다"는 전제와 정면으로 어긋난다.
             *
             * 내 탓인 경우(AllyDiedUnrescued)와는 다른 사실이므로 태그를 따로 둔다.
             * 같은 사건에 두 기억을 겹쳐 쌓지 않도록, 방치로 죽은 대상에 대해서는 목격 기억을 남기지 않는다.
             */
            foreach (var victimId in result.Died.ToList())
            {
                var victim = world.Instance(victimId);
                bool abandoned = !result.Rescued && victimId == subject.InstanceId;
                if (abandoned) continue;

                var observers = request.Decisions
                    .Select(d => world.Instance(d.Actor))
                    .Where(actor => actor.IsAlive && actor.InstanceId != victimId)
                    .ToList();

                // 구조된 당사자도 목격자다 — 나를 구하다 죽은 사람을 잊지 않는다
                if (result.Rescued && subject.IsAlive && subject.InstanceId != victimId)
                    observers.Add(subject);

                foreach (var observer in observers)
                    AddMemory(world, observer, MemoryTag.WitnessedAllyDeath,
                        Outcome.WitnessMemoryImportance, tick, victimId,
                        $"{Josa.Topic(victim.Identity.Name)} 눈앞에서 죽었다.");
            }

            world.Events.Append(new MissionOutcomeEvent
            {
                Tick = tick,
                Participants = request.Decisions.Select(d => d.Actor)
                    .Concat(new[] { subject.InstanceId }).ToList(),
                Outcome = result.Died.Count == 0 ? MissionOutcomeKind.Success : MissionOutcomeKind.Partial,
                Summary = string.Join(" ", request.Decisions.Select(d =>
                    $"{world.Instance(d.Actor).Identity.Name}:{ActionNames.Wire(d.Action)}")),
            });

            result.Events = world.Events.All().Skip(before).ToList();
            return result;
        }

        private static void RaiseTrust(World world, CharacterInstance holder, InstanceId target,
                                      int delta, int tick, string cause)
        {
            var relationship = holder.Relationships.FirstOrDefault(r => r.Target == target);
            if (relationship == null)
            {
                relationship = new Relationship { Target = target, Trust = 50 };
                holder.Relationships.Add(relationship);
            }
            int before = relationship.Trust;
            relationship.Trust = JsMath.ClampInt(before + delta, 0, 100);

            world.Events.Append(new RelationshipChangeEvent
            {
                Tick = tick, From = holder.InstanceId, To = target,
                TrustBefore = before, TrustAfter = relationship.Trust, Cause = cause,
            });
        }

        /// <summary>
        /// 기억을 남긴다. 같은 태그·같은 대상의 기억이 이미 있으면 새로 쌓지 않고 강화한다.
        ///
        /// 반복되는 사건마다 항목을 추가하면 Instance가 중복 기억으로 부풀고 Snapshot도 커진다.
        /// 사람의 기억도 같은 일이 반복되면 개별 사건이 아니라 하나의 강한 인상으로 남는다.
        ///
        /// 강화는 새로운 사건이 아니므로 MajorMemory Event를 다시 남기지 않는다 —
        /// Event Log는 중요한 **변화**를 기록하고, 현재 상태는 Snapshot이 갖는다.
        /// </summary>
        private static MemoryEntry AddMemory(World world, CharacterInstance owner, MemoryTag tag,
                                            int importance, int tick, InstanceId? subject, string text)
        {
            var existing = owner.Memory.FirstOrDefault(
                m => m.Tag == tag && Nullable.Equals(m.Subject, subject));
            if (existing != null)
            {
                existing.Importance = JsMath.ClampInt(
                    existing.Importance + Outcome.MemoryReinforcement, 0, 100);
                existing.AtTick = tick;
                return existing;
            }

            var entry = new MemoryEntry
            {
                MemoryId = new MemoryId(world.Ids.Next().ToString().PadLeft(4, '0')),
                Kind = subject.HasValue ? MemoryKind.Social : MemoryKind.Episodic,
                Tag = tag,
                Importance = importance,
                AtTick = tick,
                Subject = subject,
                Text = text,
            };
            owner.Memory.Add(entry);

            world.Events.Append(new MajorMemoryEvent
            {
                Tick = tick, Owner = owner.InstanceId, MemoryId = entry.MemoryId,
                Tag = entry.Tag, Importance = entry.Importance,
            });

            return entry;
        }

        /// <summary>
        /// 기억 → 목표. 이 함수가 "기억이 판단을 바꾼다"의 유일한 경로다.
        /// 생성된 목표는 L2가 계획으로 풀어낸다.
        /// </summary>
        private static void AddGoalFromMemory(CharacterInstance owner, MemoryId source, int tick)
        {
            if (owner.Goals.Any(g => g.Kind == GoalKind.NeverAbandonAlly)) return;
            owner.Goals.Add(new Goal
            {
                GoalId = new GoalId($"{owner.InstanceId.Value}_never_abandon"),
                Kind = GoalKind.NeverAbandonAlly,
                Priority = Outcome.NeverAbandonGoalPriority,
                SourceMemory = source,
                CreatedAtTick = tick,
            });
        }

        /// <summary>규칙 7 — 죽음은 최종. 삭제하지 않고 dead로 남긴다.</summary>
        private static void Kill(World world, CharacterInstance victim, DeathCause cause,
                                IReadOnlyList<InstanceId> witnesses, int tick)
        {
            victim.Status = LifeStatus.Dead;
            victim.Needs.Health = 0;
            victim.Legacy.DiedAtTick = tick;

            world.Events.Append(new DeathEvent
            {
                Tick = tick, Subject = victim.InstanceId, Cause = cause, Witnesses = witnesses,
            });

            world.Events.Append(new LegacyCreationEvent
            {
                Tick = tick, From = victim.InstanceId, Relics = victim.Legacy.Relics.ToList(),
                InheritedMemories = victim.Memory.Where(m => m.Importance >= 70)
                                                 .Select(m => m.MemoryId).ToList(),
            });
        }
    }
}
