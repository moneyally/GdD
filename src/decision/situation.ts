/**
 * Situation — 판단 입력이 되는 상황.
 *
 * MVP는 상황 1개만 다룬다: "동료가 위험한 적 앞에서 쓰러졌다" (브리핑 4절).
 * 타입을 상황 종류로 열어두되 구현은 하나만 한다.
 */

import type { InstanceId } from '../core/ids.js';

export type SituationKind = 'ally_down_before_enemy';

export interface Situation {
  readonly kind: SituationKind;
  /** 쓰러진 동료 */
  readonly subject: InstanceId;
  /** 적의 위협도 0..100 */
  readonly enemyThreat: number;
  readonly tick: number;
  /** 플레이어에게 보여줄 상황 설명 */
  readonly description: string;
}

export function allyDown(subject: InstanceId, enemyThreat: number, tick: number): Situation {
  return {
    kind: 'ally_down_before_enemy',
    subject,
    enemyThreat,
    tick,
    description: '동료가 위험한 적 앞에서 쓰러졌다.',
  };
}
