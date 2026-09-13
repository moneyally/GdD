/**
 * 트랜잭션 — CORE CONTRACT 규칙 4.
 *
 * "싱글플레이여도 Request → Validate → Apply → Event 형태의 함수를 통해서만
 *  소환/소비/획득이 일어난다. 상태 직접 변경 금지."
 *
 * MVP에는 서버도 DB도 없지만 시그니처는 지금 고정한다. 나중에 이 함수 본문이
 * 서버 핸들러로 이동하면 호출부는 바뀌지 않는다.
 *
 * 롤백: validate가 통과한 뒤 apply 중 예외가 나면 그 트랜잭션이 만든 이벤트는
 * 이미 append된 상태일 수 있다. append-only 로그에서 되돌리기는 불가능하므로
 * apply는 예외를 던지지 않게 작성한다 — 검증은 전부 validate에서 끝낸다.
 */

import type { WorldEvent } from './events.js';
import type { World } from './world.js';

export interface Transaction<Req, Res> {
  readonly name: string;
  /** 실패 이유를 문자열로 반환. 통과하면 undefined */
  validate(world: World, request: Req): string | undefined;
  /** 상태 변경과 이벤트 기록. validate 통과가 전제 */
  apply(world: World, request: Req): Res;
}

export type TransactionResult<Res> =
  | { readonly ok: true; readonly value: Res; readonly events: readonly WorldEvent[] }
  | { readonly ok: false; readonly error: string };

export function runTransaction<Req, Res>(
  world: World,
  transaction: Transaction<Req, Res>,
  request: Req,
): TransactionResult<Res> {
  const error = transaction.validate(world, request);
  if (error !== undefined) {
    return { ok: false, error: `${transaction.name}: ${error}` };
  }

  const before = world.events.length;
  const value = transaction.apply(world, request);
  const events = world.events.all().slice(before);

  return { ok: true, value, events };
}
