/**
 * 탑 10층 미션 (브리핑 3절 MVP 범위, 5절 다음 항목).
 *
 * 게임 정의의 한 문장이 "탑은 이전 등반자들의 실패를 기억한다"이므로, 탑은 단순한
 * 스테이지 묶음이 아니라 **기록의 장소**다. 이 파일은 그 기록이 쌓이는 구조까지만 만든다:
 * 층 도달은 WorldDiscovery로 남고, 같은 층을 다시 오르면 다시 발견되지 않는다.
 * 기록을 읽어서 다음 등반에 쓰는 것(History)은 다음 단계다.
 *
 * 층마다 벌어지는 일:
 *   위협도 상승 → 한 명이 쓰러짐 → 나머지가 각자 판단 → 결과 적용 → 피로 누적
 *
 * 한 명이라도 구하러 가면 쓰러진 동료는 살고, 아무도 안 가면 죽는다.
 * 파티가 두 명 미만이 되면 등반을 중단한다 — 쓰러질 사람과 판단할 사람이 둘 다 필요하다.
 */

import { buildAgentState } from '../core/agentState.js';
import type { InstanceId } from '../core/ids.js';
import type { CharacterInstance } from '../core/instance.js';
import type { MasterOrder } from '../core/order.js';
import { runTransaction, type Transaction } from '../core/transaction.js';
import type { World } from '../core/world.js';
import { decide, type Decision } from '../decision/decide.js';
import { allyDown } from '../decision/situation.js';
import { ResolveTransaction, type ActorDecision } from '../sim/resolve.js';

export const TOWER = {
  floors: 10,
  /** 1층 25 → 10층 70. 후반 층은 계획 없이 감당할 수 없다 */
  threatAt: (floor: number): number => 20 + floor * 5,
  /** 층 사이에 숨을 돌린다 — 공포가 조금 가라앉는다 */
  restFearDecay: 4,
  /**
   * 층 사이 체력 회복 (최대 체력 비율).
   *
   * 회복이 전혀 없으면 체력이 단조 감소만 하므로 누적 피해가 총 체력을 넘는 층에서
   * 등반이 반드시 멈춘다 — 실제로 200회 전부 8층 이상을 못 갔다. 10층이 존재하지만
   * 아무도 볼 수 없는 상태였다.
   *
   * 그래서 회복은 체력으로 주고 한계는 **피로**로 준다. 피로는 회복되지 않고
   * stamina를 깎으므로, 후반 층에서는 연막도 구조도 계획에 넣을 여력이 사라진다.
   * 즉 정상에 가려면 누군가를 버려야 한다 — 회복을 넣어도 상실의 무게는 남는다.
   */
  restHealRatio: 0.12,
  /** 등반을 계속하려면 최소 인원 */
  minPartyToContinue: 2,
} as const;

export interface FloorDecisionLog {
  readonly actor: CharacterInstance;
  readonly decision: Decision;
  readonly damage: number;
}

export interface FloorLog {
  readonly floor: number;
  readonly threat: number;
  readonly fallen: CharacterInstance;
  readonly decisions: readonly FloorDecisionLog[];
  readonly rescued: boolean;
  readonly died: readonly InstanceId[];
  /** 이 세계에서 처음 도달한 층인가 */
  readonly firstVisit: boolean;
}

export type AbortReason = 'party_wiped' | 'too_few_to_continue' | 'party_spent';

export interface MissionResult {
  readonly deepestFloor: number;
  readonly cleared: boolean;
  readonly floors: readonly FloorLog[];
  readonly deaths: readonly InstanceId[];
  readonly survivors: readonly InstanceId[];
  readonly abortReason?: AbortReason;
}

/* ------------------------------------------------------------------ *
 * 파티 편성 — 서로를 동료로 인식하는 상태를 만든다
 * ------------------------------------------------------------------ */

export interface FormPartyRequest {
  readonly members: readonly InstanceId[];
  /** 편성 시점의 상호 신뢰. 처음 만난 동료라는 뜻의 중립값 */
  readonly baseTrust: number;
}

/**
 * 파티 편성도 관계 변화이므로 트랜잭션을 거치고 Event로 남는다 (규칙 3, 4).
 * 이게 없으면 서로 신뢰 0인 채로 탑에 들어가 1층부터 동료를 버린다.
 */
export const FormPartyTransaction: Transaction<FormPartyRequest, void> = {
  name: 'FormParty',

  validate(world, request): string | undefined {
    if (request.members.length < TOWER.minPartyToContinue) {
      return `파티는 최소 ${TOWER.minPartyToContinue}명이다`;
    }
    for (const id of request.members) {
      const member = world.find(id);
      if (!member) return `알 수 없는 Instance: ${id}`;
      if (member.status !== 'alive') return `죽은 캐릭터는 편성할 수 없다: ${id}`;
    }
    return undefined;
  },

  apply(world, request): void {
    for (const id of request.members) {
      const member = world.instance(id);
      for (const other of request.members) {
        if (other === id) continue;
        if (member.relationships.some((r) => r.target === other)) continue;
        member.relationships.push({ target: other, trust: request.baseTrust });
        world.events.append({
          kind: 'RelationshipChange',
          tick: world.tick,
          from: id,
          to: other,
          trustBefore: 0,
          trustAfter: request.baseTrust,
          cause: 'party_formed',
        });
      }
    }
  },
};

/* ------------------------------------------------------------------ *
 * 층 도달 — 탑의 기록
 * ------------------------------------------------------------------ */

export const floorKey = (floor: number): string => `tower_floor_${floor}`;

export interface ReachFloorRequest {
  readonly floor: number;
  readonly by: InstanceId;
}

/**
 * 처음 도달한 층만 WorldDiscovery로 남는다.
 *
 * 이미 발견된 층인지는 **이벤트 로그를 읽어서** 판정한다. 별도의 진행도 필드를 두지 않는
 * 이유는, 탑의 기록이 곧 진실이어야 하기 때문이다 — 나중에 History가 이 로그를 읽는다.
 */
export const ReachFloorTransaction: Transaction<ReachFloorRequest, boolean> = {
  name: 'ReachFloor',

  validate(world, request): string | undefined {
    if (request.floor < 1 || request.floor > TOWER.floors) {
      return `탑에 없는 층: ${request.floor}`;
    }
    if (!world.find(request.by)) return `알 수 없는 Instance: ${request.by}`;
    return undefined;
  },

  apply(world, request): boolean {
    const known = world.events
      .ofKind('WorldDiscovery')
      .some((e) => e.what === floorKey(request.floor));
    if (known) return false;

    world.events.append({
      kind: 'WorldDiscovery',
      tick: world.tick,
      discoveredBy: request.by,
      what: floorKey(request.floor),
    });
    return true;
  },
};

/* ------------------------------------------------------------------ *
 * 등반
 * ------------------------------------------------------------------ */

export function runTower(
  world: World,
  party: readonly InstanceId[],
  order: MasterOrder,
): MissionResult {
  const floors: FloorLog[] = [];
  const deaths: InstanceId[] = [];
  let deepestFloor = 0;
  let abortReason: AbortReason | undefined;

  for (let floor = 1; floor <= TOWER.floors; floor += 1) {
    const living = party.map((id) => world.instance(id)).filter((c) => c.status === 'alive');

    if (living.length === 0) {
      abortReason = 'party_wiped';
      break;
    }
    if (living.length < TOWER.minPartyToContinue) {
      abortReason = 'too_few_to_continue';
      break;
    }
    // Master가 지정한 퇴각선 아래로 전원이 떨어지면 더 오르지 않는다.
    // 이게 없으면 체력 12%인 파티가 계속 등반한다 — 퇴각 조건이 조우 판단에만
    // 걸려 있고 등반 계속 여부에는 걸리지 않았던 결함.
    const line = order.retreatCondition.healthRatioBelow;
    if (line > 0 && living.every((c) => c.needs.health / c.needs.maxHealth < line)) {
      abortReason = 'party_spent';
      break;
    }

    world.advanceTick();
    deepestFloor = floor;

    const arrival = runTransaction(world, ReachFloorTransaction, {
      floor,
      by: living[0]!.instanceId,
    });
    if (!arrival.ok) throw new Error(arrival.error);

    const log = runFloor(world, living, floor, order, arrival.value);
    floors.push(log);
    deaths.push(...log.died);

    rest(world, party);
  }

  const survivors = party.filter((id) => world.instance(id).status === 'alive');

  return {
    deepestFloor,
    cleared: deepestFloor === TOWER.floors && abortReason === undefined,
    floors,
    deaths,
    survivors,
    ...(abortReason ? { abortReason } : {}),
  };
}

function runFloor(
  world: World,
  living: readonly CharacterInstance[],
  floor: number,
  order: MasterOrder,
  firstVisit: boolean,
): FloorLog {
  const threat = TOWER.threatAt(floor);
  // 누가 쓰러지는지는 난수로 정한다. 시드 기반이므로 재현된다
  const fallen = world.rng.pick(living);
  const others = living.filter((c) => c.instanceId !== fallen.instanceId);
  const situation = allyDown(fallen.instanceId, threat, world.tick);

  const decisions: ActorDecision[] = [];
  const states = new Map<InstanceId, Decision>();
  for (const actor of others) {
    const decision = decide(buildAgentState(actor, situation, order));
    states.set(actor.instanceId, decision);
    decisions.push({
      actor: actor.instanceId,
      action: decision.reason.action,
      plan: decision.plan?.steps,
    });
  }

  const result = runTransaction(world, ResolveTransaction, { situation, decisions });
  if (!result.ok) throw new Error(result.error);

  return {
    floor,
    threat,
    fallen,
    decisions: others.map((actor) => ({
      actor,
      decision: states.get(actor.instanceId)!,
      damage: result.value.damageByActor.get(actor.instanceId) ?? 0,
    })),
    rescued: result.value.rescued,
    died: result.value.died,
    firstVisit,
  };
}

/**
 * 층 사이 휴식.
 *
 * 체력과 공포는 조금 회복되고 **피로는 그대로 남는다.** 이 비대칭이 후반 층을
 * 어렵게 만드는 유일한 장치다. 여기서 fatigue를 줄이면 탑이 평평해진다.
 */
function rest(world: World, party: readonly InstanceId[]): void {
  for (const id of party) {
    const member = world.instance(id);
    if (member.status !== 'alive') continue;
    const heal = Math.round(member.needs.maxHealth * TOWER.restHealRatio);
    member.needs.health = Math.min(member.needs.maxHealth, member.needs.health + heal);
    member.emotion.fear = Math.max(0, member.emotion.fear - TOWER.restFearDecay);
  }
}
