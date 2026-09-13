/**
 * InstanceFactory — CORE CONTRACT 규칙 8.
 *
 * 같은 Definition을 다시 획득하면 샤드가 아니라 완전히 다른 이름·성격·기억·관계를 가진
 * 새 개체를 생성한다. 이 파일이 그 규칙의 유일한 구현 지점이다.
 *
 * 결과적으로 소유권은 Definition에 귀속되고 Instance는 소모된다.
 * 죽음이 최종(규칙 7)이어도 결제 가치가 소멸하지 않는 구조 — 이건 의도된 설계다.
 */

import type { CharacterDefinition, Range } from './definition.js';
import type {
  CharacterInstance,
  MemoryEntry,
  Personality,
  Relationship,
} from './instance.js';
import type { IdSequence, InstanceId } from './ids.js';
import { instanceId } from './ids.js';
import type { Rng } from './rng.js';

/** 시나리오/테스트가 지정하는 초기 조건. 게임 플레이 중에는 쓰이지 않는다. */
export interface InitialCondition {
  readonly fear?: number;
  readonly trust?: readonly { readonly target: InstanceId; readonly trust: number }[];
  readonly personality?: Partial<Personality>;
  readonly memory?: readonly MemoryEntry[];
}

export interface CreateInstanceInput {
  readonly definition: CharacterDefinition;
  readonly tick: number;
  readonly rng: Rng;
  readonly ids: IdSequence;
  readonly initial?: InitialCondition;
  /**
   * 이미 쓰이고 있는 이름. 규칙 8이 "완전히 다른 이름"을 요구하므로 중복을 피한다.
   * 죽은 캐릭터의 이름도 포함한다 — History가 그 이름을 참조하고 있기 때문이다.
   */
  readonly usedNames?: readonly string[];
}

export function createInstance(input: CreateInstanceInput): CharacterInstance {
  const { definition, tick, rng, ids, initial } = input;

  const rolled: Personality = {
    risk: rollRange(rng, definition.personalityRanges.risk),
    loyalty: rollRange(rng, definition.personalityRanges.loyalty),
    sociability: rollRange(rng, definition.personalityRanges.sociability),
    aggression: rollRange(rng, definition.personalityRanges.aggression),
    honesty: rollRange(rng, definition.personalityRanges.honesty),
  };
  const personality: Personality = { ...rolled, ...initial?.personality };
  const name = pickUnusedName(rng, definition.namePool, input.usedNames ?? []);

  const relationships: Relationship[] = (initial?.trust ?? []).map((t) => ({
    target: t.target,
    trust: t.trust,
  }));

  return {
    instanceId: instanceId(String(ids.next()).padStart(4, '0')),
    status: 'alive',
    identity: {
      name,
      definitionId: definition.definitionId,
      bornAtTick: tick,
    },
    personality,
    needs: {
      health: definition.baseHealth,
      maxHealth: definition.baseHealth,
      fatigue: 0,
    },
    emotion: { fear: initial?.fear ?? 0 },
    memory: [...(initial?.memory ?? [])],
    relationships,
    goals: [],
    legacy: { relics: [], inheritedMemories: [], reputation: 0 },
  };
}

function rollRange(rng: Rng, range: Range): number {
  return rng.intBetween(range.min, range.max);
}

/**
 * 아직 쓰이지 않은 이름을 뽑는다. 풀이 소진되면 서수를 붙인다.
 * 난수 소비는 어느 경로에서든 정확히 1회다 — 결정론을 깨지 않기 위함.
 */
function pickUnusedName(rng: Rng, pool: readonly string[], used: readonly string[]): string {
  const free = pool.filter((n) => !used.includes(n));
  if (free.length > 0) return rng.pick(free);

  const base = rng.pick(pool);
  for (let ordinal = 2; ; ordinal += 1) {
    const candidate = `${base} ${ordinal}`;
    if (!used.includes(candidate)) return candidate;
  }
}
