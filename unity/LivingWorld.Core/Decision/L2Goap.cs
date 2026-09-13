using System;
using System.Collections.Generic;
using System.Linq;

namespace LivingWorld.Core.Decision
{
    public sealed class Plan
    {
        public IReadOnlyList<PlanStep> Steps = new List<PlanStep>();
        public double Cost;
        public Goal Goal;

        public string Render() => string.Join("→", Steps.Select(PlanStepNames.Wire));
    }

    public sealed class L2Result
    {
        public ReasonCode Reason;
        public Plan Plan;
    }

    /// <summary>
    /// L2 — GOAP 플래너 (다단계 목표).
    ///
    /// L0가 아무것도 결정하지 않았고, 캐릭터에게 **한 번의 행동으로 달성할 수 없는 목표**가
    /// 있을 때 실행된다. 계획이 나오면 그 계획이 이번 조우의 행동이 되고,
    /// 계획이 없으면 L1 효용으로 내려간다.
    ///
    /// "계획이 없으면 물러선다"는 결과도 설계에 포함된다 — 목표가 있어도 방법이 없으면
    /// 캐릭터는 목표를 포기한다. 이게 무작정 돌진하는 것보다 사람처럼 보인다.
    ///
    /// 탐색은 균일비용탐색이다. 행동 3개 / 깊이 4 이하이므로 휴리스틱 없이도 즉시 끝난다.
    /// </summary>
    public static class L2Goap
    {
        private const int MaxPlanLength = 4;

        public static L2Result Apply(AgentState state)
        {
            Goal goal = PlanningGoal(state);
            if (goal == null || state.Subject == null) return null;

            Plan plan = FindPlan(state, goal);
            if (plan == null) return null;

            return new L2Result { Reason = ReasonFor(plan, state), Plan = plan };
        }

        /// <summary>L2가 다룰 수 있는 목표인가. 한 번의 행동으로 끝나는 목표는 L1에 맡긴다.</summary>
        private static Goal PlanningGoal(AgentState state) =>
            state.Goals
                 .Where(g => g.Kind == GoalKind.NeverAbandonAlly)
                 .OrderByDescending(g => g.Priority)
                 .FirstOrDefault();

        /// <summary>계획의 어느 걸음이 이번 조우의 대표 행동인가.</summary>
        public static Action PrimaryAction(Plan plan) =>
            plan.Steps.Contains(PlanStep.Rescue) ? Action.Rescue : Action.Retreat;

        /// <summary>계획에 연막이 포함되면 실제 위협이 줄어든다 — 계획한 캐릭터는 덜 다친다.</summary>
        public static int EffectiveThreat(int threat, IReadOnlyList<PlanStep> steps) =>
            steps != null && steps.Contains(PlanStep.Suppress)
                ? Math.Max(0, threat - Goap.SuppressionThreatReduction)
                : threat;

        private sealed class Node
        {
            public PlanState State;
            public List<PlanStep> Steps;
            public double Cost;
        }

        private static Plan FindPlan(AgentState agent, Goal goal)
        {
            var frontier = new List<Node>
            {
                new Node { State = Goap.InitialPlanState(agent), Steps = new List<PlanStep>(), Cost = 0 },
            };
            Node best = null;

            while (frontier.Count > 0)
            {
                // 균일비용탐색. 같은 비용이면 먼저 생성된 쪽이 이기므로 결정론적이다.
                // OrderBy는 안정 정렬이라 JS의 Array.sort(안정)와 같은 순서가 나온다.
                frontier = frontier
                    .OrderBy(n => n.Cost)
                    .ThenBy(n => n.Steps.Count)
                    .ToList();
                Node node = frontier[0];
                frontier.RemoveAt(0);

                if (Goap.SatisfiesRescueGoal(node.State)) { best = node; break; }
                if (node.Steps.Count >= MaxPlanLength) continue;

                foreach (var action in Goap.Actions)
                {
                    if (!action.Applicable(node.State, agent)) continue;
                    var steps = new List<PlanStep>(node.Steps) { action.Step };
                    frontier.Add(new Node
                    {
                        State = action.Effect(node.State),
                        Steps = steps,
                        Cost = node.Cost + action.Cost(node.State),
                    });
                }
            }

            if (best == null) return null;
            return new Plan
            {
                Steps = best.Steps,
                Cost = Math.Floor(best.Cost * 10 + 0.5) / 10,
                Goal = goal,
            };
        }

        private static ReasonCode ReasonFor(Plan plan, AgentState state)
        {
            var factors = new List<Factor>
            {
                Factor.Of("goal", GoalKindNames.Wire(plan.Goal.Kind)),
                Factor.Of("plan", plan.Render()),
                Factor.Of("cost", plan.Cost),
            };
            if (plan.Goal.SourceMemory.HasValue)
                factors.Add(Factor.Of("source", plan.Goal.SourceMemory.Value.Value));

            return new ReasonCode
            {
                Action = PrimaryAction(plan),
                Layer = DecisionLayer.L2,
                Factors = factors,
                // 계획이 있다는 사실이 공포를 누른다. 무엇을 눌렀는지 남긴다 (규칙 6)
                Overrides = new List<Factor> { Factor.Of("fear", state.Fear) },
            };
        }
    }
}
