/**
 * CharacterDefinition — 4단 분리 1층.
 *
 * 개발자가 정의하는 정적 설계. 플레이 중 절대 변하지 않는다.
 * Instance가 몇 개 생기든 Definition은 하나다.
 *
 * CORE CONTRACT 규칙 8에 따라 같은 Definition을 다시 획득하면 샤드가 아니라
 * 완전히 다른 Instance가 생성된다. 따라서 Definition이 담는 것은
 * "확정된 성격"이 아니라 "성격이 뽑힐 범위"다.
 */

import type { DefinitionId } from './ids.js';

/** 성격 수치가 뽑히는 범위. min/max 모두 0..100, 포함. */
export interface Range {
  readonly min: number;
  readonly max: number;
}

export interface PersonalityRanges {
  /** 위험 감수. 높으면 위험한 행동의 효용이 올라간다 */
  readonly risk: Range;
  /** 충성. 명령 준수와 동료 구조에 작용 */
  readonly loyalty: Range;
  /** 사교성 */
  readonly sociability: Range;
  /** 공격성 */
  readonly aggression: Range;
  /** 정직성. 보고의 신뢰도에 쓰일 예정 (MVP 미사용) */
  readonly honesty: Range;
}

export interface CharacterDefinition {
  readonly definitionId: DefinitionId;
  /** 표시용 계통 이름. Instance의 개체명이 아니다 */
  readonly archetype: string;
  /** Instance 이름을 뽑는 풀. 중복 획득 시 다른 이름이 나오게 한다 */
  readonly namePool: readonly string[];
  readonly personalityRanges: PersonalityRanges;
  /** 기본 최대 체력 */
  readonly baseHealth: number;
}
