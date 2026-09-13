/**
 * CORE GAMEPLAY 시나리오. 브리핑 4절의 구현 범위 그대로.
 *
 * 같은 Definition에서 소환한 두 캐릭터가, 같은 상황에서, 자기 State 때문에
 * 다르게 판단하고, 그 결과가 State와 Event를 바꾸고, 같은 상황을 다시 주면
 * 이전과 다른 판단이 나오는 것까지가 범위다.
 *
 * 탑/미션/대기실/LLM은 여기 없다.
 */

import { buildAgentState, type AgentState } from '../core/agentState.js';
import type { CharacterInstance } from '../core/instance.js';
import type { MasterOrder } from '../core/order.js';
import { runTransaction } from '../core/transaction.js';
import { World } from '../core/world.js';
import { ALL_DEFINITIONS, SCOUT, VANGUARD } from '../data/definitions.js';
import { decide, type Decision } from '../decision/decide.js';
import { allyDown, type Situation } from '../decision/situation.js';
import { ResolveTransaction } from '../sim/resolve.js';
import { SummonTransaction } from '../transactions/summon.js';

/** 시나리오 상수. 둘 다 이 위협도의 같은 상황을 받는다. */
export const SCENARIO = {
  seed: 20260913,
  enemyThreat: 70,
  order: {
    // 'defend'는 L0 규칙 3(자리 지키기)을 켜므로 이 시나리오는 'advance'를 쓴다.
    goal: 'advance',
    riskPolicy: 'balanced',
    // 0.3 — 첫 구조 후 부상(체력 51/100)으로는 발동하지 않는다.
    // 즉 A의 두 번째 판단 변화는 L0 강제가 아니라 L1 효용 변화로 일어난다.
    retreatCondition: { healthRatioBelow: 0.3 },
  } satisfies MasterOrder,
} as const;

export interface Encounter {
  readonly actor: CharacterInstance;
  readonly subject: CharacterInstance;
  readonly situation: Situation;
  /** 판단 시점의 입력. 행동으로 Instance가 변한 뒤에도 근거를 재현할 수 있게 보관한다 */
  readonly state: AgentState;
  readonly decision: Decision;
  readonly died: readonly string[];
}

export interface ScenarioWorld {
  readonly world: World;
  readonly vanguardA: CharacterInstance;
  readonly vanguardB: CharacterInstance;
  readonly allyOfA: CharacterInstance;
  readonly allyOfB: CharacterInstance;
}

/**
 * 초기 세계 구성.
 *
 * A와 B는 같은 Definition(VANGUARD)에서 소환된다 — 규칙 8 확인 지점.
 * 통과 기준이 요구하는 초기 조건은 소환 요청의 initial로 넣는다.
 * 소환 후 필드를 직접 대입하지 않는다 (규칙 4).
 */
export function buildScenario(): ScenarioWorld {
  const world = World.create(SCENARIO.seed, ALL_DEFINITIONS);

  const allyOfA = summon(world, SCOUT.definitionId);
  const allyOfB = summon(world, SCOUT.definitionId);

  const vanguardA = summon(world, VANGUARD.definitionId, {
    fear: 20,
    trust: [{ target: allyOfA.instanceId, trust: 80 }],
  });
  const vanguardB = summon(world, VANGUARD.definitionId, {
    fear: 80,
    trust: [{ target: allyOfB.instanceId, trust: 20 }],
  });

  return { world, vanguardA, vanguardB, allyOfA, allyOfB };
}

/** 한 번의 조우: 상황 제시 → 판단 → 결과 적용. */
export function runEncounter(
  world: World,
  actor: CharacterInstance,
  subject: CharacterInstance,
  tick: number,
): Encounter {
  const situation = allyDown(subject.instanceId, SCENARIO.enemyThreat, tick);
  const state = buildAgentState(actor, situation, SCENARIO.order);
  const decision = decide(state);

  const result = runTransaction(world, ResolveTransaction, {
    actor: actor.instanceId,
    action: decision.reason.action,
    situation,
  });
  if (!result.ok) throw new Error(result.error);

  return {
    actor,
    subject,
    situation,
    state,
    decision,
    died: result.value.died,
  };
}

export function summon(
  world: World,
  definitionId: (typeof VANGUARD)['definitionId'],
  initial?: Parameters<typeof SummonTransaction.apply>[1]['initial'],
): CharacterInstance {
  const result = runTransaction(world, SummonTransaction, { definitionId, initial });
  if (!result.ok) throw new Error(result.error);
  return result.value;
}
