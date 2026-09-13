using System;
using System.Collections.Generic;

namespace LivingWorld.Core
{
    /* ───────── 1층: Definition — 정적 설계 ───────── */

    public readonly struct Range
    {
        public int Min { get; }
        public int Max { get; }
        public Range(int min, int max) { Min = min; Max = max; }
    }

    public sealed class PersonalityRanges
    {
        public Range Risk;
        public Range Loyalty;
        public Range Sociability;
        public Range Aggression;
        public Range Honesty;
    }

    /// <summary>
    /// 규칙 8에 따라 같은 Definition을 다시 획득하면 완전히 다른 개체가 나온다.
    /// 그래서 Definition이 담는 것은 "확정된 성격"이 아니라 "성격이 뽑힐 범위"다.
    /// </summary>
    public sealed class CharacterDefinition
    {
        public DefinitionId DefinitionId;
        public string Archetype;
        public IReadOnlyList<string> NamePool;
        public PersonalityRanges PersonalityRanges;
        public int BaseHealth;
    }

    /* ───────── 2층: Instance — 소유된 영속 개체 ───────── */

    public enum LifeStatus { Alive, Dead }

    public sealed class Identity
    {
        public string Name;
        /// <summary>소유권은 Definition에 귀속된다 (OPEN-QUESTIONS 6-1).</summary>
        public DefinitionId DefinitionId;
        public int BornAtTick;
    }

    /// <summary>생성 시 Definition의 범위에서 뽑혀 고정된다. 이후 변하지 않는다.</summary>
    public sealed class Personality
    {
        public int Risk;
        public int Loyalty;
        public int Sociability;
        public int Aggression;
        public int Honesty;

        public Personality Clone() => new Personality
        {
            Risk = Risk, Loyalty = Loyalty, Sociability = Sociability,
            Aggression = Aggression, Honesty = Honesty,
        };
    }

    public sealed class Needs
    {
        public int Health;
        public int MaxHealth;
        public int Fatigue;
    }

    /// <summary>MVP: fear 1축.</summary>
    public sealed class Emotion
    {
        public int Fear;
    }

    public enum MemoryKind { Episodic, Social }

    /// <summary>
    /// 기억 태그. 새 태그를 추가할 때 판단 계층에서의 의미도 함께 정의해야 한다.
    /// 문자열 자유 입력을 막아 "기억이 판단을 바꾼다"는 경로를 추적 가능하게 유지한다.
    /// </summary>
    public enum MemoryTag
    {
        /// <summary>내가 구하지 않아서 동료가 죽었다 (퇴각·방어·교전 무엇을 했든).</summary>
        AllyDiedUnrescued,
        RescuedAlly,
        WoundedInRescue,
        WitnessedAllyDeath,
    }

    public static class MemoryTagNames
    {
        public static string Wire(MemoryTag tag)
        {
            switch (tag)
            {
                case MemoryTag.AllyDiedUnrescued: return "ally_died_unrescued";
                case MemoryTag.RescuedAlly: return "rescued_ally";
                case MemoryTag.WoundedInRescue: return "wounded_in_rescue";
                case MemoryTag.WitnessedAllyDeath: return "witnessed_ally_death";
                default: throw new ArgumentOutOfRangeException(nameof(tag));
            }
        }
    }

    public sealed class MemoryEntry
    {
        public MemoryId MemoryId;
        public MemoryKind Kind;
        public MemoryTag Tag;
        public int Importance;
        public int AtTick;
        /// <summary>관련 대상. 없으면 null.</summary>
        public InstanceId? Subject;
        public string Text;
    }

    /// <summary>MVP: trust 1축.</summary>
    public sealed class Relationship
    {
        public InstanceId Target;
        public int Trust;
    }

    public enum GoalKind { NeverAbandonAlly, Survive }

    public static class GoalKindNames
    {
        public static string Wire(GoalKind kind) =>
            kind == GoalKind.NeverAbandonAlly ? "never_abandon_ally" : "survive";
    }

    public sealed class Goal
    {
        public GoalId GoalId;
        public GoalKind Kind;
        public int Priority;
        /// <summary>이 목표를 만든 기억. 근거 추적용 — ReasonCode에 실린다.</summary>
        public MemoryId? SourceMemory;
        public int CreatedAtTick;
    }

    /// <summary>죽음 이후 후속 캐릭터에게 승계될 것 (규칙 7).</summary>
    public sealed class Legacy
    {
        public List<string> Relics = new List<string>();
        public List<MemoryId> InheritedMemories = new List<MemoryId>();
        public int Reputation;
        public int? DiedAtTick;
    }

    /// <summary>
    /// 규칙 2가 요구하는 8개 도메인을 모두 갖는다:
    /// Identity, Personality, Needs, Emotion, Memory, Relationship, Goals, Legacy.
    /// </summary>
    public sealed class CharacterInstance
    {
        public InstanceId InstanceId;
        public LifeStatus Status = LifeStatus.Alive;
        public Identity Identity;
        public Personality Personality;
        public Needs Needs;
        public Emotion Emotion;
        public List<MemoryEntry> Memory = new List<MemoryEntry>();
        public List<Relationship> Relationships = new List<Relationship>();
        public List<Goal> Goals = new List<Goal>();
        public Legacy Legacy = new Legacy();

        public bool IsAlive => Status == LifeStatus.Alive;

        public int TrustToward(InstanceId target)
        {
            foreach (var r in Relationships)
                if (r.Target == target) return r.Trust;
            return 0;
        }
    }

    /* ───────── 4층: Actor — 렌더 실체 ───────── */

    /// <summary>
    /// 렌더러에 넘기는 읽기 전용 표시 상태. 판단 입력으로 쓰지 않는다.
    ///
    /// 이 타입이 여기 있는 이유는 경계를 긋기 위해서다: Unity 쪽 MonoBehaviour는
    /// CharacterInstance를 직접 만지지 않고 이 뷰만 받는다 (규칙 1).
    /// </summary>
    public readonly struct ActorView
    {
        public InstanceId InstanceId { get; }
        public string DisplayName { get; }
        public LifeStatus Status { get; }
        public double HealthRatio { get; }
        public int Fear { get; }

        public ActorView(CharacterInstance c)
        {
            InstanceId = c.InstanceId;
            DisplayName = c.Identity.Name;
            Status = c.Status;
            HealthRatio = (double)c.Needs.Health / c.Needs.MaxHealth;
            Fear = c.Emotion.Fear;
        }
    }
}
