/**
 * Master 전략 모음 — 사람이 누르는 버튼을 코드로 바꾼 것.
 *
 * 이게 있는 이유: **문 선택이 실제 결정인지 판정**하려면 서로 다른 선택을 하는
 * 여러 Master를 같은 탑에 넣어보는 수밖에 없다. 전략마다 결과가 같으면 선택은 장식이다.
 *
 * 전략은 의도적으로 단순하게 둔다. 사람이 실제로 할 법한 수준의 판단만 한다 —
 * 최적해를 찾는 AI를 만들면 "사람이 고민할 여지가 있는가"를 알 수 없게 된다.
 */

import type { CharacterInstance } from '../core/instance.js';
import type { Allocation, GateContext, GateKey, GateStrategy } from './gates.js';

/** 가장 다친 사람 */
function weakest(living: readonly CharacterInstance[]): CharacterInstance | undefined {
  return [...living].sort(
    (a, b) => a.needs.health / a.needs.maxHealth - b.needs.health / b.needs.maxHealth,
  )[0];
}

/** 가장 겁에 질린 사람 */
function mostAfraid(living: readonly CharacterInstance[]): CharacterInstance | undefined {
  return [...living].sort((a, b) => b.emotion.fear - a.emotion.fear)[0];
}

/** 가장 멀쩡한 사람 */
function healthiest(living: readonly CharacterInstance[]): CharacterInstance | undefined {
  return [...living].sort(
    (a, b) => b.needs.health / b.needs.maxHealth - a.needs.health / a.needs.maxHealth,
  )[0];
}

/**
 * 교란기를 줄 사람.
 *
 * **목표를 가진 사람에게 줘야 한다.** 교란기는 L2 계획에만 들어가고, L2는 기억에서
 * 파생된 목표가 있는 캐릭터에게만 실행된다. 목표 없는 사람에게 주면 그냥 버리는 것이다.
 * (처음에는 '가장 멀쩡한 사람'에게 줬는데, 테스트가 연막이 한 번도 안 쓰인다고 잡아냈다)
 *
 * 목표 보유자 중에서는 멀쩡한 쪽을 고른다 — 어차피 들어갈 사람이면 버틸 수 있는 쪽이 낫다.
 */
function suppressorTarget(living: readonly CharacterInstance[]): CharacterInstance | undefined {
  const resolved = living.filter((c) => c.goals.some((g) => g.kind === 'never_abandon_ally'));
  return healthiest(resolved);
}

/** 한 문만 계속 고르는 전략 — 대조군 */
function fixed(key: GateKey, name: string): GateStrategy {
  return {
    name,
    chooseGate: () => key,
    allocate: () => ({}),
  };
}

export const ALIGNED_ONLY = fixed('aligned', '정렬문만');
export const WARPED_ONLY = fixed('warped', '뒤틀린문만');
export const DEEP_ONLY = fixed('deep', '심층문만');

/**
 * 위험할 때만 안전한 문을 고르고, 여유가 있으면 보급을 챙긴다.
 * 사람이 처음 플레이할 때 할 법한 판단.
 */
export const ADAPTIVE: GateStrategy = {
  name: '적응형',

  chooseGate(ctx: GateContext): GateKey {
    const worstRatio = Math.min(
      ...ctx.living.map((c) => c.needs.health / c.needs.maxHealth),
    );

    // 위태로우면 위험을 낮춘다 — 위상압을 내주더라도
    if (worstRatio < 0.45) return 'warped';
    // 잔상이 있으면 회수한다. 보급 한 개가 한 사람을 살린다
    if (ctx.echo) return 'warped';
    // 교란기가 없고 아직 초반이면 보급을 챙긴다
    if (ctx.supplies.suppressor === 0 && ctx.depth <= 7) return 'deep';
    // 그 외에는 위상압을 아낀다
    return 'aligned';
  },

  allocate(ctx: GateContext): Allocation {
    const allocation: { -readonly [K in keyof Allocation]: Allocation[K] } = {};

    // 교란기는 목표를 가진 사람에게 — 그만이 계획에 연막을 넣을 수 있다
    if (ctx.supplies.suppressor > 0 && ctx.baseThreat >= 45) {
      allocation.suppressorTo = suppressorTarget(ctx.living)?.instanceId;
    }
    // 안정제는 퇴각선에 걸릴 사람에게
    const hurt = weakest(ctx.living);
    if (ctx.supplies.stabilizer > 0 && hurt && hurt.needs.health / hurt.needs.maxHealth < 0.4) {
      allocation.stabilizerTo = hurt.instanceId;
    }
    // 억제제는 후반에 가장 겁에 질린 사람에게 (피로를 감수한다)
    const afraid = mostAfraid(ctx.living);
    if (ctx.supplies.sedative > 0 && ctx.depth >= 7 && afraid && afraid.emotion.fear >= 55) {
      allocation.sedativeTo = afraid.instanceId;
    }

    return allocation;
  },
};

/**
 * 위상압을 무시하고 계속 안전한 문만 고르면서 보급도 다 쓰는 전략.
 * "편한 길만 골라도 되는가"를 검사하는 대조군이다 — 이게 최고 성적이면 설계가 틀렸다.
 */
export const GREEDY_SAFE: GateStrategy = {
  name: '안전탐욕',

  chooseGate: () => 'warped',

  allocate(ctx: GateContext): Allocation {
    const allocation: { -readonly [K in keyof Allocation]: Allocation[K] } = {};
    if (ctx.supplies.suppressor > 0) allocation.suppressorTo = suppressorTarget(ctx.living)?.instanceId;
    const hurt = weakest(ctx.living);
    if (ctx.supplies.stabilizer > 0 && hurt) allocation.stabilizerTo = hurt.instanceId;
    const afraid = mostAfraid(ctx.living);
    if (ctx.supplies.sedative > 0 && afraid && afraid.emotion.fear >= 40) {
      allocation.sedativeTo = afraid.instanceId;
    }
    return allocation;
  },
};

/** 보급을 아예 쓰지 않는 전략 — 보급이 결과에 영향을 주는지 보는 대조군 */
export const NO_SUPPLIES: GateStrategy = {
  name: '보급미사용',
  chooseGate: ADAPTIVE.chooseGate,
  allocate: () => ({}),
};

export const ALL_STRATEGIES: readonly GateStrategy[] = [
  ADAPTIVE,
  GREEDY_SAFE,
  NO_SUPPLIES,
  ALIGNED_ONLY,
  WARPED_ONLY,
  DEEP_ONLY,
];
