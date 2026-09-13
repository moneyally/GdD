/**
 * Event — CORE CONTRACT 규칙 3.
 *
 * 전체 Event Sourcing이 아니다. Snapshot + ImportantEventLog 구조이며,
 * 기록 대상은 정확히 6종이다. 이 6종 외의 상태 변화는 Snapshot에만 남는다.
 *
 * append-only: 로그는 push만 가능하고 수정/삭제 경로를 제공하지 않는다.
 */

import type { EventId, InstanceId, MemoryId } from './ids.js';
import { eventId } from './ids.js';
import type { IdSequence } from './ids.js';
import type { MemoryTag } from './instance.js';

export type EventKind =
  | 'Death'
  | 'RelationshipChange'
  | 'MajorMemory'
  | 'MissionOutcome'
  | 'WorldDiscovery'
  | 'LegacyCreation';

interface EventBase {
  readonly eventId: EventId;
  /** 로그 내 순서. 복원 검증에 쓰인다 */
  readonly seq: number;
  readonly tick: number;
  readonly kind: EventKind;
}

export interface DeathEvent extends EventBase {
  readonly kind: 'Death';
  readonly subject: InstanceId;
  readonly cause: 'killed_by_enemy' | 'abandoned';
  /** 목격자 — 이들에게 기억이 생긴다 */
  readonly witnesses: readonly InstanceId[];
}

export interface RelationshipChangeEvent extends EventBase {
  readonly kind: 'RelationshipChange';
  readonly from: InstanceId;
  readonly to: InstanceId;
  readonly trustBefore: number;
  readonly trustAfter: number;
  readonly cause: string;
}

export interface MajorMemoryEvent extends EventBase {
  readonly kind: 'MajorMemory';
  readonly owner: InstanceId;
  readonly memoryId: MemoryId;
  readonly tag: MemoryTag;
  readonly importance: number;
}

export interface MissionOutcomeEvent extends EventBase {
  readonly kind: 'MissionOutcome';
  readonly participants: readonly InstanceId[];
  readonly outcome: 'success' | 'partial' | 'failure';
  readonly summary: string;
}

export interface WorldDiscoveryEvent extends EventBase {
  readonly kind: 'WorldDiscovery';
  readonly discoveredBy: InstanceId;
  readonly what: string;
}

export interface LegacyCreationEvent extends EventBase {
  readonly kind: 'LegacyCreation';
  readonly from: InstanceId;
  readonly relics: readonly string[];
  readonly inheritedMemories: readonly MemoryId[];
}

export type WorldEvent =
  | DeathEvent
  | RelationshipChangeEvent
  | MajorMemoryEvent
  | MissionOutcomeEvent
  | WorldDiscoveryEvent
  | LegacyCreationEvent;

/** 이벤트 본문에서 eventId/seq를 뺀 형태. 발급은 로그가 담당한다. */
export type EventDraft<T extends WorldEvent> = Omit<T, 'eventId' | 'seq'>;

/**
 * append가 받는 타입. 유니온을 Omit하면 공통 필드만 남으므로 종류별로 펼쳐 둔다.
 * 이렇게 하면 kind에 맞지 않는 필드를 넘길 때 컴파일 에러가 난다.
 */
export type AnyEventDraft =
  | EventDraft<DeathEvent>
  | EventDraft<RelationshipChangeEvent>
  | EventDraft<MajorMemoryEvent>
  | EventDraft<MissionOutcomeEvent>
  | EventDraft<WorldDiscoveryEvent>
  | EventDraft<LegacyCreationEvent>;

/**
 * append-only 이벤트 로그.
 *
 * 외부에 노출되는 것은 append와 읽기뿐이다. 인덱스 대입이나 splice 경로가 없다.
 */
export class EventLog {
  private readonly entries: WorldEvent[] = [];

  constructor(
    private readonly ids: IdSequence,
    restored: readonly WorldEvent[] = [],
  ) {
    this.entries.push(...restored);
  }

  append<D extends AnyEventDraft>(draft: D): Extract<WorldEvent, { kind: D['kind'] }> {
    const seq = this.entries.length + 1;
    const event = {
      ...draft,
      seq,
      eventId: eventId(`${String(this.ids.next()).padStart(6, '0')}`),
    } as unknown as Extract<WorldEvent, { kind: D['kind'] }>;
    this.entries.push(event);
    return event;
  }

  all(): readonly WorldEvent[] {
    return this.entries;
  }

  ofKind<K extends EventKind>(kind: K): readonly Extract<WorldEvent, { kind: K }>[] {
    return this.entries.filter((e): e is Extract<WorldEvent, { kind: K }> => e.kind === kind);
  }

  get length(): number {
    return this.entries.length;
  }
}
