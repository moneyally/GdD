/**
 * L0 — 규칙/상태 계층.
 *
 * 효용 계산 이전에 확정적으로 결정되는 것들. 하나라도 적용되면 L1은 실행되지 않고,
 * ReasonCode의 layer는 'L0'이 된다.
 *
 * 규칙 순서가 곧 우선순위다. 위에 있는 규칙이 이긴다.
 *
 * 우선순위 설계 근거:
 *  1. Master의 퇴각 조건이 가장 강하다 — 플레이어가 명시적으로 지정한 안전선이므로
 *     캐릭터 자율성이 이걸 넘으면 플레이어가 통제 불능이라고 느낀다.
 *  2. 방어 명령 + 높은 충성은 자리를 지킨다.
 *
 * 기억에서 파생된 목표(never_abandon_ally)는 **여기 없다.** L2 GOAP로 옮겼다.
 * 이유: 목표는 "무엇을"이고 계획은 "어떻게"다. L0에서 RESCUE를 강제하면 부상당한
 * 캐릭터가 아무 준비 없이 뛰어들어 죽는다. L2는 같은 목표에서 연막→구조→이탈 같은
 * 계획을 만들고, 계획이 불가능하면 목표를 포기한다.
 *
 * 미결 사항: 캐릭터의 목표가 Master의 퇴각 조건을 넘어설 수 있어야 하는가.
 * 지금은 넘지 못한다. 넘게 만들면 "명령에 비용"이 필요하다 — OPEN-QUESTIONS 6-2.
 */

import type { AgentState } from '../core/agentState.js';
import type { ReasonCode } from './reason.js';

const HOLD_LOYALTY_THRESHOLD = 85;
const HOLD_FEAR_CEILING = 80;

export function applyL0(state: AgentState): ReasonCode | undefined {
  // 규칙 1 — Master 퇴각 조건
  const retreatAt = state.order.retreatCondition.healthRatioBelow;
  if (retreatAt > 0 && state.healthRatio < retreatAt) {
    return {
      action: 'RETREAT',
      layer: 'L0',
      factors: [
        {
          key: 'health_ratio',
          value: round2(state.healthRatio),
          op: '<',
          threshold: retreatAt,
        },
        { key: 'order', value: 'retreat_condition' },
      ],
    };
  }

  // 규칙 2 — 방어 명령 + 높은 충성은 자리를 지킨다
  if (
    state.order.goal === 'defend' &&
    state.personality.loyalty >= HOLD_LOYALTY_THRESHOLD &&
    state.fear < HOLD_FEAR_CEILING
  ) {
    return {
      action: 'HOLD',
      layer: 'L0',
      factors: [
        { key: 'order', value: 'defend' },
        { key: 'loyalty', value: state.personality.loyalty },
      ],
      overrides: [{ key: 'fear', value: state.fear }],
    };
  }

  return undefined;
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}
