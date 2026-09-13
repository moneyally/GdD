/**
 * Decision Stack 진입점 — CORE CONTRACT 규칙 5.
 *
 * L0 규칙/상태 → L2 GOAP(다단계 목표) → L1 유틸리티.
 *
 * 호출 순서가 규칙 5의 나열 순서(L0 → L1 → L2)와 다른 이유:
 * L1은 **단일 행동**의 효용을 비교하는 층이고 L2는 **여러 걸음이 필요한 목표**를 다룬다.
 * 한 번의 행동으로 달성할 수 없는 목표를 L1에 먼저 물으면 목표가 무시된 답이 나온다.
 * 그래서 계획이 필요한 목표가 있으면 L2가 먼저 답하고, 계획이 없으면 L1로 내려간다.
 * L1은 언제나 답을 내므로 판단이 비는 경우는 없다.
 *
 * LLM은 여기에 없다. 앞으로도 이 함수에 들어오지 않는다.
 * LLM은 이미 결정된 Decision을 캐릭터 시점으로 서술하는 데만 쓰인다.
 */

import type { AgentState } from '../core/agentState.js';
import { applyL0 } from './l0Rules.js';
import { applyL1, type UtilityScore } from './l1Utility.js';
import { applyL2, type Plan } from './l2Goap.js';
import type { ReasonCode } from './reason.js';

export interface Decision {
  readonly reason: ReasonCode;
  /** L1이 실행된 경우에만 존재. 디버거용 */
  readonly scores?: readonly UtilityScore[];
  /** L2가 계획을 세운 경우에만 존재 */
  readonly plan?: Plan;
}

export function decide(state: AgentState): Decision {
  const l0 = applyL0(state);
  if (l0) return { reason: l0 };

  const l2 = applyL2(state);
  if (l2) return { reason: l2.reason, plan: l2.plan };

  const l1 = applyL1(state);
  return { reason: l1.reason, scores: l1.scores };
}
