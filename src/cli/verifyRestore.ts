/**
 * 별도 프로세스에서 Snapshot을 복원하고 직렬화 결과를 stdout으로 출력한다.
 *
 * 통과 기준의 "저장 → 프로세스 재시작 → 복원 → 동일 State, 동일 Event Log"를
 * 진짜 새 프로세스로 검증하기 위한 도구다. 테스트가 이 파일을 자식 프로세스로 실행한다.
 *
 *   tsx src/cli/verifyRestore.ts <snapshot.json>
 */

import { World } from '../core/world.js';
import { ALL_DEFINITIONS } from '../data/definitions.js';
import { JsonSnapshotRepository } from '../persistence/jsonRepository.js';
import { serialize } from '../persistence/jsonRepository.js';
import { takeSnapshot } from '../persistence/snapshot.js';

async function main(): Promise<void> {
  const path = process.argv[2];
  if (!path) throw new Error('사용법: verifyRestore <snapshot.json>');

  const snapshot = await new JsonSnapshotRepository(path).load();
  if (!snapshot) throw new Error(`Snapshot 없음: ${path}`);

  const world = World.restore({
    tick: snapshot.tick,
    instances: snapshot.instances,
    definitions: ALL_DEFINITIONS,
    rngState: snapshot.rngState,
    idCounter: snapshot.idCounter,
    events: snapshot.events,
  });

  process.stdout.write(serialize(takeSnapshot(world)));
}

main().catch((error: unknown) => {
  console.error(error);
  process.exit(1);
});
