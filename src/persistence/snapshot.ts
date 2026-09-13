/**
 * Snapshot — CORE CONTRACT 규칙 3의 저장 절반.
 *
 * "Snapshot + ImportantEventLog". 전체 Event Sourcing이 아니므로 Snapshot은
 * 현재 상태 전문을 담고, 이벤트 로그는 중요 사건 6종만 담는다.
 *
 * 복원 검증에 필요한 것들을 빠뜨리기 쉬우므로 명시해둔다:
 * - tick
 * - 난수 상태 (소환 결과 재현)
 * - ID 카운터 (이벤트/기억 ID 재현)
 * Definition은 코드/데이터에서 오므로 Snapshot에 넣지 않는다.
 */

import type { WorldEvent } from '../core/events.js';
import type { CharacterInstance } from '../core/instance.js';
import type { World } from '../core/world.js';

export const SNAPSHOT_VERSION = 1;

export interface Snapshot {
  readonly version: number;
  readonly tick: number;
  readonly rngState: number;
  readonly idCounter: number;
  readonly instances: readonly CharacterInstance[];
  readonly events: readonly WorldEvent[];
}

export function takeSnapshot(world: World): Snapshot {
  return {
    version: SNAPSHOT_VERSION,
    tick: world.tick,
    rngState: world.rng.serialize(),
    idCounter: world.ids.peek(),
    instances: world.allInstances(),
    events: world.events.all(),
  };
}

export function assertSnapshotVersion(snapshot: Snapshot): void {
  if (snapshot.version !== SNAPSHOT_VERSION) {
    throw new Error(
      `Snapshot 버전 불일치: 파일=${snapshot.version}, 코드=${SNAPSHOT_VERSION}`,
    );
  }
}
