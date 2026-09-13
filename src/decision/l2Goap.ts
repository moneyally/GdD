/**
 * L2 — GOAP 플래너 (다단계 목표).
 *
 * L0(하드 규칙)이 아무것도 결정하지 않았고, 캐릭터에게 **한 번의 행동으로 달성할 수 없는
 * 목표**가 있을 때 실행된다. 계획이 나오면 그 계획이 이번 조우의 행동이 되고,
 * 계획이 없으면 L1 효용으로 내려간다.
 *
 * "계획이 없으면 물러선다"는 결과도 설계에 포함된다 — 목표가 있어도 방법이 없으면
 * 캐릭터는 목표를 포기한다. 이게 무작정 돌진하는 것보다 사람처럼 보인다.
 *
 * 탐색은 균일비용탐색(uniform-cost)이다. 행동 3개 / 깊이 4 이하이므로
 * 휴리스틱 없이도 즉시 끝난다. 행동이 늘어나면 A*로 바꾼다.
 */

import type { AgentState } from '../core/agentState.js';
import type { Goal } from '../core/instance.js';
import {
  GOAP_ACTIONS,
  initialPlanState,
  satisfiesRescueGoal,
  SUPPRESSION_THREAT_REDUCTION,
  type PlanState,
  type PlanStep,
} from './goapActions.js';
import type { Action, Factor, ReasonCode } from './reason.js';

const MAX_PLAN_LENGTH = 4;

export interface Plan {
  readonly steps: readonly PlanStep[];
  readonly cost: number;
  /** 계획이 달성하려는 목표 */
  readonly goal: Goal;
}

export interface L2Result {
  readonly reason: ReasonCode;
  readonly plan: Plan;
}

/** L2가 다룰 수 있는 목표인가. 한 번의 행동으로 끝나는 목표는 L1에 맡긴다. */
function planningGoal(state: AgentState): Goal | undefined {
  return [...state.goals]
    .filter((g) => g.kind === 'never_abandon_ally')
    .sort((a, b) => b.priority - a.priority)[0];
}

export function applyL2(state: AgentState): L2Result | undefined {
  const goal = planningGoal(state);
  if (!goal || !state.subject) return undefined;

  const plan = findPlan(state, goal);
  if (!plan) return undefined;

  return { reason: reasonFor(plan, state), plan };
}

/** 계획의 어느 걸음이 이번 조우의 대표 행동인가. */
export function primaryAction(plan: Plan): Action {
  return plan.steps.includes('RESCUE') ? 'RESCUE' : 'RETREAT';
}

/** 계획에 연막이 포함되면 실제 위협이 줄어든다 — 계획한 캐릭터는 덜 다친다. */
export function effectiveThreat(threat: number, steps: readonly PlanStep[]): number {
  return steps.includes('SUPPRESS')
    ? Math.max(0, threat - SUPPRESSION_THREAT_REDUCTION)
    : threat;
}

function findPlan(agent: AgentState, goal: Goal): Plan | undefined {
  interface Node {
    readonly state: PlanState;
    readonly steps: readonly PlanStep[];
    readonly cost: number;
  }

  const start: Node = { state: initialPlanState(agent), steps: [], cost: 0 };
  // 균일비용탐색. 같은 비용이면 먼저 생성된 쪽이 이기므로 결정론적이다.
  const frontier: Node[] = [start];
  let best: Node | undefined;

  while (frontier.length > 0) {
    frontier.sort((a, b) => a.cost - b.cost || a.steps.length - b.steps.length);
    const node = frontier.shift()!;

    if (satisfiesRescueGoal(node.state)) {
      best = node;
      break;
    }
    if (node.steps.length >= MAX_PLAN_LENGTH) continue;

    for (const action of GOAP_ACTIONS) {
      if (!action.applicable(node.state, agent)) continue;
      frontier.push({
        state: action.effect(node.state),
        steps: [...node.steps, action.step],
        cost: node.cost + action.cost(node.state),
      });
    }
  }

  if (!best) return undefined;
  return { steps: best.steps, cost: Math.round(best.cost * 10) / 10, goal };
}

function reasonFor(plan: Plan, state: AgentState): ReasonCode {
  const factors: Factor[] = [
    { key: 'goal', value: plan.goal.kind },
    { key: 'plan', value: plan.steps.join('→') },
    { key: 'cost', value: plan.cost },
    ...(plan.goal.sourceMemory ? [{ key: 'source', value: plan.goal.sourceMemory }] : []),
  ];

  return {
    action: primaryAction(plan),
    layer: 'L2',
    factors,
    // 계획이 있다는 사실이 공포를 누른다. 무엇을 눌렀는지 남긴다 (규칙 6)
    overrides: [{ key: 'fear', value: state.fear }],
  };
}
