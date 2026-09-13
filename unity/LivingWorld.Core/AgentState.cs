using System.Collections.Generic;
using System.Linq;
using LivingWorld.Core.Decision;

namespace LivingWorld.Core
{
    /// <summary>판단에 쓰이는 기억 요약. 태그별 최대 importance만 남긴다.</summary>
    public sealed class MemoryInfluence
    {
        public MemoryTag Tag;
        public int Importance;
        public MemoryId MemoryId;
    }

    /// <summary>
    /// 3층: AgentState — 판단에만 쓰이는 현재 상태. Instance에서 파생되며 저장되지 않는다.
    ///
    /// 판단 함수는 Instance를 직접 읽지 않고 이 타입만 받는다:
    /// 1. 판단 입력이 명시적으로 고정되므로 ReasonCode가 거짓말을 할 수 없다
    /// 2. 나중에 "캐릭터가 세계를 잘못 인식한다"(불신뢰 보고)를 넣을 때
    ///    Instance는 진실, AgentState는 인식으로 갈라지는 자리가 이미 준비된다
    ///
    /// 모든 컬렉션은 **복사본**이다. Instance의 리스트를 참조로 들면 행동 이후의 변화가
    /// '판단 시점 State'에 비쳐서 디버거가 거짓 근거를 보여준다 — 실제로 겪은 결함이다.
    /// </summary>
    public sealed class AgentState
    {
        public InstanceId Self;
        public Personality Personality;
        /// <summary>현재 체력 비율 0..1</summary>
        public double HealthRatio;
        public int Fear;
        /// <summary>상황의 대상(쓰러진 동료)에 대한 신뢰</summary>
        public int TrustInSubject;
        public InstanceId? Subject;
        /// <summary>이 상황에서 자신이 감수할 위험 0..100</summary>
        public double SelfRisk;
        /// <summary>행동 여력 0..100. 체력에서 피로를 뺀 값 — L2 계획의 자원.</summary>
        public double Stamina;
        public IReadOnlyList<MemoryInfluence> MemoryInfluences = new List<MemoryInfluence>();
        public IReadOnlyList<Goal> Goals = new List<Goal>();
        public MasterOrder Order;
        public int Tick;

        /// <summary>
        /// Instance + 상황 + 명령 → AgentState.
        ///
        /// selfRisk는 상황의 위협도에 자기 상태를 반영해 계산한다. 부상 중이면 같은 적도 더 위험하다.
        /// 이 한 줄이 "행동 후 State가 변했으므로 다음 판단이 달라진다"의 핵심 경로다.
        /// </summary>
        public static AgentState Build(CharacterInstance self, Situation situation, MasterOrder order)
        {
            double h = (double)self.Needs.Health / self.Needs.MaxHealth;
            double injuryMultiplier = 1 + (1 - h) * 0.6;

            return new AgentState
            {
                Self = self.InstanceId,
                Personality = self.Personality,
                HealthRatio = h,
                Fear = self.Emotion.Fear,
                Subject = situation.Subject,
                TrustInSubject = self.TrustToward(situation.Subject),
                SelfRisk = JsMath.Clamp(situation.EnemyThreat * injuryMultiplier, 0, 100),
                Stamina = JsMath.Clamp(h * 100 - self.Needs.Fatigue, 0, 100),
                MemoryInfluences = SummarizeMemory(self),
                Goals = self.Goals.ToList(),
                Order = order,
                Tick = situation.Tick,
            };
        }

        /// <summary>
        /// 같은 태그의 기억이 여러 개면 가장 중요한 것만 판단에 올린다.
        ///
        /// 순서가 중요하다: 태그의 **첫 등장 순서**를 유지한 뒤 importance 내림차순으로
        /// 안정 정렬한다. dominantMemory가 동점을 앞선 것으로 결정하므로, 순서가 달라지면
        /// ReasonCode의 memory= 필드가 언어마다 달라진다.
        /// </summary>
        private static List<MemoryInfluence> SummarizeMemory(CharacterInstance self)
        {
            var order = new List<MemoryTag>();
            var strongest = new Dictionary<MemoryTag, MemoryInfluence>();

            foreach (var entry in self.Memory)
            {
                if (!strongest.TryGetValue(entry.Tag, out var current))
                {
                    order.Add(entry.Tag);
                    strongest[entry.Tag] = new MemoryInfluence
                    {
                        Tag = entry.Tag, Importance = entry.Importance, MemoryId = entry.MemoryId,
                    };
                }
                else if (entry.Importance > current.Importance)
                {
                    current.Importance = entry.Importance;
                    current.MemoryId = entry.MemoryId;
                }
            }

            return order.Select(t => strongest[t])
                        .OrderByDescending(x => x.Importance)
                        .ToList();
        }
    }
}
