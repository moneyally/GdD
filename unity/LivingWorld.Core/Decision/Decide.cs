using System.Collections.Generic;

namespace LivingWorld.Core.Decision
{
    public sealed class DecisionResult
    {
        public ReasonCode Reason;
        /// <summary>L1이 실행된 경우에만 존재. 디버거용.</summary>
        public IReadOnlyList<UtilityScore> Scores;
        /// <summary>L2가 계획을 세운 경우에만 존재.</summary>
        public Plan Plan;
    }

    /// <summary>
    /// Decision Stack 진입점 — 규칙 5.
    ///
    /// L0 규칙/상태 → L2 GOAP(다단계 목표) → L1 유틸리티.
    ///
    /// 호출 순서가 규칙 5의 나열 순서(L0 → L1 → L2)와 다른 이유:
    /// L1은 **단일 행동**의 효용을 비교하는 층이고 L2는 **여러 걸음이 필요한 목표**를 다룬다.
    /// 한 번의 행동으로 달성할 수 없는 목표를 L1에 먼저 물으면 목표가 무시된 답이 나온다.
    /// L1은 언제나 답을 내므로 판단이 비는 경우는 없다.
    ///
    /// LLM은 여기에 없다. 앞으로도 이 함수에 들어오지 않는다.
    /// LLM은 이미 결정된 Decision을 캐릭터 시점으로 서술하는 데만 쓰인다.
    /// </summary>
    public static class Decider
    {
        public static DecisionResult Decide(AgentState state)
        {
            var l0 = L0Rules.Apply(state);
            if (l0 != null) return new DecisionResult { Reason = l0 };

            var l2 = L2Goap.Apply(state);
            if (l2 != null) return new DecisionResult { Reason = l2.Reason, Plan = l2.Plan };

            var l1 = L1Utility.Apply(state);
            return new DecisionResult { Reason = l1.Reason, Scores = l1.Scores };
        }
    }
}
