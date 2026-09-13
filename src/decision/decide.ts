/**
 * Decision Stack 진입점 — CORE CONTRACT 규칙 5.
 *
 * L0 규칙/상태 → L1 유틸리티. (L2 GOAP는 다음 단계)
 *
 * LLM은 여기에 없다. 앞으로도 이 함수에 들어오지 않는다.
 * LLM은 이미 결정된 Decision을 캐릭터 시점으로 서술하는 데만 쓰인다.
 */

import type { AgentState } from '../core/agentState.js';
import { applyL0 } from './l0Rules.js';
import { applyL1, type UtilityScore } from './l1Utility.js';
import type { ReasonCode } from './reason.js';

export interface Decision {
  readonly reason: ReasonCode;
  /** L1이 실행된 경우에만 존재. 디버거용 */
  readonly scores?: readonly UtilityScore[];
}

export function decide(state: AgentState): Decision {
  const l0 = applyL0(state);
  if (l0) return { reason: l0 };

  const l1 = applyL1(state);
  return { reason: l1.reason, scores: l1.scores };
}
