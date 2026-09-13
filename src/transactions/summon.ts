/**
 * 소환 트랜잭션. CORE CONTRACT 규칙 4 + 규칙 8.
 *
 * 같은 Definition으로 두 번 소환하면 서로 다른 두 Instance가 나온다.
 * 이 트랜잭션이 규칙 8의 유일한 진입점이다.
 */

import { createInstance, type InitialCondition } from '../core/instanceFactory.js';
import type { CharacterInstance } from '../core/instance.js';
import type { DefinitionId } from '../core/ids.js';
import type { Transaction } from '../core/transaction.js';
import type { World } from '../core/world.js';

export interface SummonRequest {
  readonly definitionId: DefinitionId;
  /** 시나리오 초기 조건. 플레이 중 소환에는 없다 */
  readonly initial?: InitialCondition;
}

export const SummonTransaction: Transaction<SummonRequest, CharacterInstance> = {
  name: 'Summon',

  validate(world: World, request: SummonRequest): string | undefined {
    const definition = world.findDefinition(request.definitionId);
    if (!definition) return `알 수 없는 Definition: ${request.definitionId}`;
    if (definition.namePool.length === 0) return `이름 풀이 비어 있음: ${request.definitionId}`;
    return undefined;
  },

  apply(world: World, request: SummonRequest): CharacterInstance {
    const definition = world.definition(request.definitionId);
    const instance = createInstance({
      definition,
      tick: world.tick,
      rng: world.rng,
      ids: world.ids,
      initial: request.initial,
      // 죽은 캐릭터도 포함한다 (규칙 7: 죽어도 History에 남는다)
      usedNames: world.allInstances().map((i) => i.identity.name),
    });
    world.mutateAddInstance(instance);
    return instance;
  },
};
