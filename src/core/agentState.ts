/**
 * AgentState — 4단 분리 3층.
 *
 * 판단에만 쓰이는 현재 상태. Instance에서 파생되며 저장되지 않는다.
 * 판단 함수는 Instance를 직접 읽지 않고 이 타입만 받는다. 이유는 두 가지다:
 *
 * 1. 판단 입력이 명시적으로 고정되므로 ReasonCode가 거짓말을 할 수 없다.
 *    (ReasonCode에 실린 수치는 전부 AgentState에 있는 값이다)
 * 2. 나중에 "캐릭터가 세계를 잘못 인식한다"(불신뢰 보고)를 넣을 때
 *    Instance는 진실, AgentState는 인식으로 갈라지는 자리가 이미 준비된다.
 */

import type { CharacterInstance, Goal, MemoryTag, Personality } from './instance.js';
import { trustToward } from './instance.js';
import type { InstanceId } from './ids.js';
import type { Situation } from '../decision/situation.js';
import type { MasterOrder } from './order.js';

/** 판단에 쓰이는 기억 요약. 태그별 최대 importance만 남긴다. */
export interface MemoryInfluence {
  readonly tag: MemoryTag;
  readonly importance: number;
  readonly memoryId: string;
}

export interface AgentState {
  readonly self: InstanceId;
  readonly personality: Personality;
  /** 현재 체력 비율 0..1 */
  readonly healthRatio: number;
  readonly fear: number;
  /** 상황의 대상(쓰러진 동료)에 대한 신뢰 */
  readonly trustInSubject: number;
  readonly subject?: InstanceId;
  /** 이 상황에서 자신이 감수할 위험 0..100 */
  readonly selfRisk: number;
  /**
   * 행동 여력 0..100. 체력에서 피로를 뺀 값.
   * L2 계획의 자원이다 — 이게 바닥나면 연막도 구조도 계획에 넣을 수 없다.
   * 10층을 오르는 동안 누적되는 피로가 후반 층의 판단을 바꾸는 경로가 여기다.
   */
  readonly stamina: number;
  /**
   * 위상 교란기(연막)를 들고 있는가. L2가 SUPPRESS를 계획에 넣을 수 있는지 결정한다.
   *
   * 기본값은 true다 — MVP 판단 엔진은 교란기를 무한 자원으로 가정했고, 그 가정 위에서
   * 골든 대조와 C# 포팅이 검증됐다. 차원문 등반(mission/gates.ts)은 유한 자원이므로
   * 소지자에게만 true를 넘긴다.
   *
   * 차원문이 주 경로가 되면 이 기본값을 false로 뒤집고 골든과 C# 포팅을 함께 재생성해야 한다.
   */
  readonly hasSuppressor: boolean;
  readonly memoryInfluences: readonly MemoryInfluence[];
  readonly goals: readonly Goal[];
  readonly order: MasterOrder;
  readonly tick: number;
}

/**
 * Instance + 상황 + 명령 → AgentState.
 *
 * selfRisk는 상황의 위협도에 자기 상태를 반영해 계산한다. 부상 중이면 같은 적도 더 위험하다.
 * 이 한 줄이 "행동 후 State가 변했으므로 다음 판단이 달라진다"의 핵심 경로다.
 */
export interface AgentStateOptions {
  /** 교란기 소지 여부. 생략하면 무한 자원으로 취급한다 (기존 동작) */
  readonly hasSuppressor?: boolean;
}

export function buildAgentState(
  self: CharacterInstance,
  situation: Situation,
  order: MasterOrder,
  options?: AgentStateOptions,
): AgentState {
  const healthRatio = self.needs.health / self.needs.maxHealth;
  const injuryMultiplier = 1 + (1 - healthRatio) * 0.6;
  const selfRisk = clamp(situation.enemyThreat * injuryMultiplier, 0, 100);

  return {
    self: self.instanceId,
    personality: self.personality,
    healthRatio,
    fear: self.emotion.fear,
    subject: situation.subject,
    trustInSubject: situation.subject ? trustToward(self, situation.subject) : 0,
    selfRisk,
    stamina: clamp(healthRatio * 100 - self.needs.fatigue, 0, 100),
    hasSuppressor: options?.hasSuppressor ?? true,
    memoryInfluences: summarizeMemory(self),
    // 복사한다. Instance의 배열을 그대로 들고 있으면 행동 이후의 변화가
    // '판단 시점 State'에 비쳐서 디버거가 거짓 근거를 보여준다.
    goals: [...self.goals],
    order,
    tick: situation.tick,
  };
}

/** 같은 태그의 기억이 여러 개면 가장 중요한 것만 판단에 올린다. */
function summarizeMemory(self: CharacterInstance): MemoryInfluence[] {
  const strongest = new Map<MemoryTag, MemoryInfluence>();
  for (const entry of self.memory) {
    const current = strongest.get(entry.tag);
    if (!current || entry.importance > current.importance) {
      strongest.set(entry.tag, {
        tag: entry.tag,
        importance: entry.importance,
        memoryId: entry.memoryId,
      });
    }
  }
  return [...strongest.values()].sort((a, b) => b.importance - a.importance);
}

export function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value));
}
