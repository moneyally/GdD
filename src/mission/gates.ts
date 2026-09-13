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

export interface GateSessionInput {
  readonly world: World;
  readonly party: readonly InstanceId[];
  readonly order: MasterOrder;
  /** 이전 등반들이 남긴 잔상 */
  readonly echoes?: readonly Echo[];
  readonly startingSupplies?: Supplies;
}

export interface GateRunInput extends GateSessionInput {
  readonly strategy: GateStrategy;
}

export const DEFAULT_SUPPLIES: Readonly<Supplies> = {
  suppressor: 2, stabilizer: 2, sedative: 1,
};

/**
 * 한 좌표씩 진행하는 등반.
 *
 * 왜 클래스인가: 사람이 플레이하는 화면은 "문 세 개를 보여주고 기다린다"가 필요하고,
 * 밸런스 측정은 "전략 함수로 자동 진행"이 필요하다. 두 경로가 **같은 규칙**을 써야 하므로
 * 규칙은 여기 한 번만 쓰고, `runGateTower`는 이 위에 전략을 얹은 껍데기다.
 *
 * 이전에는 프로토타입(HTML)이 판단 로직을 손으로 복사해 갖고 있었다. 그러면 측정한 것과
 * 플레이하는 것이 다른 게임이 된다 — 이 클래스가 그 중복을 없애기 위해 존재한다.
 *
 * 사용:
 * ```
 * const session = new GateSession({ world, party, order });
 * let ctx;
 * while ((ctx = session.peek())) session.advance(chosenGate, allocation);
 * const result = session.result();
 * ```
 */
export class GateSession {
  private readonly world: World;
  private readonly party: readonly InstanceId[];
  private order: MasterOrder;
  private readonly supplies: Supplies;
  private readonly echoes: Echo[];

  private readonly floors: GateFloorLog[] = [];
  private readonly deaths: InstanceId[] = [];
  private readonly gatesTaken: GateKey[] = [];
  private readonly newEchoes: Echo[] = [];
  private readonly consumedEchoes: Echo[] = [];

  private pressure = 0;
  private deepestDepth = 0;
  private abortReason: GateRunResult['abortReason'];
  private finished = false;
  private pendingSuppressor: InstanceId | undefined;

  constructor(input: GateSessionInput) {
    this.world = input.world;
    this.party = input.party;
    this.order = input.order;
    this.supplies = { ...(input.startingSupplies ?? DEFAULT_SUPPLIES) };
    this.echoes = [...(input.echoes ?? [])];
  }

  /**
   * 등반 중 명령 변경. Master가 할 수 있는 일이 문 선택뿐이면 게임이 얕다 —
   * 퇴각선을 언제 올리고 내리는지가 두 번째 레버다.
   *
   * 자동 진행(`runGateTower`)은 이걸 호출하지 않으므로 측정 결과는 영향받지 않는다.
   */
  setOrder(order: MasterOrder): void {
    this.order = order;
  }

  /**
   * 교란기를 미리 지급한다 (사람이 플레이할 때). 즉시 재고에서 빠지고,
   * 다음 `advance()` 한 번에만 유효하다.
   *
   * 자동 진행은 `Allocation`으로 같은 일을 한다 — 이쪽은 "누르면 카드에 표시가 붙는다"가
   * 필요한 화면용 경로다.
   */
  giveSuppressor(target: InstanceId): boolean {
    if (this.pendingSuppressor) this.clearSuppressor();
    if (this.supplies.suppressor <= 0) return false;
    const c = this.world.find(target);
    if (!c || c.status !== 'alive') return false;
    this.supplies.suppressor -= 1;
    this.pendingSuppressor = target;
    return true;
  }

  /** 지급 취소 — 재고를 돌려준다 */
  clearSuppressor(): void {
    if (!this.pendingSuppressor) return;
    this.supplies.suppressor += 1;
    this.pendingSuppressor = undefined;
  }

  suppressorHolder(): InstanceId | undefined {
    return this.pendingSuppressor;
  }

  /**
   * 안정제·억제제를 지금 쓴다.
   *
   * 자동 진행은 이 둘을 `advance()` 안에서 쓴다. 사람이 플레이할 때는 누른 즉시
   * 체력 막대가 오르는 것이 필요하므로 적용 시점이 문 통과 **이전**이 된다 —
   * 같은 수치, 같은 함수를 쓰지만 순서가 한 칸 앞이다.
   */
  useStabilizer(target: InstanceId): boolean {
    const before = this.supplies.stabilizer;
    applyStabilizer(this.supplies, { stabilizerTo: target }, this.world);
    return this.supplies.stabilizer < before;
  }

  useSedative(target: InstanceId): boolean {
    const before = this.supplies.sedative;
    applySedative(this.supplies, { sedativeTo: target }, this.world);
    return this.supplies.sedative < before;
  }

  /**
   * 다음 좌표에서 Master가 보는 것. 등반이 끝났으면 undefined.
   *
   * 부작용은 "끝났다"는 판정을 기록하는 것뿐이고 멱등이다 — 화면이 매 프레임 불러도 된다.
   * 세계는 건드리지 않는다 (tick도 올리지 않는다).
   */
  peek(): GateContext | undefined {
    if (this.finished) return undefined;

    const depth = this.deepestDepth + 1;
    if (depth > TOWER.floors) { this.finished = true; return undefined; }

    const living = this.living();
    if (living.length === 0) { return this.stop('party_wiped'); }
    if (living.length < TOWER.minPartyToContinue) { return this.stop('too_few_to_continue'); }
    const line = this.order.retreatCondition.healthRatioBelow;
    if (line > 0 && living.every((c) => c.needs.health / c.needs.maxHealth < line)) {
      return this.stop('party_spent');
    }

    return {
      depth,
      baseThreat: TOWER.threatAt(depth)
        + (this.pressure + GATE_RULES.pressurePerDepth) * GATE_RULES.threatFromPressure,
      pressure: this.pressure,
      supplies: this.supplies,
      living,
      echo: this.echoes.find((e) => e.depth === depth),
      known: this.world.events.ofKind('WorldDiscovery').some((e) => e.what === floorKey(depth)),
    };
  }

  /** 고른 문으로 한 좌표 진행한다. `peek()`이 undefined를 주면 호출해선 안 된다. */
  advance(gateKey: GateKey, allocation: Allocation = {}): GateFloorLog {
    const ctx = this.peek();
    if (!ctx) throw new Error('등반이 이미 끝났다');

    const { world, order } = this;
    const gate = GATES[gateKey];

    world.advanceTick();
    this.deepestDepth = ctx.depth;
    this.gatesTaken.push(gateKey);

    this.pressure += GATE_RULES.pressurePerDepth + gate.extraPressure;
    const threat = Math.max(5, Math.round(
      TOWER.threatAt(ctx.depth) + this.pressure * GATE_RULES.threatFromPressure + gate.threat,
    ));

    if (gate.fatigue > 0) {
      for (const c of ctx.living) {
        c.needs.fatigue = Math.min(100, c.needs.fatigue + gate.fatigue);
      }
    }

    /* 보급 배분 — Master의 결정 */
    const suppressorHolder = this.takePendingSuppressor(ctx.living)
      ?? spendSuppressor(this.supplies, allocation, ctx.living);
    applyStabilizer(this.supplies, allocation, world);
    applySedative(this.supplies, allocation, world);

    /* 좌표 기록과 잔상 */
    const arrival = runTransaction(world, ReachFloorTransaction, {
      floor: ctx.depth,
      by: ctx.living[0]!.instanceId,
    });
    if (!arrival.ok) throw new Error(arrival.error);

    const echoNote = this.settleEcho(ctx, gate);

    /* 조우 */
    const fallen = pickFallen(world, ctx.living);
    const others = ctx.living.filter((c) => c.instanceId !== fallen.instanceId);
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
      const taken = this.echoes.some((e) => e.depth === ctx.depth)
        || this.newEchoes.some((e) => e.depth === ctx.depth);
      if (!taken) {
        this.newEchoes.push({
          depth: ctx.depth,
          name: victim.identity.name,
          grants: world.rng.next() < 0.5 ? 'suppressor' : 'stabilizer',
        });
      }
    }
    this.deaths.push(...resolved.value.died);

    /* 보급 — 심층문은 확실히 준다 */
    let supplyGained: SupplyKind | undefined;
    if (gate.supply) {
      supplyGained = world.rng.next() < 0.5 ? 'suppressor' : 'stabilizer';
      this.supplies[supplyGained] = Math.min(
        GATE_RULES.supplyCap, this.supplies[supplyGained] + 1,
      );
    }

    const log: GateFloorLog = {
      depth: ctx.depth,
      gate: gateKey,
      threat,
      pressure: this.pressure,
      fallen,
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
    };
    this.floors.push(log);

    rest(world, this.party);
    return log;
  }

  result(): GateRunResult {
    return {
      deepestDepth: this.deepestDepth,
      cleared: this.deepestDepth === TOWER.floors && this.abortReason === undefined,
      floors: this.floors,
      deaths: this.deaths,
      survivors: this.party.filter((id) => this.world.instance(id).status === 'alive'),
      abortReason: this.abortReason,
      gatesTaken: this.gatesTaken,
      finalPressure: this.pressure,
      newEchoes: this.newEchoes,
      consumedEchoes: this.consumedEchoes,
    };
  }

  /** 현재 보급 — 화면 표시용. 복사해서 준다 */
  currentSupplies(): Readonly<Supplies> {
    return { ...this.supplies };
  }

  private living(): CharacterInstance[] {
    return this.party
      .map((id) => this.world.instance(id))
      .filter((c) => c.status === 'alive');
  }

  /** 미리 지급된 교란기를 이번 좌표에 쓴다. 이미 재고에서 빠져 있으므로 다시 빼지 않는다 */
  private takePendingSuppressor(living: readonly CharacterInstance[]): InstanceId | undefined {
    const target = this.pendingSuppressor;
    this.pendingSuppressor = undefined;
    if (!target) return undefined;
    return living.some((c) => c.instanceId === target) ? target : undefined;
  }

  private stop(reason: NonNullable<GateRunResult['abortReason']>): undefined {
    this.abortReason = reason;
    this.finished = true;
    return undefined;
  }

  private settleEcho(ctx: GateContext, gate: GateSpec): string | undefined {
    const echo = ctx.echo;
    if (!echo) return undefined;

    if (!gate.recoversEcho) {
      for (const c of ctx.living) {
        c.emotion.fear = Math.min(100, c.emotion.fear + GATE_RULES.echoFear);
      }
      return `${echo.name}의 이름이 벽면에 떠 있다`;
    }

    this.supplies[echo.grants] = Math.min(
      GATE_RULES.supplyCap, this.supplies[echo.grants] + 1,
    );
    for (const c of ctx.living) {
      c.emotion.fear = Math.max(0, c.emotion.fear - GATE_RULES.echoRelief);
    }
    this.echoes.splice(this.echoes.indexOf(echo), 1);
    this.consumedEchoes.push(echo);
    return `${echo.name}의 잔상을 회수했다`;
  }
}

/** 전략을 얹어 끝까지 자동 진행한다. 밸런스 측정과 테스트가 쓰는 경로. */
export function runGateTower(input: GateRunInput): GateRunResult {
  const session = new GateSession(input);
  let ctx = session.peek();
  while (ctx) {
    session.advance(input.strategy.chooseGate(ctx), input.strategy.allocate(ctx));
    ctx = session.peek();
  }
  return session.result();
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
