/**
 * 브리핑 4절 통과 기준 — 저장/복원 부분.
 *
 *   저장 → 프로세스 재시작 → 복원 → 동일 State, 동일 Event Log
 *
 * "프로세스 재시작"을 실제 자식 프로세스로 검증한다. 같은 프로세스에서
 * 객체를 다시 만드는 것으로는 모듈 전역 상태가 남아 있어 증명이 되지 않는다.
 */

import { execFileSync } from 'node:child_process';
import { mkdtempSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { afterAll, describe, expect, it } from 'vitest';
import { buildScenario, runEncounter, summon } from '../src/scenario/coreGameplay.js';
import { SCOUT } from '../src/data/definitions.js';
import { JsonSnapshotRepository, serialize } from '../src/persistence/jsonRepository.js';
import { takeSnapshot } from '../src/persistence/snapshot.js';
import { World } from '../src/core/world.js';
import { ALL_DEFINITIONS } from '../src/data/definitions.js';

const workDir = mkdtempSync(join(tmpdir(), 'living-world-'));

afterAll(() => {
  rmSync(workDir, { recursive: true, force: true });
});

/** 시나리오를 2차 조우까지 끝까지 돌린 세계를 만든다. */
async function playFullScenario() {
  const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();
  world.advanceTick();
  runEncounter(world, vanguardA, allyOfA, world.tick);
  runEncounter(world, vanguardB, allyOfB, world.tick);
  world.advanceTick();
  const newAlly = summon(world, SCOUT.definitionId);
  runEncounter(world, vanguardA, allyOfA, world.tick);
  runEncounter(world, vanguardB, newAlly, world.tick);
  return world;
}

describe('저장 / 복원', () => {
  it('새 프로세스에서 복원한 State와 Event Log가 저장 시점과 완전히 동일하다', async () => {
    const world = await playFullScenario();
    const snapshot = takeSnapshot(world);
    const expected = serialize(snapshot);

    const path = join(workDir, 'snapshot.json');
    await new JsonSnapshotRepository(path).save(snapshot);

    const tsx = join(process.cwd(), 'node_modules', '.bin', 'tsx');
    const actual = execFileSync(tsx, ['src/cli/verifyRestore.ts', path], {
      cwd: process.cwd(),
      encoding: 'utf8',
    });

    expect(actual).toBe(expected);
  }, 60_000);

  it('Event Log 순서(seq)가 복원 후에도 유지된다', async () => {
    const world = await playFullScenario();
    const snapshot = takeSnapshot(world);

    const restored = World.restore({
      tick: snapshot.tick,
      instances: snapshot.instances,
      definitions: ALL_DEFINITIONS,
      rngState: snapshot.rngState,
      idCounter: snapshot.idCounter,
      events: snapshot.events,
    });

    expect(restored.events.all().map((e) => e.seq)).toEqual(
      world.events.all().map((e) => e.seq),
    );
    expect(restored.events.all().map((e) => e.eventId)).toEqual(
      world.events.all().map((e) => e.eventId),
    );
    expect(restored.tick).toBe(world.tick);
  });

  it('복원한 세계에서 이어서 소환하면 저장 전과 같은 난수 결과가 나온다', async () => {
    const first = await playFullScenario();
    const snapshot = takeSnapshot(first);

    const continuedA = summon(first, SCOUT.definitionId);

    const second = World.restore({
      tick: snapshot.tick,
      instances: snapshot.instances,
      definitions: ALL_DEFINITIONS,
      rngState: snapshot.rngState,
      idCounter: snapshot.idCounter,
      events: snapshot.events,
    });
    const continuedB = summon(second, SCOUT.definitionId);

    expect(continuedB.identity.name).toBe(continuedA.identity.name);
    expect(continuedB.personality).toEqual(continuedA.personality);
    expect(continuedB.instanceId).toBe(continuedA.instanceId);
  });
});
