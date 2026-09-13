/**
 * L2 GOAP의 행동 정의.
 *
 * GOAP는 "행동 목록 + 전제조건 + 효과 + 비용"만 주면 계획이 나오는 구조다.
 * 여기에 행동을 추가하면 플래너 코드를 고치지 않아도 새 계획이 생긴다 — 그게 요점이다.
 *
 * PlanState는 플래너가 머릿속에서 굴리는 모델이고, 실제 세계 상태가 아니다.
 * 캐릭터가 세계를 잘못 알고 있으면 계획도 틀린다 — 그 자리를 여기 남겨둔다.
 */

import type { AgentState } from '../core/agentState.js';

/** 계획 안의 한 걸음 */
export type PlanStep = 'SUPPRESS' | 'RESCUE' | 'FALL_BACK';

/** 플래너의 세계 모델. 작게 유지한다 — 커지면 계획이 폭발한다 */
export interface PlanState {
  /** 쓰러진 동료가 안전해졌는가 */
  readonly allySafe: boolean;
  /** 자신이 전장에서 이탈했는가 */
  readonly selfSafe: boolean;
  /** 현재 체감 위협도 */
  readonly threat: number;
  /** 연막을 이미 썼는가 */
  readonly smokeUsed: boolean;
  readonly stamina: number;
}

export interface GoapAction {
  readonly step: PlanStep;
  /** 이 행동이 가능한가 */
  applicable(state: PlanState, agent: AgentState): boolean;
  /** 적용 후의 상태 */
  effect(state: PlanState): PlanState;
  /** 비용. 낮은 합계를 가진 계획이 선택된다 */
  cost(state: PlanState): number;
}

export const SUPPRESSION_THREAT_REDUCTION = 30;
const SUPPRESS_STAMINA = 20;
const RESCUE_STAMINA = 30;

/**
 * 이 캐릭터가 맨몸으로 감당하겠다고 판단하는 위협 상한.
 *
 * 부상 중이면 낮아지고, 위험을 즐기는 성격이면 높아지고, **겁에 질려 있으면 낮아진다.**
 * 이 값이 RESCUE의 전제조건이므로 상한이 낮은 캐릭터는 연막 없이 계획을 세울 수 없고,
 * 더 낮으면 계획 자체가 불가능해져 목표를 포기한다.
 *
 * 공포가 여기 들어가는 이유: 이게 없으면 목표를 가진 캐릭터는 공포와 무관하게
 * 항상 같은 계획을 세운다. 그러면 감정이 판단에 영향을 준다는 전제가 무너진다.
 * 공포는 목표를 지우지는 못하지만 **방법을 바꾼다.**
 */
export function tolerableThreat(agent: AgentState): number {
  return (
    40 + (agent.personality.risk - 50) * 0.6 + agent.healthRatio * 40 - agent.fear * 0.25
  );
}

export const GOAP_ACTIONS: readonly GoapAction[] = [
  {
    step: 'SUPPRESS',
    applicable: (s, agent) =>
      agent.hasSuppressor && !s.smokeUsed && s.stamina >= SUPPRESS_STAMINA && s.threat > 0,
    effect: (s) => ({
      ...s,
      threat: Math.max(0, s.threat - SUPPRESSION_THREAT_REDUCTION),
      smokeUsed: true,
      stamina: s.stamina - SUPPRESS_STAMINA,
    }),
    // 연막은 소모품이므로 공짜가 아니다. 이 값이 1이면 모두가 항상 연막을 쓴다.
    cost: () => 2,
  },
  {
    step: 'RESCUE',
    applicable: (s, agent) =>
      !s.allySafe &&
      // 이미 전장을 떠났으면 구조할 수 없다. 이 전제조건이 없으면 플래너가
      // FALL_BACK -> RESCUE 같은 말이 안 되는 순서를 더 싸다고 골라버린다.
      !s.selfSafe &&
      s.stamina >= RESCUE_STAMINA &&
      s.threat <= tolerableThreat(agent),
    effect: (s) => ({ ...s, allySafe: true, stamina: s.stamina - RESCUE_STAMINA }),
    // 위협이 높을수록 비싸다 — 그래서 위협이 높으면 연막이 낫다는 계산이 나온다
    cost: (s) => 2 + s.threat / 25,
  },
  {
    step: 'FALL_BACK',
    applicable: (s) => !s.selfSafe,
    effect: (s) => ({ ...s, selfSafe: true }),
    cost: () => 1,
  },
];

/** 목표: 동료도 살고 나도 빠져나온다 */
export function satisfiesRescueGoal(state: PlanState): boolean {
  return state.allySafe && state.selfSafe;
}

export function initialPlanState(agent: AgentState): PlanState {
  return {
    allySafe: false,
    selfSafe: false,
    threat: agent.selfRisk,
    smokeUsed: false,
    stamina: Math.round(agent.stamina),
  };
}
