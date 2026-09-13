/**
 * L2 GOAP 검증.
 *
 * 플래너가 "계획처럼 보이는 것"을 내는지가 아니라 **말이 되는 계획**을 내는지 본다.
 * 순서가 틀린 계획, 전제조건을 무시한 계획, 불가능한데도 내놓는 계획을 잡는 테스트다.
 */

import { describe, expect, it } from 'vitest';
import type { AgentState, MemoryInfluence } from '../src/core/agentState.js';
import { goalId, instanceId, memoryId } from '../src/core/ids.js';
import type { Goal, Personality } from '../src/core/instance.js';
import { decide } from '../src/decision/decide.js';
import { applyL2 } from '../src/decision/l2Goap.js';
import { tolerableThreat } from '../src/decision/goapActions.js';
import { SCENARIO, buildScenario, runEncounter, summon } from '../src/scenario/coreGameplay.js';
import { SCOUT } from '../src/data/definitions.js';

const PERSONALITY: Personality = {
  risk: 50,
  loyalty: 70,
  sociability: 50,
  aggression: 55,
  honesty: 60,
};

const GOAL: Goal = {
  goalId: goalId('t_never_abandon'),
  kind: 'never_abandon_ally',
  priority: 85,
  sourceMemory: memoryId('0001'),
  createdAtTick: 0,
};

const MEMORY: MemoryInfluence = {
  tag: 'ally_died_by_my_retreat',
  importance: 90,
  memoryId: memoryId('0001'),
};

function state(overrides: Partial<AgentState> = {}): AgentState {
  return {
    self: instanceId('0100'),
    personality: PERSONALITY,
    healthRatio: 1,
    fear: 20,
    subject: instanceId('0101'),
    trustInSubject: 20,
    selfRisk: 70,
    memoryInfluences: [MEMORY],
    goals: [GOAL],
    order: SCENARIO.order,
    tick: 1,
    ...overrides,
  };
}

describe('플래너가 내는 계획이 말이 되는가', () => {
  it('구조는 이탈보다 앞선다 — 전장을 떠난 뒤에는 구할 수 없다', () => {
    const result = applyL2(state());
    expect(result).toBeDefined();
    const steps = result!.plan.steps;

    expect(steps).toContain('RESCUE');
    expect(steps).toContain('FALL_BACK');
    expect(steps.indexOf('RESCUE')).toBeLessThan(steps.indexOf('FALL_BACK'));
  });

  it('연막은 반드시 구조보다 앞선다', () => {
    // 감당 상한을 넘는 위협 → 연막이 필요하다
    const s = state({ fear: 80 });
    expect(s.selfRisk).toBeGreaterThan(tolerableThreat(s));

    const steps = applyL2(s)!.plan.steps;
    expect(steps).toContain('SUPPRESS');
    expect(steps.indexOf('SUPPRESS')).toBeLessThan(steps.indexOf('RESCUE'));
  });

  it('감당할 수 있으면 연막을 쓰지 않는다 — 소모품을 낭비하지 않는다', () => {
    const s = state({ fear: 20 });
    expect(s.selfRisk).toBeLessThanOrEqual(tolerableThreat(s));
    expect(applyL2(s)!.plan.steps).not.toContain('SUPPRESS');
  });

  it('연막으로도 안 되면 계획이 없다 — L1으로 내려간다', () => {
    // 중상: 체감 위협이 오르고 감당 상한은 내려가 연막으로도 메울 수 없다
    const s = state({ fear: 80, healthRatio: 0.45, selfRisk: 93 });
    expect(applyL2(s)).toBeUndefined();
    expect(decide(s).reason.layer).toBe('L1');
  });

  it('목표가 없으면 L2는 아무것도 하지 않는다', () => {
    expect(applyL2(state({ goals: [] }))).toBeUndefined();
    expect(decide(state({ goals: [], memoryInfluences: [] })).reason.layer).toBe('L1');
  });

  it('계획은 결정론적이다 — 같은 입력이면 같은 계획', () => {
    const a = applyL2(state({ fear: 80 }))!.plan;
    const b = applyL2(state({ fear: 80 }))!.plan;
    expect(a.steps).toEqual(b.steps);
    expect(a.cost).toBe(b.cost);
  });

  it('ReasonCode에 계획 전체와 근거 기억이 남는다 (규칙 6)', () => {
    const reason = applyL2(state({ fear: 80 }))!.reason;
    expect(reason.layer).toBe('L2');
    expect(reason.factors.find((f) => f.key === 'plan')?.value).toBe(
      'SUPPRESS→RESCUE→FALL_BACK',
    );
    expect(reason.factors.find((f) => f.key === 'source')?.value).toBe(GOAL.sourceMemory);
    expect(reason.overrides?.[0]?.key).toBe('fear');
  });
});

describe('공포는 목표를 지우지 못하지만 방법을 바꾼다', () => {
  it('같은 목표·같은 체력에서 공포만 올리면 연막이 계획에 들어온다', () => {
    const calm = applyL2(state({ fear: 20 }))!.plan.steps;
    const afraid = applyL2(state({ fear: 80 }))!.plan.steps;

    expect(calm).not.toContain('SUPPRESS');
    expect(afraid).toContain('SUPPRESS');
    // 목표는 둘 다 달성한다
    expect(calm).toContain('RESCUE');
    expect(afraid).toContain('RESCUE');
  });
});

describe('계획은 결과를 바꾼다', () => {
  it('연막을 포함한 계획으로 구조하면 피해가 줄어든다', () => {
    const { world, squad } = buildScenario();
    const [seine, doha] = squad;

    world.advanceTick();
    // 세인: 계획 없이 구조 (기억 없음) — 위협도 그대로 받는다
    const unplanned = runEncounter(world, seine!.vanguard, seine!.ally, world.tick);
    expect(unplanned.decision.plan).toBeUndefined();

    // 도하: 1차에 퇴각 → 기억/목표 생성
    runEncounter(world, doha!.vanguard, doha!.ally, world.tick);

    world.advanceTick();
    const newAlly = summon(world, SCOUT.definitionId);
    const planned = runEncounter(world, doha!.vanguard, newAlly, world.tick);

    expect(planned.decision.plan?.steps).toContain('SUPPRESS');
    expect(planned.damageTaken).toBeLessThan(unplanned.damageTaken);
  });
});

describe('4명 비교 — 같은 상황, 같은 Definition, 다른 State', () => {
  it('기억이 없을 때는 신뢰와 침착이 둘 다 있어야 구하러 간다', () => {
    const { world, squad } = buildScenario();
    world.advanceTick();

    const actions = squad.map((pair) => ({
      label: pair.label,
      action: runEncounter(world, pair.vanguard, pair.ally, world.tick).decision.reason.action,
    }));

    expect(actions).toEqual([
      { label: 'fear=20 trust=80', action: 'RESCUE' },
      { label: 'fear=80 trust=20', action: 'RETREAT' },
      { label: 'fear=80 trust=80', action: 'RETREAT' },
      { label: 'fear=20 trust=20', action: 'RETREAT' },
    ]);
  });

  it('네 명 모두 같은 Definition에서 나왔고 이름이 서로 다르다', () => {
    const { squad } = buildScenario();
    const definitions = new Set(squad.map((p) => p.vanguard.identity.definitionId));
    const names = squad.map((p) => p.vanguard.identity.name);

    expect(definitions.size).toBe(1);
    expect(new Set(names).size).toBe(4);
  });
});
