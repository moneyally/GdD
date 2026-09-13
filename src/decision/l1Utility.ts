/**
 * L1 — 유틸리티 계층.
 *
 * L0에서 결정되지 않은 경우 각 행동의 효용을 계산하고 최고점을 고른다.
 *
 * 가중치는 전부 이 파일 상단에 모아둔다. 밸런스 조정이 코드 수정이 아니라
 * 숫자 한 곳 수정이 되게 하는 것이 목적이다.
 *
 * ReasonCode에 싣는 수치는 효용 점수가 아니라 **입력 값**이다.
 * 플레이어에게 "rescue=62.4" 같은 점수를 보여주는 건 의미가 없고,
 * "trust=80, fear=20, self_risk=70이라서 구하러 갔다"가 의미 있다.
 */

import type { AgentState } from '../core/agentState.js';
import { riskAppetite } from '../core/order.js';
import type { Action, Factor, ReasonCode } from './reason.js';

export const WEIGHTS = {
  rescue: {
    trust: 0.9,
    calm: 0.6, // (100 - fear)
    selfRisk: -0.8,
    loyaltyAboveMid: 0.3,
    riskAboveMid: 0.2,
    /** 기억 태그별 가산. '기억이 판단을 바꾼다'의 L1 경로 */
    memory: {
      rescued_ally: 0.2,
      wounded_in_rescue: -0.25,
      witnessed_ally_death: 0.1,
      ally_died_unrescued: 0.5,
    },
  },
  retreat: {
    fear: 0.9,
    selfRisk: 0.7,
    trust: -0.5,
    loyaltyAboveMid: -0.3,
    memory: {
      wounded_in_rescue: 0.3,
      ally_died_unrescued: -0.3,
      rescued_ally: 0,
      witnessed_ally_death: 0,
    },
  },
  hold: {
    base: 40,
    loyaltyAboveMid: 0.2,
    fear: -0.2,
  },
  attack: {
    aggression: 0.7,
    calm: 0.4,
    selfRisk: -0.6,
  },
} as const;

export interface UtilityScore {
  readonly action: Action;
  readonly score: number;
}

export interface L1Result {
  readonly reason: ReasonCode;
  /** 디버거용 전체 점수. 플레이어 로그에는 쓰지 않는다 */
  readonly scores: readonly UtilityScore[];
}

export function scoreActions(state: AgentState): UtilityScore[] {
  const appetite = riskAppetite(state.order.riskPolicy);
  const loyaltyAboveMid = state.personality.loyalty - 50;
  const riskAboveMid = state.personality.risk - 50;
  const calm = 100 - state.fear;

  const rescue =
    WEIGHTS.rescue.trust * state.trustInSubject +
    WEIGHTS.rescue.calm * calm +
    WEIGHTS.rescue.selfRisk * state.selfRisk +
    WEIGHTS.rescue.loyaltyAboveMid * loyaltyAboveMid +
    WEIGHTS.rescue.riskAboveMid * riskAboveMid +
    appetite +
    memoryBonus(state, WEIGHTS.rescue.memory);

  const retreat =
    WEIGHTS.retreat.fear * state.fear +
    WEIGHTS.retreat.selfRisk * state.selfRisk +
    WEIGHTS.retreat.trust * state.trustInSubject +
    WEIGHTS.retreat.loyaltyAboveMid * loyaltyAboveMid -
    appetite +
    memoryBonus(state, WEIGHTS.retreat.memory);

  const hold =
    WEIGHTS.hold.base +
    WEIGHTS.hold.loyaltyAboveMid * loyaltyAboveMid +
    WEIGHTS.hold.fear * state.fear;

  const attack =
    WEIGHTS.attack.aggression * state.personality.aggression +
    WEIGHTS.attack.calm * calm +
    WEIGHTS.attack.selfRisk * state.selfRisk +
    appetite;

  return [
    { action: 'RESCUE', score: rescue },
    { action: 'RETREAT', score: retreat },
    { action: 'HOLD', score: hold },
    { action: 'ATTACK', score: attack },
  ];
}

export function applyL1(state: AgentState): L1Result {
  const scores = scoreActions(state);
  // 동점이면 배열 순서(RESCUE > RETREAT > HOLD > ATTACK)로 결정 — 결정론 유지
  const best = scores.reduce((a, b) => (b.score > a.score ? b : a));

  return {
    reason: {
      action: best.action,
      layer: 'L1',
      factors: factorsFor(best.action, state),
    },
    scores,
  };
}

/** 선택된 행동을 설명하는 입력 값만 고른다. 관련 없는 수치를 나열하지 않는다. */
function factorsFor(action: Action, state: AgentState): Factor[] {
  const subject: Factor[] = state.subject ? [{ key: 'target', value: state.subject }] : [];
  const memory = dominantMemory(state, action);

  switch (action) {
    case 'RESCUE':
      return [
        ...subject,
        { key: 'trust', value: round(state.trustInSubject) },
        { key: 'fear', value: round(state.fear) },
        { key: 'self_risk', value: round(state.selfRisk) },
        ...memory,
      ];
    case 'RETREAT':
      return [
        { key: 'fear', value: round(state.fear) },
        { key: 'self_risk', value: round(state.selfRisk) },
        { key: 'trust', value: round(state.trustInSubject) },
        ...memory,
      ];
    case 'HOLD':
      return [
        { key: 'order', value: state.order.goal },
        { key: 'loyalty', value: state.personality.loyalty },
        { key: 'fear', value: round(state.fear) },
      ];
    case 'ATTACK':
      return [
        { key: 'aggression', value: state.personality.aggression },
        { key: 'self_risk', value: round(state.selfRisk) },
      ];
  }
}

/** 이 행동에 실제로 영향을 준 기억 중 가장 강한 것 하나만 ReasonCode에 싣는다. */
function dominantMemory(state: AgentState, action: Action): Factor[] {
  const table =
    action === 'RESCUE'
      ? WEIGHTS.rescue.memory
      : action === 'RETREAT'
        ? WEIGHTS.retreat.memory
        : undefined;
  if (!table) return [];

  let best: { tag: string; effect: number } | undefined;
  for (const influence of state.memoryInfluences) {
    const weight = table[influence.tag] ?? 0;
    const effect = weight * influence.importance;
    if (effect !== 0 && (!best || Math.abs(effect) > Math.abs(best.effect))) {
      best = { tag: influence.tag, effect };
    }
  }
  return best ? [{ key: 'memory', value: best.tag }] : [];
}

function memoryBonus(
  state: AgentState,
  table: Readonly<Record<string, number>>,
): number {
  let total = 0;
  for (const influence of state.memoryInfluences) {
    total += (table[influence.tag] ?? 0) * influence.importance;
  }
  return total;
}

function round(n: number): number {
  return Math.round(n);
}
