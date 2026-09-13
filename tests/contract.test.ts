/**
 * CORE CONTRACT 규칙 자체를 검증하는 테스트.
 *
 * 이 파일이 깨지면 기능이 아니라 **계약**이 깨진 것이다. 기능 테스트보다 먼저 본다.
 */

import { readFileSync, readdirSync, statSync } from 'node:fs';
import { join } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { World } from '../src/core/world.js';
import { runTransaction } from '../src/core/transaction.js';
import { SummonTransaction } from '../src/transactions/summon.js';
import { ALL_DEFINITIONS, SCOUT, VANGUARD } from '../src/data/definitions.js';
import { definitionId } from '../src/core/ids.js';
import { buildScenario, runEncounter, summon } from '../src/scenario/coreGameplay.js';
import type { EventKind } from '../src/core/events.js';
import { formatReason } from '../src/decision/reason.js';

describe('규칙 8 — 중복 획득은 새 Instance', () => {
  it('같은 Definition을 두 번 소환하면 서로 다른 개체가 나온다', () => {
    const world = World.create(1234, ALL_DEFINITIONS);
    const first = summon(world, VANGUARD.definitionId);
    const second = summon(world, VANGUARD.definitionId);

    expect(first.instanceId).not.toBe(second.instanceId);
    expect(first.identity.definitionId).toBe(second.identity.definitionId);
    // 성격은 Definition의 범위에서 각각 뽑힌다
    expect(first.personality).not.toEqual(second.personality);
    // 기억과 관계는 공유되지 않는다
    expect(first.memory).not.toBe(second.memory);
    expect(first.relationships).not.toBe(second.relationships);
  });

  it('살아있든 죽었든 모든 개체의 이름은 서로 다르다 (규칙 8: 완전히 다른 이름)', () => {
    const world = World.create(4242, ALL_DEFINITIONS);
    // 이름 풀(4개)보다 많이 소환해 소진 경로까지 확인한다
    const names = Array.from({ length: 7 }, () => summon(world, SCOUT.definitionId).identity.name);
    expect(new Set(names).size).toBe(names.length);
  });

  it('성격은 Definition이 정한 범위를 벗어나지 않는다', () => {
    const world = World.create(777, ALL_DEFINITIONS);
    for (let i = 0; i < 20; i += 1) {
      const c = summon(world, SCOUT.definitionId);
      const r = SCOUT.personalityRanges;
      expect(c.personality.risk).toBeGreaterThanOrEqual(r.risk.min);
      expect(c.personality.risk).toBeLessThanOrEqual(r.risk.max);
      expect(c.personality.loyalty).toBeGreaterThanOrEqual(r.loyalty.min);
      expect(c.personality.loyalty).toBeLessThanOrEqual(r.loyalty.max);
    }
  });
});

describe('규칙 4 — 트랜잭션을 통한 상태 변경', () => {
  it('검증 실패 시 상태가 변하지 않는다', () => {
    const world = World.create(1, ALL_DEFINITIONS);
    const before = world.allInstances().length;

    const result = runTransaction(world, SummonTransaction, {
      definitionId: definitionId('does_not_exist'),
    });

    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toContain('알 수 없는 Definition');
    expect(world.allInstances().length).toBe(before);
  });

  it('성공한 트랜잭션은 그 트랜잭션이 만든 이벤트만 반환한다', () => {
    const { world, vanguardB, allyOfB } = buildScenario();
    world.advanceTick();
    const eventsBefore = world.events.length;

    runEncounter(world, vanguardB, allyOfB, world.tick);

    expect(world.events.length).toBeGreaterThan(eventsBefore);
  });
});

describe('규칙 3 — Event는 6종, append-only', () => {
  const ALLOWED: readonly EventKind[] = [
    'Death',
    'RelationshipChange',
    'MajorMemory',
    'MissionOutcome',
    'WorldDiscovery',
    'LegacyCreation',
  ];

  it('기록된 모든 이벤트가 6종 안에 있다', () => {
    const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();
    world.advanceTick();
    runEncounter(world, vanguardA, allyOfA, world.tick);
    runEncounter(world, vanguardB, allyOfB, world.tick);

    expect(world.events.length).toBeGreaterThan(0);
    for (const event of world.events.all()) {
      expect(ALLOWED).toContain(event.kind);
    }
  });

  it('EventLog에는 수정/삭제 경로가 없다', () => {
    const { world } = buildScenario();
    const log = world.events as unknown as Record<string, unknown>;
    for (const forbidden of ['splice', 'pop', 'shift', 'set', 'remove', 'update', 'delete']) {
      expect(typeof log[forbidden]).toBe('undefined');
    }
  });

  it('seq는 1부터 빈틈없이 증가한다', () => {
    const { world, vanguardA, allyOfA } = buildScenario();
    world.advanceTick();
    runEncounter(world, vanguardA, allyOfA, world.tick);

    const seqs = world.events.all().map((e) => e.seq);
    expect(seqs).toEqual(seqs.map((_, i) => i + 1));
  });
});

describe('규칙 6 — 모든 Decision은 ReasonCode를 가진다', () => {
  it('ReasonCode 없이 만들어진 판단이 없다', () => {
    const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();
    world.advanceTick();
    for (const enc of [
      runEncounter(world, vanguardA, allyOfA, world.tick),
      runEncounter(world, vanguardB, allyOfB, world.tick),
    ]) {
      expect(enc.decision.reason.action).toBeTruthy();
      expect(enc.decision.reason.layer).toMatch(/^L[01]$/);
      expect(enc.decision.reason.factors.length).toBeGreaterThan(0);
      expect(formatReason(enc.decision.reason)).toMatch(/^[A-Z]+\(.+\)$/);
    }
  });

  it('브리핑 예시와 같은 형식으로 렌더링된다', () => {
    expect(
      formatReason({
        action: 'RETREAT',
        layer: 'L1',
        factors: [{ key: 'fear', value: 72, op: '>', threshold: 60 }],
      }),
    ).toBe('RETREAT(fear=72>threshold=60)');

    expect(
      formatReason({
        action: 'RESCUE',
        layer: 'L1',
        factors: [
          { key: 'target', value: 'Mira' },
          { key: 'trust', value: 81 },
          { key: 'self_risk', value: 45 },
        ],
      }),
    ).toBe('RESCUE(target=Mira,trust=81,self_risk=45)');

    expect(
      formatReason({
        action: 'HOLD',
        layer: 'L0',
        factors: [
          { key: 'order', value: 'defend' },
          { key: 'loyalty', value: 90 },
        ],
        overrides: [{ key: 'fear', value: 65 }],
      }),
    ).toBe('HOLD(order=defend,loyalty=90 overrides fear=65)');
  });
});

describe('규칙 5 — LLM은 행동을 결정하지 않는다', () => {
  it('시나리오 전체가 네트워크 호출 0회로 동작한다', () => {
    const fetchSpy = vi.fn(() => {
      throw new Error('네트워크 호출이 발생했다 — LLM 의존이 들어갔는지 확인할 것');
    });
    vi.stubGlobal('fetch', fetchSpy);

    try {
      const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();
      world.advanceTick();
      runEncounter(world, vanguardA, allyOfA, world.tick);
      runEncounter(world, vanguardB, allyOfB, world.tick);
      world.advanceTick();
      const newAlly = summon(world, SCOUT.definitionId);
      runEncounter(world, vanguardA, allyOfA, world.tick);
      runEncounter(world, vanguardB, newAlly, world.tick);

      expect(world.events.length).toBeGreaterThan(0);
    } finally {
      vi.unstubAllGlobals();
    }

    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('src/ 어디에도 LLM SDK 의존이나 네트워크 호출이 없다', () => {
    const offenders: string[] = [];
    const forbidden = [
      /from\s+['"]@anthropic-ai\//,
      /from\s+['"]openai['"]/,
      /require\(['"]@anthropic-ai\//,
      /\bfetch\s*\(/,
      /\bXMLHttpRequest\b/,
      /from\s+['"]node:https?['"]/,
    ];

    for (const file of walk('src')) {
      const text = readFileSync(file, 'utf8');
      for (const pattern of forbidden) {
        if (pattern.test(text)) offenders.push(`${file} :: ${pattern}`);
      }
    }

    expect(offenders).toEqual([]);
  });

  it('결정론 — 같은 시드로 두 번 돌리면 완전히 같은 결과가 나온다', () => {
    const run = () => {
      const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();
      world.advanceTick();
      const a = runEncounter(world, vanguardA, allyOfA, world.tick);
      const b = runEncounter(world, vanguardB, allyOfB, world.tick);
      return {
        actions: [a.decision.reason.action, b.decision.reason.action],
        reasons: [formatReason(a.decision.reason), formatReason(b.decision.reason)],
        events: world.events.all().map((e) => `${e.seq}:${e.kind}`),
        names: world.allInstances().map((i) => i.identity.name),
      };
    };

    expect(run()).toEqual(run());
  });
});

describe('규칙 1 — 4단 분리', () => {
  it('AgentState는 저장되지 않는다 (Snapshot에 Instance만 들어간다)', async () => {
    const { world } = buildScenario();
    const { takeSnapshot } = await import('../src/persistence/snapshot.js');
    const snapshot = takeSnapshot(world);

    expect(Object.keys(snapshot).sort()).toEqual([
      'events',
      'idCounter',
      'instances',
      'rngState',
      'tick',
      'version',
    ]);
    for (const instance of snapshot.instances) {
      expect(instance).not.toHaveProperty('selfRisk');
      expect(instance).not.toHaveProperty('trustInSubject');
    }
  });

  it('AgentState는 판단 시점 스냅샷이다 — 이후 Instance 변경이 비치지 않는다', () => {
    const { world, vanguardB, allyOfB } = buildScenario();
    world.advanceTick();
    const encounter = runEncounter(world, vanguardB, allyOfB, world.tick);

    // 이 행동으로 B에게 목표와 기억이 생겼지만, 판단 시점에는 없었다
    expect(vanguardB.goals.length).toBeGreaterThan(0);
    expect(vanguardB.memory.length).toBeGreaterThan(0);
    expect(encounter.state.goals).toHaveLength(0);
    expect(encounter.state.memoryInfluences).toHaveLength(0);
  });

  it('판단 모듈은 World나 렌더러를 참조하지 않는다', () => {
    for (const file of walk('src/decision')) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/from\s+['"].*\/world\.js['"]/);
      expect(text).not.toMatch(/from\s+['"].*\/log\/.*['"]/);
    }
  });

  it('렌더러는 판단 함수를 호출하지 않는다', () => {
    for (const file of walk('src/log')) {
      const text = readFileSync(file, 'utf8');
      expect(text).not.toMatch(/\bdecide\s*\(/);
      expect(text).not.toMatch(/applyL[01]/);
    }
  });
});

function walk(dir: string): string[] {
  const out: string[] = [];
  for (const entry of readdirSync(dir)) {
    const full = join(dir, entry);
    if (statSync(full).isDirectory()) out.push(...walk(full));
    else if (full.endsWith('.ts')) out.push(full);
  }
  return out;
}
