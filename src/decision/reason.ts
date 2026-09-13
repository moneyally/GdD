/**
 * ReasonCode — CORE CONTRACT 규칙 6.
 *
 * 모든 Decision은 ReasonCode를 가진다. 플레이어용 로그와 디버거는 같은 ReasonCode에서
 * 렌더링한다 — 두 개의 설명이 존재할 수 없게 만드는 것이 목적이다.
 *
 * 목표 출력 형식 (브리핑 예시와 동일):
 *   RETREAT(fear=72>threshold=60)
 *   RESCUE(target=Mira,trust=81,self_risk=45)
 *   HOLD(order=defend,loyalty=90 overrides fear=65)
 */

export type Action = 'RESCUE' | 'RETREAT' | 'HOLD' | 'ATTACK';

/** 판단 계층. 어느 층이 결정했는지 남긴다 */
export type DecisionLayer = 'L0' | 'L1' | 'L2';

/** 수치 하나. 비교 임계값이 있으면 op/threshold를 채운다 */
export interface Factor {
  readonly key: string;
  readonly value: number | string;
  readonly op?: '>' | '<' | '>=' | '<=' | '=';
  readonly threshold?: number;
}

export interface ReasonCode {
  readonly action: Action;
  readonly layer: DecisionLayer;
  readonly factors: readonly Factor[];
  /**
   * 이 요인들이 다른 요인을 덮어썼을 때. `A overrides B` 형태로 렌더링된다.
   * L0가 L1의 효용 계산을 덮어쓴 경우가 여기 들어간다.
   */
  readonly overrides?: readonly Factor[];
}

function renderFactor(f: Factor): string {
  if (f.op !== undefined && f.threshold !== undefined) {
    return `${f.key}=${f.value}${f.op}threshold=${f.threshold}`;
  }
  return `${f.key}=${f.value}`;
}

/** ReasonCode → 한 줄 문자열. 플레이어 로그와 디버거가 공유하는 유일한 렌더 경로. */
export function formatReason(reason: ReasonCode): string {
  const main = reason.factors.map(renderFactor).join(',');
  const overridden = reason.overrides?.map(renderFactor).join(',');
  const body = overridden ? `${main} overrides ${overridden}` : main;
  return `${reason.action}(${body})`;
}
