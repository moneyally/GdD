/**
 * JSON 파일 저장소. MVP 구현.
 *
 * 직렬화 순서를 고정한다 — 같은 State가 항상 같은 바이트가 되어야
 * "저장 → 재시작 → 복원 → 동일 State"를 파일 비교로도 검증할 수 있다.
 */

import { mkdir, readFile, writeFile } from 'node:fs/promises';
import { dirname } from 'node:path';
import type { SnapshotRepository } from './repository.js';
import { serialize } from './serialize.js';
import { assertSnapshotVersion, type Snapshot } from './snapshot.js';

// 직렬화는 `serialize.ts`에 있다 — 브라우저에서도 같은 바이트가 나와야 하므로
// node:fs를 아는 이 파일에 둘 수 없다. 기존 import 경로는 유지한다.
export { serialize };

export class JsonSnapshotRepository implements SnapshotRepository {
  constructor(private readonly path: string) {}

  async save(snapshot: Snapshot): Promise<void> {
    await mkdir(dirname(this.path), { recursive: true });
    await writeFile(this.path, serialize(snapshot), 'utf8');
  }

  async load(): Promise<Snapshot | undefined> {
    let raw: string;
    try {
      raw = await readFile(this.path, 'utf8');
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code === 'ENOENT') return undefined;
      throw error;
    }
    const snapshot = JSON.parse(raw) as Snapshot;
    assertSnapshotVersion(snapshot);
    return snapshot;
  }
}
