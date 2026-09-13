/**
 * World — 상태 보관소.
 *
 * Instance 목록, 이벤트 로그, tick, 난수 상태, ID 카운터를 들고 있다.
 * Snapshot 저장/복원의 단위가 이 객체다.
 *
 * 상태 변경은 트랜잭션(`runTransaction`)을 통해서만 한다 — CORE CONTRACT 규칙 4.
 * World의 mutate 메서드는 트랜잭션 구현에서만 호출한다는 규약을 둔다.
 */

import type { CharacterDefinition } from './definition.js';
import { EventLog, type WorldEvent } from './events.js';
import { IdSequence, type DefinitionId, type InstanceId } from './ids.js';
import type { CharacterInstance } from './instance.js';
import { Rng } from './rng.js';

export class World {
  readonly events: EventLog;

  private constructor(
    public tick: number,
    private readonly instances: Map<InstanceId, CharacterInstance>,
    private readonly definitions: Map<DefinitionId, CharacterDefinition>,
    readonly rng: Rng,
    readonly ids: IdSequence,
    restoredEvents: readonly WorldEvent[],
  ) {
    this.events = new EventLog(ids, restoredEvents);
  }

  static create(seed: number, definitions: readonly CharacterDefinition[]): World {
    return new World(
      0,
      new Map(),
      new Map(definitions.map((d) => [d.definitionId, d])),
      new Rng(seed),
      new IdSequence(0),
      [],
    );
  }

  static restore(args: {
    tick: number;
    instances: readonly CharacterInstance[];
    definitions: readonly CharacterDefinition[];
    rngState: number;
    idCounter: number;
    events: readonly WorldEvent[];
  }): World {
    return new World(
      args.tick,
      new Map(args.instances.map((i) => [i.instanceId, i])),
      new Map(args.definitions.map((d) => [d.definitionId, d])),
      Rng.restore(args.rngState),
      IdSequence.restore(args.idCounter),
      args.events,
    );
  }

  findDefinition(id: DefinitionId): CharacterDefinition | undefined {
    return this.definitions.get(id);
  }

  definition(id: DefinitionId): CharacterDefinition {
    const found = this.definitions.get(id);
    if (!found) throw new Error(`알 수 없는 Definition: ${id}`);
    return found;
  }

  instance(id: InstanceId): CharacterInstance {
    const found = this.instances.get(id);
    if (!found) throw new Error(`알 수 없는 Instance: ${id}`);
    return found;
  }

  find(id: InstanceId): CharacterInstance | undefined {
    return this.instances.get(id);
  }

  allInstances(): readonly CharacterInstance[] {
    return [...this.instances.values()];
  }

  living(): readonly CharacterInstance[] {
    return this.allInstances().filter((i) => i.status === 'alive');
  }

  /** 트랜잭션 전용. 직접 호출하지 않는다. */
  mutateAddInstance(instance: CharacterInstance): void {
    if (this.instances.has(instance.instanceId)) {
      throw new Error(`중복 Instance: ${instance.instanceId}`);
    }
    this.instances.set(instance.instanceId, instance);
  }

  advanceTick(): number {
    this.tick += 1;
    return this.tick;
  }
}
