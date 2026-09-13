/**
 * 캠페인 — 여러 번의 등반과 그 사이의 캠프.
 *
 * 이 모듈이 있는 이유는 측정 결과다.
 *
 * 한 번의 등반만 돌리면 **L2 계획이 단 한 번도 실행되지 않는다** (80회 등반 전부 0).
 * 이유는 두 창이 겹치지 않기 때문이다:
 *
 *   - 목표(`never_abandon_ally`)는 동료를 방치했을 때 생긴다. 방치는 파티가 구조할 힘이
 *     없을 때 일어나므로 거의 항상 **마지막 좌표**다 — 목표가 생기자마자 등반이 끝난다
 *   - 계획에는 stamina가 필요하다(구조 30 + 연막 20). stamina는 체력에서 피로를 뺀 값이고
 *     피로는 회복되지 않으므로 **등반 전반부만** 계획이 가능하다
 *
 * 생존자를 다음 등반에 데려가도 피로가 그대로면 여전히 0이다. 캠프에서 회복시키면
 * 2회차부터 좌표당 평균 2.7개에서 L2가 실행된다 (0 → 120).
 *
 * 즉 **"생존자를 다시 데려가고 쉬게 한다"가 기억→목표→판단 경로를 여는 스위치다.**
 * 그게 없으면 게임의 핵심 명제가 코드상 한 번도 실행되지 않는다.
 *
 * GDD의 차별화 문장과도 같은 방향이다 —
 * "AI NPC와 대화하는 게임이 아니라 과거의 나와 연결된 캐릭터가 다음 행동을 결정하는 게임".
 */

import type { InstanceId } from '../core/ids.js';
import type { CharacterInstance } from '../core/instance.js';
import type { MasterOrder } from '../core/order.js';
import { runTransaction } from '../core/transaction.js';
import type { World } from '../core/world.js';
import { SCOUT, VANGUARD } from '../data/definitions.js';
import { summon } from '../scenario/coreGameplay.js';
import {
  DEFAULT_SUPPLIES,
  FormPartyTransaction,
  runGateTower,
  type Echo,
  type GateRunResult,
  type GateStrategy,
  type Supplies,
} from './gates.js';

export interface CampSettings {
  /** 파티 정원 */
  readonly partySize: number;
  /** 캠프에서 회복되는 피로 비율. 1이면 완전 회복 */
  readonly fatigueRecovered: number;
  /** 캠프에서 회복되는 체력 비율 (최대 체력 기준) */
  readonly healthRecovered: number;
  /** 캠프에서 가라앉는 공포 */
  readonly fearRecovered: number;
}

export const CAMP: CampSettings = {
  /** 파티 정원 */
  partySize: 4,
  /**
   * 캠프에서 회복되는 피로 비율. 1이면 완전 회복.
   *
   * 이 값이 0이면 L2가 영구히 실행되지 않는다 — 측정으로 확인된 사실이다.
   * 동시에 1로 두면 피로가 등반 내부의 압박으로만 작동하고 캠페인 전체의 압박은 사라진다.
   * 이 값이 **"지친 베테랑을 쉬게 할 것인가, 새 사람을 넣을 것인가"의 저울**이다.
   */
  fatigueRecovered: 1,
  /** 캠프에서 회복되는 체력 비율 (최대 체력 기준) */
  healthRecovered: 1,
  /** 캠프에서 가라앉는 공포 */
  fearRecovered: 20,
};

export interface CampaignInput {
  readonly world: World;
  readonly order: MasterOrder;
  readonly strategy: GateStrategy;
  readonly attempts: number;
  /** 회차마다 보급을 이 값으로 되돌린다. 생략하면 기본값 */
  readonly suppliesPerAttempt?: Supplies;
  readonly camp?: Partial<CampSettings>;
}

export interface AttemptSummary {
  readonly attempt: number;
  /** 이 등반을 시작할 때 목표를 가진 인원 */
  readonly veteransWithGoal: number;
  /** 이 등반을 시작할 때의 생존 베테랑 수 (보충 전) */
  readonly returning: number;
  readonly result: GateRunResult;
  /** L2 계획이 실행된 좌표 수 — 기억이 판단을 바꾼 횟수 */
  readonly planningDepths: number;
  /** 연막이 계획에 들어간 좌표 수 */
  readonly suppressedDepths: number;
}

export interface CampaignResult {
  readonly attempts: readonly AttemptSummary[];
  readonly bestDepth: number;
  readonly clears: number;
  readonly totalDeaths: number;
  /** 마지막까지 살아남은 사람들 */
  readonly finalRoster: readonly InstanceId[];
  readonly echoes: readonly Echo[];
}

export function runCampaign(input: CampaignInput): CampaignResult {
  const { world, order, strategy, attempts } = input;
  const camp = { ...CAMP, ...input.camp };

  let roster: CharacterInstance[] = [];
  let echoes: readonly Echo[] = [];
  const summaries: AttemptSummary[] = [];
  let totalDeaths = 0;
  let clears = 0;
  let bestDepth = 0;

  for (let attempt = 1; attempt <= attempts; attempt += 1) {
    roster = roster.filter((c) => c.status === 'alive');
    const returning = roster.length;

    /* 캠프 — 회복은 몸에만 일어난다. 기억과 목표는 남는다 */
    for (const member of roster) {
      member.needs.fatigue = Math.max(
        0,
        Math.round(member.needs.fatigue * (1 - camp.fatigueRecovered)),
      );
      member.needs.health = Math.min(
        member.needs.maxHealth,
        member.needs.health + Math.round(member.needs.maxHealth * camp.healthRecovered),
      );
      member.emotion.fear = Math.max(0, member.emotion.fear - camp.fearRecovered);
    }

    /* 빈 자리를 새 사람으로 채운다. 죽은 사람은 돌아오지 않는다 (규칙 7) */
    while (roster.length < camp.partySize) {
      const definition = roster.length % 2 === 0 ? VANGUARD : SCOUT;
      roster.push(summon(world, definition.definitionId));
    }

    const veteransWithGoal = roster.filter((c) => c.goals.length > 0).length;

    const formed = runTransaction(world, FormPartyTransaction, {
      members: roster.map((c) => c.instanceId),
      baseTrust: 50,
    });
    if (!formed.ok) throw new Error(formed.error);

    const result = runGateTower({
      world,
      party: roster.map((c) => c.instanceId),
      order,
      strategy,
      echoes,
      startingSupplies: { ...(input.suppliesPerAttempt ?? DEFAULT_SUPPLIES) },
    });

    // 회수된 잔상은 목록에서 지운다. 이걸 안 하면 같은 좌표를 매 회차 반복 수확할 수 있다
    echoes = [
      ...echoes.filter((e) => !result.consumedEchoes.includes(e)),
      ...result.newEchoes,
    ];
    totalDeaths += result.deaths.length;
    if (result.cleared) clears += 1;
    bestDepth = Math.max(bestDepth, result.deepestDepth);

    summaries.push({
      attempt,
      veteransWithGoal,
      returning,
      result,
      planningDepths: result.floors.filter((f) =>
        f.decisions.some((d) => d.decision.reason.layer === 'L2'),
      ).length,
      suppressedDepths: result.floors.filter((f) =>
        f.decisions.some((d) => d.decision.plan?.steps.includes('SUPPRESS')),
      ).length,
    });
  }

  return {
    attempts: summaries,
    bestDepth,
    clears,
    totalDeaths,
    finalRoster: roster.filter((c) => c.status === 'alive').map((c) => c.instanceId),
    echoes,
  };
}
