/**
 * CharacterInstance — 4단 분리 2층.
 *
 * 플레이어가 소유하는 영속 개체. 저장/복원의 단위이며 죽어도 삭제되지 않는다
 * (CORE CONTRACT 규칙 7: 죽으면 status='dead'로 History에 남는다).
 *
 * CORE CONTRACT 규칙 2가 요구하는 8개 도메인을 모두 갖는다:
 * Identity, Personality, Needs, Emotion, Memory, Relationship, Goals, Legacy.
 *
 * MVP 축소 범위:
 * - Emotion은 fear 1축 (브리핑 4절)
 * - Relationship은 trust 1축 (브리핑 4절)
 * - Memory는 Episodic / Social 2종 (브리핑 3절 추가규칙)
 */

import type { DefinitionId, GoalId, InstanceId, MemoryId } from './ids.js';

export type LifeStatus = 'alive' | 'dead';

export interface Identity {
  readonly name: string;
  /** 소속 Definition. 소유권은 Definition에 귀속된다 (OPEN-QUESTIONS 참조) */
  readonly definitionId: DefinitionId;
  /** 이 Instance가 생성된 tick */
  readonly bornAtTick: number;
}

/** Instance 생성 시 Definition의 범위에서 뽑혀 고정된다. 이후 변하지 않는다. */
export interface Personality {
  readonly risk: number;
  readonly loyalty: number;
  readonly sociability: number;
  readonly aggression: number;
  readonly honesty: number;
}

export interface Needs {
  /** 0이면 사망 */
  health: number;
  readonly maxHealth: number;
  fatigue: number;
}

/** MVP: fear 1축. 0..100 */
export interface Emotion {
  fear: number;
}

export type MemoryKind = 'Episodic' | 'Social';

/**
 * 기억. importance가 판단에 대한 영향력을 결정한다.
 * `tag`는 판단 계층이 기억을 기계적으로 조회하기 위한 키다 — 문장 파싱을 하지 않는다.
 */
export interface MemoryEntry {
  readonly memoryId: MemoryId;
  readonly kind: MemoryKind;
  readonly tag: MemoryTag;
  /** 0..100. 높으면 오래 남고 판단에 강하게 작용 */
  readonly importance: number;
  readonly atTick: number;
  /** 관련 대상 (있는 경우) */
  readonly subject?: InstanceId;
  /** 플레이어에게 보여줄 한 줄. LLM이 없어도 동작해야 하므로 규칙 기반 문장 */
  readonly text: string;
}

/**
 * 기억 태그. 새 태그를 추가할 때 판단 계층에서의 의미도 함께 정의해야 한다.
 * 문자열 자유 입력을 막아 "기억이 판단을 바꾼다"는 경로를 추적 가능하게 유지한다.
 */
export type MemoryTag =
  /** 내가 퇴각해서 동료가 죽었다 */
  | 'ally_died_by_my_retreat'
  /** 내가 동료를 구했다 */
  | 'rescued_ally'
  /** 구조 중 부상을 입었다 */
  | 'wounded_in_rescue'
  /** 동료의 죽음을 목격했다 */
  | 'witnessed_ally_death';

/** MVP: trust 1축. 0..100 */
export interface Relationship {
  readonly target: InstanceId;
  trust: number;
}

export type GoalKind =
  /** 기억에서 파생된 목표. L0에서 효용 계산을 덮어쓴다 */
  | 'never_abandon_ally'
  /** 생존 우선 */
  | 'survive';

export interface Goal {
  readonly goalId: GoalId;
  readonly kind: GoalKind;
  /** 0..100. 높을수록 강하게 판단을 지배 */
  readonly priority: number;
  /** 이 목표를 만든 기억. 근거 추적용 — ReasonCode에 실린다 */
  readonly sourceMemory?: MemoryId;
  readonly createdAtTick: number;
}

/** 죽음 이후 후속 캐릭터에게 승계될 것 (CORE CONTRACT 규칙 7) */
export interface Legacy {
  readonly relics: readonly string[];
  /** 승계 대상 기억 */
  readonly inheritedMemories: readonly MemoryId[];
  reputation: number;
  /** 사망 tick. alive면 undefined */
  diedAtTick?: number;
}

export interface CharacterInstance {
  readonly instanceId: InstanceId;
  status: LifeStatus;
  readonly identity: Identity;
  readonly personality: Personality;
  needs: Needs;
  emotion: Emotion;
  memory: MemoryEntry[];
  relationships: Relationship[];
  goals: Goal[];
  legacy: Legacy;
}

export function trustToward(self: CharacterInstance, target: InstanceId): number {
  return self.relationships.find((r) => r.target === target)?.trust ?? 0;
}

export function isAlive(instance: CharacterInstance): boolean {
  return instance.status === 'alive';
}
