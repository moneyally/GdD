/**
 * 저장소 인터페이스.
 *
 * MVP는 JSON 파일이다. 나중에 PostgreSQL로 바뀔 때 이 인터페이스만 다시 구현하면 되게
 * 한다 — 렌더러 교체(Actor 층)와 같은 방식의 경계다.
 */

import type { Snapshot } from './snapshot.js';

export interface SnapshotRepository {
  save(snapshot: Snapshot): Promise<void>;
  load(): Promise<Snapshot | undefined>;
}
