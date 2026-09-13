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
 *  2. 기억에서 파생된 목표가 그다음이다. 이것이 "기억이 판단을 바꾼다"의 실행 경로다.
 *  3. 방어 명령 + 높은 충성은 자리를 지킨다.
 *
 * 미결 사항: 캐릭터의 목표가 Master의 퇴각 조건을 넘어설 수 있어야 하는가.
 * 지금은 넘지 못한다(1이 2보다 위). 넘게 만들면 "명령에 비용"이 필요하다 — 다음 단계 결정.
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

  // 규칙 2 — 기억에서 파생된 목표가 효용을 덮어쓴다
  const goal = [...state.goals]
    .filter((g) => g.kind === 'never_abandon_ally')
    .sort((a, b) => b.priority - a.priority)[0];
  if (goal && state.subject) {
    return {
      action: 'RESCUE',
      layer: 'L0',
      factors: [
        { key: 'goal', value: goal.kind },
        { key: 'priority', value: goal.priority },
        ...(goal.sourceMemory ? [{ key: 'source', value: goal.sourceMemory }] : []),
      ],
      // 이 목표가 무엇을 눌렀는지 남긴다. 플레이어가 읽는 문장이 여기서 나온다.
      overrides: [{ key: 'fear', value: state.fear }],
    };
  }

  // 규칙 3 — 방어 명령 + 높은 충성은 자리를 지킨다
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
