/**
 * 브리핑 4절 통과 기준 — 판단 부분.
 *
 *   given 동일 상황
 *     A: fear=20, trust(동료)=80  → RESCUE
 *     B: fear=80, trust(동료)=20  → RETREAT
 *   and 행동 후 State가 변한다
 *   and 같은 상황을 다시 주면 변화된 State 때문에 이전과 다른 판단이 나온다
 */

import { describe, expect, it } from 'vitest';
import { buildScenario, runEncounter, summon, SCENARIO } from '../src/scenario/coreGameplay.js';
import { SCOUT } from '../src/data/definitions.js';
import { formatReason } from '../src/decision/reason.js';
import { buildAgentState } from '../src/core/agentState.js';
import { decide } from '../src/decision/decide.js';
import { allyDown } from '../src/decision/situation.js';

describe('1차 조우 — 동일 상황에서 State가 판단을 가른다', () => {
  it('A(fear=20, trust=80)는 RESCUE, B(fear=80, trust=20)는 RETREAT', () => {
    const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();

    // 초기 조건이 통과 기준과 일치하는지 먼저 확인
    expect(vanguardA.emotion.fear).toBe(20);
    expect(vanguardA.relationships[0]?.trust).toBe(80);
    expect(vanguardB.emotion.fear).toBe(80);
    expect(vanguardB.relationships[0]?.trust).toBe(20);

    world.advanceTick();
    const a = runEncounter(world, vanguardA, allyOfA, world.tick);
    const b = runEncounter(world, vanguardB, allyOfB, world.tick);

    expect(a.decision.reason.action).toBe('RESCUE');
    expect(b.decision.reason.action).toBe('RETREAT');
  });

  it('두 캐릭터는 같은 Definition에서 나왔다 (규칙 8 — 판단 차이가 Definition 차이가 아님)', () => {
    const { vanguardA, vanguardB } = buildScenario();
    expect(vanguardA.identity.definitionId).toBe(vanguardB.identity.definitionId);
    expect(vanguardA.instanceId).not.toBe(vanguardB.instanceId);
  });

  it('ReasonCode가 판단 근거를 담는다', () => {
    const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();
    world.advanceTick();
    const a = runEncounter(world, vanguardA, allyOfA, world.tick);
    const b = runEncounter(world, vanguardB, allyOfB, world.tick);

    const aReason = formatReason(a.decision.reason);
    expect(aReason).toMatch(/^RESCUE\(/);
    expect(aReason).toContain('trust=80');
    expect(aReason).toContain('fear=20');
    expect(aReason).toContain('self_risk=');

    const bReason = formatReason(b.decision.reason);
    expect(bReason).toMatch(/^RETREAT\(/);
    expect(bReason).toContain('fear=80');
  });
});

describe('행동 후 State 변화', () => {
  it('A는 부상을 입고 동료와의 신뢰가 오른다', () => {
    const { world, vanguardA, allyOfA } = buildScenario();
    const healthBefore = vanguardA.needs.health;
    const trustBefore = vanguardA.relationships[0]!.trust;

    world.advanceTick();
    runEncounter(world, vanguardA, allyOfA, world.tick);

    expect(vanguardA.needs.health).toBeLessThan(healthBefore);
    // 양방향 신뢰 상승
    expect(vanguardA.relationships[0]!.trust).toBeGreaterThan(trustBefore);
    expect(allyOfA.relationships.find((r) => r.target === vanguardA.instanceId)?.trust)
      .toBeGreaterThan(50);
    expect(allyOfA.status).toBe('alive');

    const relationshipEvents = world.events.ofKind('RelationshipChange');
    expect(relationshipEvents.length).toBeGreaterThan(0);
  });

  it('B는 동료의 죽음을 목격하고 MajorMemory가 생긴다', () => {
    const { world, vanguardB, allyOfB } = buildScenario();
    expect(vanguardB.memory).toHaveLength(0);

    world.advanceTick();
    runEncounter(world, vanguardB, allyOfB, world.tick);

    expect(allyOfB.status).toBe('dead');
    expect(world.events.ofKind('Death')).toHaveLength(1);

    const memoryEvents = world.events.ofKind('MajorMemory');
    expect(memoryEvents).toHaveLength(1);
    expect(memoryEvents[0]!.tag).toBe('ally_died_unrescued');
    expect(vanguardB.memory[0]!.tag).toBe('ally_died_unrescued');
  });

  it('죽음은 최종이다 — Instance는 삭제되지 않고 dead로 남는다 (규칙 7)', () => {
    const { world, vanguardB, allyOfB } = buildScenario();
    const countBefore = world.allInstances().length;

    world.advanceTick();
    runEncounter(world, vanguardB, allyOfB, world.tick);

    expect(world.allInstances().length).toBe(countBefore);
    expect(world.find(allyOfB.instanceId)?.status).toBe('dead');
    expect(allyOfB.legacy.diedAtTick).toBe(1);
    expect(world.events.ofKind('LegacyCreation')).toHaveLength(1);
  });
});

describe('2차 조우 — 변화된 State 때문에 판단이 달라진다', () => {
  it('A: RESCUE → RETREAT (부상과 공포 상승이 효용을 뒤집는다)', () => {
    const { world, vanguardA, allyOfA } = buildScenario();

    world.advanceTick();
    const first = runEncounter(world, vanguardA, allyOfA, world.tick);
    expect(first.decision.reason.action).toBe('RESCUE');

    world.advanceTick();
    const second = runEncounter(world, vanguardA, allyOfA, world.tick);

    expect(second.decision.reason.action).toBe('RETREAT');
    expect(second.decision.reason.action).not.toBe(first.decision.reason.action);
    // L0 강제(퇴각 조건)가 아니라 L1 효용 계산으로 뒤집혔음을 확인
    expect(second.decision.reason.layer).toBe('L1');
    expect(vanguardA.needs.health / vanguardA.needs.maxHealth).toBeGreaterThan(
      SCENARIO.order.retreatCondition.healthRatioBelow,
    );
  });

  it('B: RETREAT → RESCUE (기억이 목표를 만들고, L2가 그 목표의 계획을 세운다)', () => {
    const { world, vanguardB, allyOfB } = buildScenario();

    world.advanceTick();
    const first = runEncounter(world, vanguardB, allyOfB, world.tick);
    expect(first.decision.reason.action).toBe('RETREAT');
    expect(vanguardB.goals.map((g) => g.kind)).toContain('never_abandon_ally');

    // 동료가 죽었으므로 새 정찰병을 소환한다 (규칙 8: 다른 개체가 나온다)
    world.advanceTick();
    const newAlly = summon(world, SCOUT.definitionId);
    expect(newAlly.instanceId).not.toBe(allyOfB.instanceId);

    const second = runEncounter(world, vanguardB, newAlly, world.tick);

    expect(second.decision.reason.action).toBe('RESCUE');
    // 목표 처리는 L0 강제가 아니라 L2 계획이다 — 목표는 '무엇을', 계획은 '어떻게'
    expect(second.decision.reason.layer).toBe('L2');
    expect(second.decision.plan?.steps).toEqual(['SUPPRESS', 'RESCUE', 'FALL_BACK']);

    // 근거가 기억에서 나온 목표임이 ReasonCode에 남는다
    const reason = formatReason(second.decision.reason);
    expect(reason).toContain('goal=never_abandon_ally');
    expect(reason).toContain('plan=SUPPRESS→RESCUE→FALL_BACK');
    expect(reason).toContain('overrides');
    expect(reason).toContain('fear=');
    expect(second.decision.reason.factors.find((f) => f.key === 'source')?.value).toBe(
      vanguardB.memory[0]!.memoryId,
    );
  });

  it('기억이 없으면 같은 상황에서 같은 판단이 나온다 (기억이 원인임을 확인)', () => {
    // 대조군: B와 동일한 State를 가지지만 기억/목표가 없는 새 개체
    const { world, vanguardB, allyOfB } = buildScenario();
    world.advanceTick();
    runEncounter(world, vanguardB, allyOfB, world.tick);

    world.advanceTick();
    const newAlly = summon(world, SCOUT.definitionId);

    // 기억과 목표를 제거한 판단 입력을 만들어 비교한다 (State는 그대로)
    const situation = allyDown(newAlly.instanceId, SCENARIO.enemyThreat, world.tick);
    const withMemory = decide(buildAgentState(vanguardB, situation, SCENARIO.order));
    const withoutMemory = decide({
      ...buildAgentState(vanguardB, situation, SCENARIO.order),
      memoryInfluences: [],
      goals: [],
    });

    expect(withMemory.reason.action).toBe('RESCUE');
    expect(withoutMemory.reason.action).toBe('RETREAT');
  });
});
