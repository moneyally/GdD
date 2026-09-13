using System;
using System.Collections.Generic;

namespace LivingWorld.Core.Decision
{
    /// <summary>계획 안의 한 걸음.</summary>
    public enum PlanStep { Suppress, Rescue, FallBack }

    public static class PlanStepNames
    {
        public static string Wire(PlanStep s)
        {
            switch (s)
            {
                case PlanStep.Suppress: return "SUPPRESS";
                case PlanStep.Rescue: return "RESCUE";
                default: return "FALL_BACK";
            }
        }
    }

    /// <summary>
    /// 플래너가 머릿속에서 굴리는 세계 모델. 실제 세계 상태가 아니다 —
    /// 캐릭터가 세계를 잘못 알고 있으면 계획도 틀린다. 그 자리를 여기 남겨둔다.
    ///
    /// 작게 유지한다. 커지면 계획이 폭발한다.
    /// </summary>
    public readonly struct PlanState
    {
        public bool AllySafe { get; }
        public bool SelfSafe { get; }
        public double Threat { get; }
        public bool SmokeUsed { get; }
        public double Stamina { get; }

        public PlanState(bool allySafe, bool selfSafe, double threat, bool smokeUsed, double stamina)
        {
            AllySafe = allySafe; SelfSafe = selfSafe; Threat = threat;
            SmokeUsed = smokeUsed; Stamina = stamina;
        }

        public PlanState With(bool? allySafe = null, bool? selfSafe = null, double? threat = null,
                              bool? smokeUsed = null, double? stamina = null) =>
            new PlanState(allySafe ?? AllySafe, selfSafe ?? SelfSafe, threat ?? Threat,
                          smokeUsed ?? SmokeUsed, stamina ?? Stamina);
    }

    public sealed class GoapAction
    {
        public PlanStep Step;
        public Func<PlanState, AgentState, bool> Applicable;
        public Func<PlanState, PlanState> Effect;
        public Func<PlanState, double> Cost;
    }

    /// <summary>
    /// L2 GOAP의 행동 정의.
    ///
    /// "행동 목록 + 전제조건 + 효과 + 비용"만 주면 계획이 나온다. 여기에 행동을 추가하면
    /// 플래너 코드를 고치지 않아도 새 계획이 생긴다 — 그게 요점이다.
    /// </summary>
    public static class Goap
    {
        public const int SuppressionThreatReduction = 30;
        private const int SuppressStamina = 20;
        private const int RescueStamina = 30;

        /// <summary>
        /// 이 캐릭터가 맨몸으로 감당하겠다고 판단하는 위협 상한.
        ///
        /// 부상 중이면 낮아지고, 위험을 즐기는 성격이면 높아지고, 겁에 질려 있으면 낮아진다.
        /// RESCUE의 전제조건이므로 상한이 낮으면 연막 없이 계획을 세울 수 없고,
        /// 더 낮으면 계획 자체가 불가능해져 목표를 포기한다.
        ///
        /// 공포가 들어가는 이유: 없으면 목표를 가진 캐릭터가 공포와 무관하게 늘 같은 계획을
        /// 세운다. 그러면 감정이 판단에 영향을 준다는 전제가 무너진다.
        /// 공포는 목표를 지우지 못하지만 **방법을 바꾼다.**
        /// </summary>
        public static double TolerableThreat(AgentState a) =>
            40 + (a.Personality.Risk - 50) * 0.6 + a.HealthRatio * 40 - a.Fear * 0.25;

        public static readonly IReadOnlyList<GoapAction> Actions = new List<GoapAction>
        {
            new GoapAction
            {
                Step = PlanStep.Suppress,
                Applicable = (s, a) => !s.SmokeUsed && s.Stamina >= SuppressStamina && s.Threat > 0,
                Effect = s => s.With(
                    threat: Math.Max(0, s.Threat - SuppressionThreatReduction),
                    smokeUsed: true,
                    stamina: s.Stamina - SuppressStamina),
                // 연막은 소모품이므로 공짜가 아니다. 이 값이 1이면 모두가 항상 연막을 쓴다.
                Cost = _ => 2,
            },
            new GoapAction
            {
                Step = PlanStep.Rescue,
                Applicable = (s, a) =>
                    !s.AllySafe
                    // 이미 전장을 떠났으면 구조할 수 없다. 이 전제조건이 없으면 플래너가
                    // FALL_BACK -> RESCUE 같은 말이 안 되는 순서를 더 싸다고 골라버린다.
                    && !s.SelfSafe
                    && s.Stamina >= RescueStamina
                    && s.Threat <= TolerableThreat(a),
                Effect = s => s.With(allySafe: true, stamina: s.Stamina - RescueStamina),
                // 위협이 높을수록 비싸다 — 그래서 위협이 높으면 연막이 낫다는 계산이 나온다
                Cost = s => 2 + s.Threat / 25,
            },
            new GoapAction
            {
                Step = PlanStep.FallBack,
                Applicable = (s, a) => !s.SelfSafe,
                Effect = s => s.With(selfSafe: true),
                Cost = _ => 1,
            },
        };

        /// <summary>목표: 동료도 살고 나도 빠져나온다.</summary>
        public static bool SatisfiesRescueGoal(PlanState s) => s.AllySafe && s.SelfSafe;

        public static PlanState InitialPlanState(AgentState a) =>
            new PlanState(false, false, a.SelfRisk, false, JsMath.Round(a.Stamina));
    }
}
