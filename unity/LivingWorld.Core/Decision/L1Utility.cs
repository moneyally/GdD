using System;
using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core.Decision
{
    public sealed class UtilityScore
    {
        public Action Action;
        public double Score;
    }

    public sealed class L1Result
    {
        public ReasonCode Reason;
        /// <summary>디버거용 전체 점수. 플레이어 로그에는 쓰지 않는다.</summary>
        public IReadOnlyList<UtilityScore> Scores;
    }

    /// <summary>
    /// L1 — 유틸리티 계층. 각 행동의 효용을 계산하고 최고점을 고른다.
    ///
    /// 가중치는 전부 이 클래스 상단에 모아둔다. 밸런스 조정이 코드 수정이 아니라
    /// 숫자 한 곳 수정이 되게 하는 것이 목적이다.
    ///
    /// ReasonCode에 싣는 수치는 효용 점수가 아니라 **입력 값**이다.
    /// 플레이어에게 "rescue=62.4"는 의미가 없고 "trust=80이라서 구하러 갔다"가 의미 있다.
    /// </summary>
    public static class L1Utility
    {
        // rescue
        private const double RTrust = 0.9, RCalm = 0.6, RSelfRisk = -0.8, RLoy = 0.3, RRisk = 0.2;
        // retreat
        private const double TFear = 0.9, TSelfRisk = 0.7, TTrust = -0.5, TLoy = -0.3;
        // hold
        private const double HBase = 40, HLoy = 0.2, HFear = -0.2;
        // attack
        private const double AAggr = 0.7, ACalm = 0.4, ASelfRisk = -0.6;

        /// <summary>기억 태그별 가산 — '기억이 판단을 바꾼다'의 L1 경로.</summary>
        private static double RescueMemoryWeight(MemoryTag tag)
        {
            switch (tag)
            {
                case MemoryTag.RescuedAlly: return 0.2;
                case MemoryTag.WoundedInRescue: return -0.25;
                case MemoryTag.WitnessedAllyDeath: return 0.1;
                case MemoryTag.AllyDiedUnrescued: return 0.5;
                default: return 0;
            }
        }

        private static double RetreatMemoryWeight(MemoryTag tag)
        {
            switch (tag)
            {
                case MemoryTag.WoundedInRescue: return 0.3;
                case MemoryTag.AllyDiedUnrescued: return -0.3;
                default: return 0;
            }
        }

        /// <summary>행동 순서 — 동점이면 이 순서로 결정된다 (결정론 유지).</summary>
        private static readonly Action[] Order =
            { Action.Rescue, Action.Retreat, Action.Hold, Action.Attack };

        public static List<UtilityScore> ScoreActions(AgentState s)
        {
            int appetite = MasterOrder.Appetite(s.Order.RiskPolicy);
            double dLoyalty = s.Personality.Loyalty - 50;
            double dRisk = s.Personality.Risk - 50;
            double calm = 100 - s.Fear;

            double rescue = RTrust * s.TrustInSubject + RCalm * calm + RSelfRisk * s.SelfRisk
                          + RLoy * dLoyalty + RRisk * dRisk + appetite
                          + MemoryBonus(s, RescueMemoryWeight);

            double retreat = TFear * s.Fear + TSelfRisk * s.SelfRisk + TTrust * s.TrustInSubject
                           + TLoy * dLoyalty - appetite
                           + MemoryBonus(s, RetreatMemoryWeight);

            double hold = HBase + HLoy * dLoyalty + HFear * s.Fear;

            double attack = AAggr * s.Personality.Aggression + ACalm * calm
                          + ASelfRisk * s.SelfRisk + appetite;

            return new List<UtilityScore>
            {
                new UtilityScore { Action = Action.Rescue, Score = rescue },
                new UtilityScore { Action = Action.Retreat, Score = retreat },
                new UtilityScore { Action = Action.Hold, Score = hold },
                new UtilityScore { Action = Action.Attack, Score = attack },
            };
        }

        public static L1Result Apply(AgentState s)
        {
            var scores = ScoreActions(s);

            // JS의 reduce((a,b) => b.score > a.score ? b : a) — 엄격 비교이므로 동점은 앞선 것이 이긴다
            UtilityScore best = scores[0];
            foreach (var candidate in scores)
                if (candidate.Score > best.Score) best = candidate;

            return new L1Result
            {
                Reason = new ReasonCode
                {
                    Action = best.Action,
                    Layer = DecisionLayer.L1,
                    Factors = FactorsFor(best.Action, s),
                },
                Scores = scores,
            };
        }

        /// <summary>선택된 행동을 설명하는 입력 값만 고른다. 관련 없는 수치를 나열하지 않는다.</summary>
        private static List<Factor> FactorsFor(Action action, AgentState s)
        {
            var factors = new List<Factor>();

            switch (action)
            {
                case Action.Rescue:
                    if (s.Subject.HasValue) factors.Add(Factor.Of("target", s.Subject.Value.Value));
                    factors.Add(Factor.Of("trust", JsMath.Round(s.TrustInSubject)));
                    factors.Add(Factor.Of("fear", JsMath.Round(s.Fear)));
                    factors.Add(Factor.Of("self_risk", JsMath.Round(s.SelfRisk)));
                    AddDominantMemory(factors, s, RescueMemoryWeight);
                    break;

                case Action.Retreat:
                    factors.Add(Factor.Of("fear", JsMath.Round(s.Fear)));
                    factors.Add(Factor.Of("self_risk", JsMath.Round(s.SelfRisk)));
                    factors.Add(Factor.Of("trust", JsMath.Round(s.TrustInSubject)));
                    AddDominantMemory(factors, s, RetreatMemoryWeight);
                    break;

                case Action.Hold:
                    factors.Add(Factor.Of("order", MasterOrder.Wire(s.Order.Goal)));
                    factors.Add(Factor.Of("loyalty", s.Personality.Loyalty));
                    factors.Add(Factor.Of("fear", JsMath.Round(s.Fear)));
                    break;

                default:
                    factors.Add(Factor.Of("aggression", s.Personality.Aggression));
                    factors.Add(Factor.Of("self_risk", JsMath.Round(s.SelfRisk)));
                    break;
            }

            return factors;
        }

        /// <summary>이 행동에 실제로 영향을 준 기억 중 가장 강한 것 하나만 ReasonCode에 싣는다.</summary>
        private static void AddDominantMemory(
            List<Factor> factors, AgentState s, Func<MemoryTag, double> weight)
        {
            MemoryTag? bestTag = null;
            double bestEffect = 0;

            foreach (var influence in s.MemoryInfluences)
            {
                double effect = weight(influence.Tag) * influence.Importance;
                if (effect == 0) continue;
                if (bestTag == null || Math.Abs(effect) > Math.Abs(bestEffect))
                {
                    bestTag = influence.Tag;
                    bestEffect = effect;
                }
            }

            if (bestTag != null)
                factors.Add(Factor.Of("memory", MemoryTagNames.Wire(bestTag.Value)));
        }

        private static double MemoryBonus(AgentState s, Func<MemoryTag, double> weight) =>
            s.MemoryInfluences.Sum(i => weight(i.Tag) * i.Importance);
    }
}
