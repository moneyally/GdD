/**
 * 차원문 등반 — `docs/proposal/holo-gates.md`의 구현.
 *
 * 탑은 계단이 아니다. 매 좌표마다 문 세 개가 떠오르고 Master는 어디로 보낼지만 정한다.
 *
 * 선형 등반(`tower.ts`)을 고치지 않고 별 모듈로 둔 이유: 저쪽은 골든 대조와 C# 포팅이
 * 검증된 기준점이다. 차원문이 주 경로로 확정되면 그때 통합하고 양쪽을 함께 재생성한다.
 *
 * 이 파일이 답해야 하는 질문: **문 선택이 실제로 결과를 바꾸는가.**
 * 어떤 전략이든 결과가 같으면 선택은 장식이고, 게임이 아니다.
 * `npm run gates:stats`가 그걸 측정한다.
 */

import { buildAgentState } from '../core/agentState.js';
import type { InstanceId } from '../core/ids.js';
import type { CharacterInstance } from '../core/instance.js';
import type { MasterOrder } from '../core/order.js';
import { runTransaction } from '../core/transaction.js';
import type { World } from '../core/world.js';
import { decide, type Decision } from '../decision/decide.js';
import { allyDown } from '../decision/situation.js';
import { ResolveTransaction, type ActorDecision } from '../sim/resolve.js';
import { FormPartyTransaction, ReachFloorTransaction, TOWER, floorKey } from './tower.js';

/* ------------------------------------------------------------------ *
 * 문
 * ------------------------------------------------------------------ */

export type GateKey = 'aligned' | 'warped' | 'deep';

export interface GateSpec {
  readonly key: GateKey;
  readonly ko: string;
  /** 기준 위협에 더해지는 값 */
  readonly threat: number;
  /** 이 문을 통과할 때 추가로 오르는 위상압 */
  readonly extraPressure: number;
  /** 통과 비용으로 쌓이는 피로 */
  readonly fatigue: number;
  /** 보급을 확실히 얻는가 */
  readonly supply: boolean;
  /** 이전 등반자의 잔상을 회수할 수 있는가 */
  readonly recoversEcho: boolean;
}

export const GATES: Readonly<Record<GateKey, GateSpec>> = {
  aligned: {
    key: 'aligned', ko: '정렬문',
    threat: 0, extraPressure: 0, fatigue: 0, supply: false, recoversEcho: false,
  },
  warped: {
    key: 'warped', ko: '뒤틀린문',
    // 안전을 사면 탑이 조여온다 — 이 교환이 위상압의 존재 이유다
    threat: -15, extraPressure: 8, fatigue: 10, supply: false, recoversEcho: true,
  },
  deep: {
    key: 'deep', ko: '심층문',
    threat: 15, extraPressure: 0, fatigue: 0, supply: true, recoversEcho: false,
  },
};

export const GATE_KEYS: readonly GateKey[] = ['aligned', 'warped', 'deep'];

export const GATE_RULES = {
  /** 좌표마다 기본으로 오르는 위상압 */
  pressurePerDepth: 5,
  /** 위상압이 위협에 반영되는 비율 */
  threatFromPressure: 0.4,
  /** 잔상을 회수하면 전원의 공포가 내려간다 */
  echoRelief: 5,
  /** 잔상을 회수하지 않고 지나가면 전원의 공포가 오른다 */
  echoFear: 8,
  /** 보급 상한 */
  supplyCap: 4,
  /** 안정제 회복량 (최대 체력 비율) */
  healRatio: 0.3,
  /** 억제제: 공포 감소와 그 대가인 피로 */
  calmFear: 40,
  calmFatigue: 15,
} as const;

export type SupplyKind = 'suppressor' | 'stabilizer' | 'sedative';

export interface Supplies {
  suppressor: number;
  stabilizer: number;
  sedative: number;
}

/** 이 좌표에서 죽은 이전 등반자의 잔상 */
export interface Echo {
  readonly depth: number;
  readonly name: string;
  readonly grants: 'suppressor' | 'stabilizer';
}

/* ------------------------------------------------------------------ *
 * 전략 — Master의 행동을 코드로 표현한 것
 * ------------------------------------------------------------------ */

export interface GateContext {
  readonly depth: number;
  /** 문을 고르기 전에 보이는 기준 위협 (문 보정 이전) */
  readonly baseThreat: number;
  readonly pressure: number;
  readonly supplies: Readonly<Supplies>;
  readonly living: readonly CharacterInstance[];
  /** 이 좌표에 잔상이 있는가 */
  readonly echo: Echo | undefined;
  /** 이미 다녀온 좌표인가 — 위협이 정확히 보인다 */
  readonly known: boolean;
}

export interface Allocation {
  /** 교란기를 줄 대상 */
  readonly suppressorTo?: InstanceId;
  /** 안정제를 쓸 대상 */
  readonly stabilizerTo?: InstanceId;
  /** 억제제를 쓸 대상 */
  readonly sedativeTo?: InstanceId;
}

/**
 * Master 전략. 사람이 누르는 버튼을 코드로 바꾼 것이다.
 * 밸런스 측정은 전략을 바꿔가며 결과를 비교하는 방식으로 한다.
 */
export interface GateStrategy {
  readonly name: string;
  chooseGate(ctx: GateContext): GateKey;
  allocate(ctx: GateContext): Allocation;
}

/* ------------------------------------------------------------------ *
 * 등반
 * ------------------------------------------------------------------ */

export interface GateFloorLog {
  readonly depth: number;
  readonly gate: GateKey;
  readonly threat: number;
  readonly pressure: number;
  readonly fallen: CharacterInstance;
  readonly decisions: readonly {
    readonly actor: CharacterInstance;
    readonly decision: Decision;
    readonly damage: number;
    readonly heldSuppressor: boolean;
  }[];
  readonly rescued: boolean;
  readonly died: readonly InstanceId[];
  readonly firstVisit: boolean;
  readonly echoNote: string | undefined;
  readonly supplyGained: SupplyKind | undefined;
}

export interface GateRunResult {
  readonly deepestDepth: number;
  readonly cleared: boolean;
  readonly floors: readonly GateFloorLog[];
  readonly deaths: readonly InstanceId[];
  readonly survivors: readonly InstanceId[];
  readonly abortReason: 'party_wiped' | 'too_few_to_continue' | 'party_spent' | undefined;
  readonly gatesTaken: readonly GateKey[];
  readonly finalPressure: number;
  /** 이 등반에서 새로 생긴 잔상 — 다음 등반으로 넘어간다 */
  readonly newEchoes: readonly Echo[];
  /**
   * 이 등반에서 회수한 잔상.
   *
   * 호출자가 이걸 자기 목록에서 지워야 한다. 안 지우면 같은 좌표의 잔상을 매 회차
   * 반복 수확할 수 있다 — 실제로 캠페인 테스트가 그 버그를 잡아냈다.
   */
  readonly consumedEchoes: readonly Echo[];
}

export interface GateRunInput {
  readonly world: World;
  readonly party: readonly InstanceId[];
  readonly order: MasterOrder;
  readonly strategy: GateStrategy;
  /** 이전 등반들이 남긴 잔상 */
  readonly echoes?: readonly Echo[];
  readonly startingSupplies?: Supplies;
}

export const DEFAULT_SUPPLIES: Readonly<Supplies> = {
  suppressor: 2, stabilizer: 2, sedative: 1,
};

export function runGateTower(input: GateRunInput): GateRunResult {
  const { world, party, order, strategy } = input;
  const supplies: Supplies = { ...(input.startingSupplies ?? DEFAULT_SUPPLIES) };
  const echoes = [...(input.echoes ?? [])];

  const floors: GateFloorLog[] = [];
  const deaths: InstanceId[] = [];
  const gatesTaken: GateKey[] = [];
  const newEchoes: Echo[] = [];
  const consumedEchoes: Echo[] = [];
  let pressure = 0;
  let deepestDepth = 0;
  let abortReason: GateRunResult['abortReason'];

  for (let depth = 1; depth <= TOWER.floors; depth += 1) {
    const living = party.map((id) => world.instance(id)).filter((c) => c.status === 'alive');

    if (living.length === 0) { abortReason = 'party_wiped'; break; }
    if (living.length < TOWER.minPartyToContinue) { abortReason = 'too_few_to_continue'; break; }
    const line = order.retreatCondition.healthRatioBelow;
    if (line > 0 && living.every((c) => c.needs.health / c.needs.maxHealth < line)) {
      abortReason = 'party_spent';
      break;
    }

    world.advanceTick();
    deepestDepth = depth;

    const known = world.events
      .ofKind('WorldDiscovery')
      .some((e) => e.what === floorKey(depth));
    const echo = echoes.find((e) => e.depth === depth);
    const baseThreat = TOWER.threatAt(depth) + (pressure + GATE_RULES.pressurePerDepth)
      * GATE_RULES.threatFromPressure;

    const ctx: GateContext = {
      depth, baseThreat, pressure, supplies, living, echo, known,
    };

    /* 1. 문 선택 — Master의 결정 */
    const gateKey = strategy.chooseGate(ctx);
    const gate = GATES[gateKey];
    gatesTaken.push(gateKey);

    pressure += GATE_RULES.pressurePerDepth + gate.extraPressure;
    const threat = Math.max(5, Math.round(
      TOWER.threatAt(depth) + pressure * GATE_RULES.threatFromPressure + gate.threat,
    ));

    if (gate.fatigue > 0) {
      for (const c of living) {
        c.needs.fatigue = Math.min(100, c.needs.fatigue + gate.fatigue);
      }
    }

    /* 2. 보급 배분 — Master의 결정 */
    const allocation = strategy.allocate(ctx);
    const suppressorHolder = spendSuppressor(supplies, allocation, living);
    applyStabilizer(supplies, allocation, world);
    applySedative(supplies, allocation, world);

    /* 3. 좌표 기록과 잔상 */
    const arrival = runTransaction(world, ReachFloorTransaction, {
      floor: depth,
      by: living[0]!.instanceId,
    });
    if (!arrival.ok) throw new Error(arrival.error);

    let echoNote: string | undefined;
    if (echo) {
      if (gate.recoversEcho) {
        supplies[echo.grants] = Math.min(GATE_RULES.supplyCap, supplies[echo.grants] + 1);
        for (const c of living) {
          c.emotion.fear = Math.max(0, c.emotion.fear - GATE_RULES.echoRelief);
        }
        echoes.splice(echoes.indexOf(echo), 1);
        consumedEchoes.push(echo);
        echoNote = `${echo.name}의 잔상을 회수했다`;
      } else {
        for (const c of living) {
          c.emotion.fear = Math.min(100, c.emotion.fear + GATE_RULES.echoFear);
        }
        echoNote = `${echo.name}의 이름이 벽면에 떠 있다`;
      }
    }

    /* 4. 조우 */
    const fallen = pickFallen(world, living);
    const others = living.filter((c) => c.instanceId !== fallen.instanceId);
    const situation = allyDown(fallen.instanceId, threat, world.tick);

    const decisions: ActorDecision[] = [];
    const byActor = new Map<InstanceId, Decision>();
    for (const actor of others) {
      const hasSuppressor = suppressorHolder === actor.instanceId;
      const decision = decide(buildAgentState(actor, situation, order, { hasSuppressor }));
      byActor.set(actor.instanceId, decision);
      decisions.push({
        actor: actor.instanceId,
        action: decision.reason.action,
        plan: decision.plan?.steps,
      });
    }

    const resolved = runTransaction(world, ResolveTransaction, { situation, decisions });
    if (!resolved.ok) throw new Error(resolved.error);

    for (const id of resolved.value.died) {
      const victim = world.instance(id);
      if (!echoes.some((e) => e.depth === depth) && !newEchoes.some((e) => e.depth === depth)) {
        newEchoes.push({
          depth,
          name: victim.identity.name,
          grants: world.rng.next() < 0.5 ? 'suppressor' : 'stabilizer',
        });
      }
    }
    deaths.push(...resolved.value.died);

    /* 5. 보급 — 심층문은 확실히 준다 */
    let supplyGained: SupplyKind | undefined;
    if (gate.supply) {
      supplyGained = world.rng.next() < 0.5 ? 'suppressor' : 'stabilizer';
      supplies[supplyGained] = Math.min(GATE_RULES.supplyCap, supplies[supplyGained] + 1);
    }

    floors.push({
      depth, gate: gateKey, threat, pressure, fallen,
      decisions: others.map((actor) => ({
        actor,
        decision: byActor.get(actor.instanceId)!,
        damage: resolved.value.damageByActor.get(actor.instanceId) ?? 0,
        heldSuppressor: suppressorHolder === actor.instanceId,
      })),
      rescued: resolved.value.rescued,
      died: resolved.value.died,
      firstVisit: arrival.value,
      echoNote,
      supplyGained,
    });

    rest(world, party);
  }

  const survivors = party.filter((id) => world.instance(id).status === 'alive');

  return {
    deepestDepth,
    cleared: deepestDepth === TOWER.floors && abortReason === undefined,
    floors,
    deaths,
    survivors,
    abortReason,
    gatesTaken,
    finalPressure: pressure,
    newEchoes,
    consumedEchoes,
  };
}

/**
 * 쓰러지는 사람은 체력이 낮을수록 뽑힐 확률이 높다.
 *
 * 균등 추첨이면 만신창이가 멀쩡한 동료보다 덜 쓰러지는 일이 생겨서 이상하게 보인다.
 * 가중치를 주면 "약한 쪽이 먼저 무너진다"는 긴장이 생긴다.
 */
function pickFallen(world: World, living: readonly CharacterInstance[]): CharacterInstance {
  const weights = living.map((c) => 1 + (1 - c.needs.health / c.needs.maxHealth) * 2.2);
  const total = weights.reduce((a, b) => a + b, 0);
  let roll = world.rng.next() * total;
  for (let i = 0; i < living.length; i += 1) {
    roll -= weights[i]!;
    if (roll <= 0) return living[i]!;
  }
  return living[living.length - 1]!;
}

function spendSuppressor(
  supplies: Supplies,
  allocation: Allocation,
  living: readonly CharacterInstance[],
): InstanceId | undefined {
  const target = allocation.suppressorTo;
  if (!target || supplies.suppressor <= 0) return undefined;
  if (!living.some((c) => c.instanceId === target)) return undefined;
  supplies.suppressor -= 1;
  return target;
}

function applyStabilizer(supplies: Supplies, allocation: Allocation, world: World): void {
  const target = allocation.stabilizerTo;
  if (!target || supplies.stabilizer <= 0) return;
  const c = world.find(target);
  if (!c || c.status !== 'alive') return;
  supplies.stabilizer -= 1;
  c.needs.health = Math.min(
    c.needs.maxHealth,
    c.needs.health + Math.round(c.needs.maxHealth * GATE_RULES.healRatio),
  );
}

function applySedative(supplies: Supplies, allocation: Allocation, world: World): void {
  const target = allocation.sedativeTo;
  if (!target || supplies.sedative <= 0) return;
  const c = world.find(target);
  if (!c || c.status !== 'alive') return;
  supplies.sedative -= 1;
  c.emotion.fear = Math.max(0, c.emotion.fear - GATE_RULES.calmFear);
  c.needs.fatigue = Math.min(100, c.needs.fatigue + GATE_RULES.calmFatigue);
}

/** 좌표 사이 휴식. 선형 등반과 같은 수치를 쓴다 — 상수를 두 곳에 두면 반드시 어긋난다. */
function rest(world: World, party: readonly InstanceId[]): void {
  for (const id of party) {
    const member = world.instance(id);
    if (member.status !== 'alive') continue;
    member.needs.health = Math.min(
      member.needs.maxHealth,
      member.needs.health + Math.round(member.needs.maxHealth * TOWER.restHealRatio),
    );
    member.emotion.fear = Math.max(0, member.emotion.fear - TOWER.restFearDecay);
  }
}

export { FormPartyTransaction };
