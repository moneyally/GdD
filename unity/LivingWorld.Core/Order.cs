using System;

namespace LivingWorld.Core
{
    /// <summary>
    /// Master 명령. 브리핑에 따라 3개뿐이다 — Goal, RiskPolicy, RetreatCondition.
    /// 마이크로 조작은 존재하지 않는다.
    /// </summary>
    public enum GoalOrder { Defend, Advance, Preserve }

    public enum RiskPolicy { Cautious, Balanced, Aggressive }

    public sealed class MasterOrder
    {
        public GoalOrder Goal = GoalOrder.Advance;
        public RiskPolicy RiskPolicy = RiskPolicy.Balanced;
        /// <summary>체력 비율이 이 값 아래로 떨어지면 퇴각을 강제한다. 0이면 조건 없음.</summary>
        public double RetreatHealthRatioBelow = 0.2;

        public static int Appetite(RiskPolicy policy)
        {
            switch (policy)
            {
                case RiskPolicy.Cautious: return -15;
                case RiskPolicy.Balanced: return 0;
                case RiskPolicy.Aggressive: return 15;
                default: throw new ArgumentOutOfRangeException(nameof(policy));
            }
        }

        public static string Wire(GoalOrder goal)
        {
            switch (goal)
            {
                case GoalOrder.Defend: return "defend";
                case GoalOrder.Advance: return "advance";
                case GoalOrder.Preserve: return "preserve";
                default: throw new ArgumentOutOfRangeException(nameof(goal));
            }
        }
    }
}
