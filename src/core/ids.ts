/**
 * ID 타입. CORE CONTRACT 규칙 1을 컴파일 타임에 강제하기 위한 branded type.
 *
 * `DefinitionId`와 `InstanceId`는 런타임에는 둘 다 string이지만 서로 대입할 수 없다.
 * 4단 분리에서 가장 흔한 사고가 Definition과 Instance를 같은 키로 다루는 것이므로,
 * 이걸 사람 규율이 아니라 타입 검사로 막는다.
 *
 * 접두사는 GDD O-84 Core ID Scheme을 따른다.
 */

declare const brandKey: unique symbol;
type Brand<T, B extends string> = T & { readonly [brandKey]: B };

/** CHD_ — 개발자가 정의하는 정적 설계 */
export type DefinitionId = Brand<string, 'DefinitionId'>;
/** CHR_ — 플레이어가 소유하는 영속 개체 */
export type InstanceId = Brand<string, 'InstanceId'>;
/** MEM_ — 기억 */
export type MemoryId = Brand<string, 'MemoryId'>;
/** EVT_ — 세계에 남는 사건 */
export type EventId = Brand<string, 'EventId'>;
/** GOL_ — 목표 */
export type GoalId = Brand<string, 'GoalId'>;

const PREFIX = {
  DefinitionId: 'CHD_',
  InstanceId: 'CHR_',
  MemoryId: 'MEM_',
  EventId: 'EVT_',
  GoalId: 'GOL_',
} as const;

function make<T extends string>(kind: keyof typeof PREFIX, raw: string): Brand<string, T> {
  const prefix = PREFIX[kind];
  const value = raw.startsWith(prefix) ? raw : prefix + raw;
  return value as Brand<string, T>;
}

export const definitionId = (raw: string): DefinitionId => make<'DefinitionId'>('DefinitionId', raw);
export const instanceId = (raw: string): InstanceId => make<'InstanceId'>('InstanceId', raw);
export const memoryId = (raw: string): MemoryId => make<'MemoryId'>('MemoryId', raw);
export const eventId = (raw: string): EventId => make<'EventId'>('EventId', raw);
export const goalId = (raw: string): GoalId => make<'GoalId'>('GoalId', raw);

/**
 * 결정론적 ID 발급기.
 *
 * 통과 기준의 "저장 → 재시작 → 복원 → 동일 Event Log"를 만족하려면 ID에
 * 시계나 난수가 들어가면 안 된다. 카운터는 Snapshot에 저장되어 함께 복원된다.
 */
export class IdSequence {
  constructor(private counter = 0) {}

  next(): number {
    this.counter += 1;
    return this.counter;
  }

  peek(): number {
    return this.counter;
  }

  static restore(counter: number): IdSequence {
    return new IdSequence(counter);
  }
}
