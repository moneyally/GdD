/**
 * 탑 10층 미션 검증.
 *
 * 층이 굴러가는지가 아니라, **미션이 규칙을 지키면서 굴러가는지**를 본다:
 * 쓰러진 당사자가 판단하지 않는지, 기록이 중복되지 않는지, 중단 조건이 실제로 걸리는지,
 * 그리고 등반 전체가 저장·복원되는지.
 */

import { describe, expect, it } from 'vitest';
import { World } from '../src/core/world.js';
import { runTransaction } from '../src/core/transaction.js';
import { ALL_DEFINITIONS } from '../src/data/definitions.js';
import {
  ReachFloorTransaction,
  TOWER,
  floorKey,
  runTower,
} from '../src/mission/tower.js';
import { ResolveTransaction } from '../src/sim/resolve.js';
import { allyDown } from '../src/decision/situation.js';
import { buildParty, runTowerScenario, TOWER_RUN } from '../src/scenario/towerRun.js';
import { takeSnapshot } from '../src/persistence/snapshot.js';
import { serialize } from '../src/persistence/jsonRepository.js';
import type { MasterOrder } from '../src/core/order.js';

describe('파티 편성', () => {
  it('편성으로 상호 신뢰가 생기고 관계 변화가 Event로 남는다', () => {
    const world = World.create(1, ALL_DEFINITIONS);
    const party = buildParty(world);

    for (const member of party) {
      const others = party.filter((c) => c.instanceId !== member.instanceId);
      expect(member.relationships).toHaveLength(others.length);
      for (const other of others) {
        expect(member.relationships.find((r) => r.target === other.instanceId)?.trust).toBe(
          TOWER_RUN.baseTrust,
        );
      }
    }

    const formed = world.events
      .ofKind('RelationshipChange')
      .filter((e) => e.cause === 'party_formed');
    expect(formed).toHaveLength(party.length * (party.length - 1));
  });

  it('편성된 파티가 서로를 더 자주 구한다 (관계가 결과를 바꾼다)', () => {
    // 편성 여부만 다르게 하고 같은 시드들을 돌린다.
    // 한 층만 보면 우연에 묻히므로 여러 시드의 구조율로 비교한다.
    const measure = (formed: boolean) => {
      let rescued = 0;
      let floors = 0;
      let deaths = 0;
      for (let i = 0; i < 12; i += 1) {
        const world = World.create(9000 + i * 13, ALL_DEFINITIONS);
        const party = buildParty(world);
        if (!formed) for (const member of party) member.relationships.length = 0;
        const result = runTower(
          world,
          party.map((c) => c.instanceId),
          TOWER_RUN.order,
        );
        floors += result.floors.length;
        rescued += result.floors.filter((f) => f.rescued).length;
        deaths += result.deaths.length;
      }
      return { rescueRate: rescued / floors, deaths };
    };

    const withTrust = measure(true);
    const withoutTrust = measure(false);

    expect(withTrust.rescueRate).toBeGreaterThan(withoutTrust.rescueRate);
    expect(withTrust.deaths).toBeLessThan(withoutTrust.deaths);
  });
});

describe('탑의 기록 — WorldDiscovery', () => {
  it('층 도달은 한 번만 기록된다', () => {
    const world = World.create(2, ALL_DEFINITIONS);
    const party = buildParty(world);
    const by = party[0]!.instanceId;

    const first = runTransaction(world, ReachFloorTransaction, { floor: 3, by });
    const second = runTransaction(world, ReachFloorTransaction, { floor: 3, by });

    expect(first.ok && first.value).toBe(true);
    expect(second.ok && second.value).toBe(false);
    expect(
      world.events.ofKind('WorldDiscovery').filter((e) => e.what === floorKey(3)),
    ).toHaveLength(1);
  });

  it('탑에 없는 층은 기록되지 않는다', () => {
    const world = World.create(2, ALL_DEFINITIONS);
    const party = buildParty(world);
    const result = runTransaction(world, ReachFloorTransaction, {
      floor: TOWER.floors + 1,
      by: party[0]!.instanceId,
    });

    expect(result.ok).toBe(false);
    expect(world.events.ofKind('WorldDiscovery')).toHaveLength(0);
  });

  it('두 번째 등반에서는 이미 발견한 층이 최초 도달이 아니다', () => {
    const world = World.create(3, ALL_DEFINITIONS);

    const first = buildParty(world);
    const firstRun = runTower(
      world,
      first.map((c) => c.instanceId),
      TOWER_RUN.order,
    );
    expect(firstRun.floors[0]?.firstVisit).toBe(true);

    // 새 파티로 다시 오른다 — 캐릭터는 새 개체지만 탑의 기록은 남아 있다
    const second = buildParty(world);
    const secondRun = runTower(
      world,
      second.map((c) => c.instanceId),
      TOWER_RUN.order,
    );

    const revisited = secondRun.floors.filter((f) => f.floor <= firstRun.deepestFloor);
    expect(revisited.length).toBeGreaterThan(0);
    expect(revisited.every((f) => !f.firstVisit)).toBe(true);
  });
});

describe('조우 규칙', () => {
  it('쓰러진 당사자는 판단하지 않는다', () => {
    const { result } = runTowerScenario();
    for (const floor of result.floors) {
      expect(
        floor.decisions.some((d) => d.actor.instanceId === floor.fallen.instanceId),
      ).toBe(false);
    }
  });

  it('한 명이라도 구하러 가면 쓰러진 동료는 살고, 아무도 안 가면 죽는다', () => {
    const { world, result } = runTowerScenario();
    for (const floor of result.floors) {
      // 구조는 RESCUE만이다 — ATTACK은 적을 치는 것이고 동료를 끌어내지 않는다
      const rescuerExists = floor.decisions.some(
        (d) => d.decision.reason.action === 'RESCUE',
      );
      expect(floor.rescued).toBe(rescuerExists);
      if (!rescuerExists) {
        expect(floor.died).toContain(floor.fallen.instanceId);
        expect(world.instance(floor.fallen.instanceId).status).toBe('dead');
      }
    }
  });

  it('교전을 택한 사람도 동료를 구한 것이 아니다', () => {
    const world = World.create(14, ALL_DEFINITIONS);
    const party = buildParty(world);
    world.advanceTick();

    const fallen = party[0]!;
    const result = runTransaction(world, ResolveTransaction, {
      situation: allyDown(fallen.instanceId, 40, world.tick),
      decisions: [{ actor: party[1]!.instanceId, action: 'ATTACK' }],
    });

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.rescued).toBe(false);
    expect(fallen.status).toBe('dead');
    // 교전한 사람도 '구하지 않았다'는 기억을 갖는다
    expect(party[1]!.memory.map((m) => m.tag)).toContain('ally_died_unrescued');
    expect(party[1]!.memory.map((m) => m.tag)).not.toContain('rescued_ally');
  });

  it('아무도 구하지 않으면 물러선 전원에게 기억과 목표가 생긴다', () => {
    const world = World.create(11, ALL_DEFINITIONS);
    const party = buildParty(world);
    for (const member of party) member.relationships.length = 0; // 전원 퇴각을 유도

    world.advanceTick();
    const fallen = party[0]!;
    const others = party.slice(1);
    const result = runTransaction(world, ResolveTransaction, {
      situation: allyDown(fallen.instanceId, 60, world.tick),
      decisions: others.map((c) => ({ actor: c.instanceId, action: 'RETREAT' as const })),
    });

    expect(result.ok).toBe(true);
    expect(fallen.status).toBe('dead');
    for (const survivor of others) {
      expect(survivor.memory.map((m) => m.tag)).toContain('ally_died_unrescued');
      expect(survivor.goals.map((g) => g.kind)).toContain('never_abandon_ally');
    }
  });

  it('같은 캐릭터의 판단이 두 번 들어오면 거부한다', () => {
    const world = World.create(12, ALL_DEFINITIONS);
    const party = buildParty(world);
    const result = runTransaction(world, ResolveTransaction, {
      situation: allyDown(party[0]!.instanceId, 50, world.tick),
      decisions: [
        { actor: party[1]!.instanceId, action: 'RESCUE' },
        { actor: party[1]!.instanceId, action: 'RETREAT' },
      ],
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('두 번');
  });

  it('쓰러진 당사자가 판단자로 들어오면 거부한다', () => {
    const world = World.create(13, ALL_DEFINITIONS);
    const party = buildParty(world);
    const result = runTransaction(world, ResolveTransaction, {
      situation: allyDown(party[0]!.instanceId, 50, world.tick),
      decisions: [{ actor: party[0]!.instanceId, action: 'RESCUE' }],
    });

    expect(result.ok).toBe(false);
  });
});

describe('피로와 회복 — 후반 층이 어려운 이유', () => {
  it('층 사이 휴식은 체력을 회복하지만 피로는 남긴다', () => {
    const { world, result } = runTowerScenario();
    expect(result.floors.length).toBeGreaterThan(2);

    for (const id of result.survivors) {
      const survivor = world.instance(id);
      // 여러 층을 겪었으므로 피로가 쌓여 있다
      expect(survivor.needs.fatigue).toBeGreaterThan(0);
    }
  });

  it('피로가 쌓이면 행동 여력(stamina)이 줄어 계획을 세울 수 없게 된다', async () => {
    const { buildAgentState } = await import('../src/core/agentState.js');
    const world = World.create(21, ALL_DEFINITIONS);
    const party = buildParty(world);
    const actor = party[1]!;
    const situation = allyDown(party[0]!.instanceId, 50, 1);

    const fresh = buildAgentState(actor, situation, TOWER_RUN.order);
    actor.needs.fatigue = 70;
    const tired = buildAgentState(actor, situation, TOWER_RUN.order);

    expect(tired.stamina).toBeLessThan(fresh.stamina);
    expect(tired.stamina).toBe(fresh.stamina - 70);
  });
});

describe('중단 조건', () => {
  it('전원이 Master 퇴각선 아래로 떨어지면 등반을 중단한다', () => {
    const world = World.create(31, ALL_DEFINITIONS);
    const party = buildParty(world);
    // 퇴각선을 아주 높게 두면 1층을 오르고 바로 중단된다
    const order: MasterOrder = {
      goal: 'advance',
      riskPolicy: 'balanced',
      retreatCondition: { healthRatioBelow: 0.99 },
    };

    const result = runTower(
      world,
      party.map((c) => c.instanceId),
      order,
    );

    expect(result.cleared).toBe(false);
    expect(result.abortReason).toBe('party_spent');
    expect(result.deepestFloor).toBeLessThan(TOWER.floors);
  });

  it('인원이 2명 미만이면 등반을 중단한다', () => {
    const world = World.create(32, ALL_DEFINITIONS);
    const party = buildParty(world);
    // 2명만 데려가고 한 명을 미리 죽은 상태로 만들 수는 없으므로,
    // 편성 최소 인원(2명)으로 시작해 한 명이 죽으면 중단되는지 본다
    const two = party.slice(0, 2);
    for (const member of two) member.relationships.length = 0; // 서로 버리게 만든다

    const result = runTower(
      world,
      two.map((c) => c.instanceId),
      TOWER_RUN.order,
    );

    expect(result.deaths.length).toBe(1);
    expect(result.abortReason).toBe('too_few_to_continue');
    expect(result.deepestFloor).toBe(1);
  });

  it('10층을 다 오르면 클리어다', () => {
    // cautious + 낮은 퇴각선 조합은 대부분 클리어한다
    const order: MasterOrder = {
      goal: 'advance',
      riskPolicy: 'cautious',
      retreatCondition: { healthRatioBelow: 0.25 },
    };
    let cleared = 0;
    for (let i = 0; i < 10; i += 1) {
      const world = World.create(41 + i, ALL_DEFINITIONS);
      const party = buildParty(world);
      const result = runTower(
        world,
        party.map((c) => c.instanceId),
        order,
      );
      if (result.cleared) {
        cleared += 1;
        expect(result.deepestFloor).toBe(TOWER.floors);
        expect(result.abortReason).toBeUndefined();
      }
    }
    // 10층이 도달 가능한 층이어야 한다 — 한때 클리어율이 0%였다
    expect(cleared).toBeGreaterThan(0);
  });
});

describe('등반은 결정론적이고 저장 가능하다', () => {
  it('같은 시드로 두 번 오르면 완전히 같은 결과가 나온다', () => {
    const summarize = () => {
      const { world, result } = runTowerScenario(5150);
      return {
        depth: result.deepestFloor,
        cleared: result.cleared,
        deaths: result.deaths.length,
        events: world.events.all().map((e) => `${e.seq}:${e.kind}`),
        actions: result.floors.flatMap((f) =>
          f.decisions.map((d) => `${f.floor}:${d.decision.reason.action}`),
        ),
      };
    };
    expect(summarize()).toEqual(summarize());
  });

  it('등반이 끝난 세계를 저장하고 복원하면 동일하다', () => {
    const { world } = runTowerScenario(5151);
    const snapshot = takeSnapshot(world);

    const restored = World.restore({
      tick: snapshot.tick,
      instances: snapshot.instances,
      definitions: ALL_DEFINITIONS,
      rngState: snapshot.rngState,
      idCounter: snapshot.idCounter,
      events: snapshot.events,
    });

    expect(serialize(takeSnapshot(restored))).toBe(serialize(snapshot));
  });
});
