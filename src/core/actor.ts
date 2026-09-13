/**
 * Actor — 4단 분리 4층.
 *
 * 현재 월드에 렌더링되는 실체. MVP에는 렌더러가 없으므로 타입만 존재한다.
 *
 * 이 파일이 지금 비어 있는 것처럼 보이는 게 정상이다. 목적은 경계를 미리 긋는 것이다:
 *
 * - Actor는 Instance를 참조하지만 Instance를 수정하지 않는다
 * - 판단 로직은 Actor 쪽에 존재할 수 없다 (브리핑 3절 추가규칙:
 *   "클라이언트는 Event와 Snapshot만 읽는다. 판단 로직은 뷰/렌더 코드에 두지 않는다")
 * - 따라서 2D → 3D 전환은 이 층을 교체하는 작업이 되고, 나머지는 건드리지 않는다
 *
 * 이 규칙을 깨는 가장 쉬운 방법은 Actor가 Instance를 직접 mutate하는 것이다.
 * 그래서 아래 타입은 Instance 전체가 아니라 읽기 전용 표시 정보만 들고 있다.
 */

import type { InstanceId } from './ids.js';
import type { LifeStatus } from './instance.js';

/** 렌더러에 넘기는 읽기 전용 표시 상태. 판단 입력으로 쓰지 않는다. */
export interface ActorView {
  readonly instanceId: InstanceId;
  readonly displayName: string;
  readonly status: LifeStatus;
  readonly healthRatio: number;
}

/**
 * 렌더러가 구현할 인터페이스. MVP에서는 텍스트 로그가 이 역할을 한다.
 * 구현체는 Event와 ActorView만 입력으로 받는다.
 */
export interface Renderer {
  present(views: readonly ActorView[]): void;
}
