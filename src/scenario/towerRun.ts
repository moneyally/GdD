/**
 * 탑 등반 시나리오 — 파티를 만들고 10층에 올려보낸다.
 *
 * CORE GAMEPLAY 시나리오(coreGameplay.ts)와 분리했다. 저쪽은 통과 기준을 고정하는
 * 시나리오이므로 건드리면 증명이 흔들린다.
 */

import type { CharacterInstance } from '../core/instance.js';
import type { MasterOrder } from '../core/order.js';
import { runTransaction } from '../core/transaction.js';
import { World } from '../core/world.js';
import { ALL_DEFINITIONS, SCOUT, VANGUARD } from '../data/definitions.js';
import { FormPartyTransaction, runTower, type MissionResult } from '../mission/tower.js';
import { summon } from './coreGameplay.js';

export const TOWER_RUN = {
  seed: 77001,
  /** 편성 시점의 상호 신뢰 — 처음 만난 동료 */
  baseTrust: 50,
  order: {
    goal: 'advance',
    riskPolicy: 'balanced',
    retreatCondition: { healthRatioBelow: 0.25 },
  } satisfies MasterOrder,
} as const;

export interface TowerRun {
  readonly world: World;
  readonly party: readonly CharacterInstance[];
  readonly result: MissionResult;
}

/** 선봉 2명 + 정찰 2명. 전부 다른 개체다 (규칙 8) */
export function buildParty(world: World): readonly CharacterInstance[] {
  const party = [
    summon(world, VANGUARD.definitionId),
    summon(world, VANGUARD.definitionId),
    summon(world, SCOUT.definitionId),
    summon(world, SCOUT.definitionId),
  ];

  const formed = runTransaction(world, FormPartyTransaction, {
    members: party.map((c) => c.instanceId),
    baseTrust: TOWER_RUN.baseTrust,
  });
  if (!formed.ok) throw new Error(formed.error);

  return party;
}

export function runTowerScenario(seed: number = TOWER_RUN.seed): TowerRun {
  const world = World.create(seed, ALL_DEFINITIONS);
  const party = buildParty(world);
  const result = runTower(
    world,
    party.map((c) => c.instanceId),
    TOWER_RUN.order,
  );
  return { world, party, result };
}
