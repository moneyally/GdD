using System;
using System.Collections.Generic;

namespace LivingWorld.Core.Decision
{
    /// <summary>
    /// L0 — 규칙/상태 계층. 효용 계산 이전에 확정적으로 결정되는 것들.
    /// 하나라도 적용되면 아래 층은 실행되지 않는다.
    ///
    /// 규칙 순서가 곧 우선순위다:
    ///  1. Master의 퇴각 조건이 가장 강하다 — 플레이어가 명시적으로 지정한 안전선이므로
    ///     캐릭터 자율성이 이걸 넘으면 플레이어가 통제 불능이라고 느낀다.
    ///  2. 방어 명령 + 높은 충성은 자리를 지킨다.
    ///
    /// 기억에서 파생된 목표는 **여기 없다.** L2 GOAP로 옮겼다 — L0가 RESCUE를 강제하면
    /// 부상당한 캐릭터가 아무 준비 없이 뛰어들어 죽는다. 목표는 "무엇을", 계획은 "어떻게"다.
    /// </summary>
    public static class L0Rules
    {
        public const int HoldLoyaltyThreshold = 85;
        public const int HoldFearCeiling = 80;

        public static ReasonCode Apply(AgentState state)
        {
            // 규칙 1 — Master 퇴각 조건
            double retreatAt = state.Order.RetreatHealthRatioBelow;
            if (retreatAt > 0 && state.HealthRatio < retreatAt)
            {
                return new ReasonCode
                {
                    Action = Action.Retreat,
                    Layer = DecisionLayer.L0,
                    Factors = new List<Factor>
                    {
                        Factor.Compare("health_ratio", Round2(state.HealthRatio), "<", retreatAt),
                        Factor.Of("order", "retreat_condition"),
                    },
                };
            }

            // 규칙 2 — 방어 명령 + 높은 충성은 자리를 지킨다
            if (state.Order.Goal == GoalOrder.Defend &&
                state.Personality.Loyalty >= HoldLoyaltyThreshold &&
                state.Fear < HoldFearCeiling)
            {
                return new ReasonCode
                {
                    Action = Action.Hold,
                    Layer = DecisionLayer.L0,
                    Factors = new List<Factor>
                    {
                        Factor.Of("order", "defend"),
                        Factor.Of("loyalty", state.Personality.Loyalty),
                    },
                    Overrides = new List<Factor> { Factor.Of("fear", state.Fear) },
                };
            }

            return null;
        }

        private static double Round2(double n) => Math.Floor(n * 100 + 0.5) / 100;
    }
}
