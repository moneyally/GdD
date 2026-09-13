/**
 * Master 명령. 브리핑 3절 추가규칙에 따라 3개뿐이다.
 * 마이크로 조작은 존재하지 않는다.
 */

export type GoalOrder =
  /** 동료를 지켜라 */
  | 'defend'
  /** 목표를 달성하라 */
  | 'advance'
  /** 피해를 피하라 */
  | 'preserve';

export type RiskPolicy = 'cautious' | 'balanced' | 'aggressive';

export interface MasterOrder {
  readonly goal: GoalOrder;
  readonly riskPolicy: RiskPolicy;
  /**
   * 퇴각 조건. 체력 비율이 이 값 아래로 떨어지면 퇴각을 강제한다.
   * 0이면 퇴각 조건 없음.
   */
  readonly retreatCondition: { readonly healthRatioBelow: number };
}

export const DEFAULT_ORDER: MasterOrder = {
  goal: 'defend',
  riskPolicy: 'balanced',
  retreatCondition: { healthRatioBelow: 0.2 },
};

export function riskAppetite(policy: RiskPolicy): number {
  switch (policy) {
    case 'cautious':
      return -15;
    case 'balanced':
      return 0;
    case 'aggressive':
      return 15;
  }
}
