/**
 * 웹 화면용 파사드 — **화면이 규칙을 갖지 않게 하기 위한 층.**
 *
 * 이 파일이 생긴 이유는 사고 하나다. 프로토타입(HTML)이 판단 로직을 손으로 복사해
 * 갖고 있었다. 그러면 `npm run gates:stats`로 측정한 게임과 사람이 눌러보는 게임이
 * 서로 다른 게임이 된다 — 한쪽만 고치면 아무도 눈치채지 못한다.
 *
 * 그래서 화면에는 규칙을 한 줄도 두지 않는다. 여기서 나가는 것은 **이미 결정된 결과와
 * 표시용 숫자**뿐이고, 판단·피해·죽음·기억은 전부 `src/` 엔진이 한다.
 *
 * 규칙 5의 연장이다: LLM이 행동을 결정하지 않는 것과 같은 이유로, 렌더러도 결정하지 않는다.
 */

import type { InstanceId } from '../core/ids.js';
import type { CharacterInstance } from '../core/instance.js';
import type { MasterOrder, RiskPolicy } from '../core/order.js';
import { World } from '../core/world.js';
import { formatReason } from '../decision/reason.js';
import { ALL_DEFINITIONS, SCOUT, VANGUARD } from '../data/definitions.js';
import { narrateAction } from '../log/renderer.js';
import { CAMP, campRest, refillRoster, type CampSettings } from '../mission/campaign.js';
import {
  GATES,
  GATE_KEYS,
  GATE_RULES,
  GateSession,
  type Echo,
  type GateKey,
  type GateRunResult,
  type Supplies,
} from '../mission/gates.js';
import { FormPartyTransaction, TOWER } from '../mission/tower.js';
import { runTransaction } from '../core/transaction.js';
import { serialize } from '../persistence/serialize.js';
import { assertSnapshotVersion, takeSnapshot, type Snapshot } from '../persistence/snapshot.js';
import { summon } from '../scenario/coreGameplay.js';

/* ------------------------------------------------------------------ *
 * 표시용 한국어 — 화면이 태그 문자열을 해석하지 않게 여기서 준다
 * ------------------------------------------------------------------ */

export const MEMORY_KO: Readonly<Record<string, string>> = {
  ally_died_unrescued: '구하지 못한 죽음',
  rescued_ally: '구해낸 기억',
  wounded_in_rescue: '구조의 상처',
  witnessed_ally_death: '목격한 죽음',
};

export const GOAL_KO: Readonly<Record<string, string>> = {
  never_abandon_ally: '다시는 버리지 않는다',
  survive: '살아남는다',
};

export const GATE_EN: Readonly<Record<GateKey, string>> = {
  aligned: "ALIGNED", warped: "WARPED", deep: "DEEP",
};

export const GATE_DESC: Readonly<Record<GateKey, string>> = {
  aligned: '위상이 맞물려 있다. 예측한 그대로다.',
  warped: '좌표가 어긋난다. 위험은 낮고 잔상이 남아 있다.',
  deep: '더 깊은 좌표로 곧장 이어진다. 보급이 있다.',
};

export const SUPPLY_KO: Readonly<Record<string, string>> = {
  suppressor: '교란기', stabilizer: '안정제', sedative: '억제제',
};

/* ------------------------------------------------------------------ *
 * 뷰 모델 — 화면이 받는 것 전부
 * ------------------------------------------------------------------ */

export interface UnitView {
  readonly id: string;
  readonly name: string;
  readonly role: string;
  readonly loyalty: number;
  readonly health: number;
  readonly maxHealth: number;
  readonly healthRatio: number;
  readonly fear: number;
  readonly fatigue: number;
  readonly alive: boolean;
  /** 몇 번째 등반인가 — 베테랑 표시 */
  readonly attempts: number;
  readonly holdingSuppressor: boolean;
  readonly goals: readonly string[];
  readonly memories: readonly { readonly ko: string; readonly importance: number }[];
}

export interface GateOptionView {
  readonly key: GateKey;
  readonly ko: string;
  readonly en: string;
  readonly desc: string;
  /** 다녀온 좌표면 정확한 값, 아니면 범위 문자열 */
  readonly threatShown: string;
  readonly threatSign: 'up' | 'down' | 'flat';
  readonly pressureGain: number;
  readonly fatigue: number;
  readonly supply: boolean;
  readonly recoversEcho: boolean;
  /** 이 좌표의 잔상 이름 (뒤틀린문에서만 의미가 있다) */
  readonly echoName: string | undefined;
}

export interface DepthRowView {
  readonly id: string;
  readonly name: string;
  readonly action: string;
  readonly layer: string;
  /** ReasonCode 원문 — 규칙 6. 화면은 이걸 만들지 않고 받는다 */
  readonly code: string;
  readonly plan: readonly string[] | undefined;
  readonly sentence: string;
  readonly damage: number;
  readonly died: boolean;
}

export interface DepthView {
  readonly depth: number;
  readonly threat: number;
  readonly gate: GateKey;
  readonly gateKo: string;
  readonly fallenName: string;
  readonly firstVisit: boolean;
  readonly echoNote: string | undefined;
  readonly supplyGained: string | undefined;
  readonly rescued: boolean;
  readonly rows: readonly DepthRowView[];
  readonly diedNames: readonly string[];
}

export interface HudView {
  readonly attempt: number;
  readonly returning: number;
  readonly depth: number;
  readonly totalDepths: number;
  readonly pressure: number;
  readonly supplies: Readonly<Supplies>;
  readonly livingCount: number;
}

export interface CampRowView {
  readonly name: string;
  readonly attempts: number;
  readonly hasGoal: boolean;
  readonly memories: readonly string[];
}

export interface FinalView {
  readonly cleared: boolean;
  readonly reason: string | undefined;
  readonly deepestDepth: number;
  readonly survivors: readonly string[];
  readonly deaths: readonly string[];
  readonly camp: readonly CampRowView[];
}

export interface LedgerView {
  readonly coords: readonly {
    readonly depth: number;
    readonly seen: boolean;
    readonly echoName: string | undefined;
  }[];
  readonly runs: readonly {
    readonly attempt: number;
    readonly depth: number;
    readonly cleared: boolean;
    readonly deaths: readonly string[];
  }[];
}

const ABORT_KO: Readonly<Record<NonNullable<GateRunResult['abortReason']>, string>> = {
  party_wiped: '전멸했다',
  too_few_to_continue: '남은 인원으로는 다음 문을 열 수 없다',
  party_spent: '전원이 퇴각선 아래다 — 투영을 닫는다',
};

/* ------------------------------------------------------------------ *
 * 저장 — 엔진의 Snapshot을 그대로 쓴다
 * ------------------------------------------------------------------ */

/**
 * 브라우저 세이브. `snapshot`은 Unity/C#이 읽는 것과 **같은 형식**이다
 * (`golden/tower-snapshot.json` 대조로 검증됨). 나머지는 캠프 상태다.
 *
 * **저장 시점은 캠프 한 곳뿐이다.** 등반 중간에 저장하면 새로고침이 무료 회복이 된다 —
 * 복원할 때 캠프를 거치기 때문이다. 캠프에서만 저장하면 복원이 캠프를 재현하므로
 * 그 구멍이 닫힌다. 영구사망 게임에서 되감기 수단을 남기면 죽음이 무게를 잃는다.
 */
export interface SaveData {
  readonly snapshot: Snapshot;
  readonly echoes: readonly Echo[];
  readonly seen: readonly number[];
  readonly roster: readonly string[];
  /** 각자 몇 회차에 합류했는가. 재시작마다 회차가 부풀지 않게 **누적 카운터를 저장하지 않는다** */
  readonly joinedAt: Readonly<Record<string, number>>;
  readonly runs: FinalView extends never ? never : readonly LedgerView['runs'][number][];
}

/* ------------------------------------------------------------------ *
 * 게임
 * ------------------------------------------------------------------ */

export interface GameOptions {
  readonly seed?: number;
  readonly camp?: Partial<CampSettings>;
  readonly save?: SaveData;
}

export class Game {
  private readonly world: World;
  private readonly camp: CampSettings;

  private roster: CharacterInstance[] = [];
  private echoes: readonly Echo[] = [];
  private seen = new Set<number>();
  private readonly joinedAt = new Map<string, number>();
  private runs: LedgerView['runs'][number][] = [];

  private session: GateSession;
  private attempt = 1;
  private returning = 0;
  private history: DepthView[] = [];
  private final: FinalView | undefined;

  private risk: RiskPolicy = 'balanced';
  private line = 0.25;

  constructor(options: GameOptions = {}) {
    this.camp = { ...CAMP, ...options.camp };

    const save = options.save;
    if (save) {
      assertSnapshotVersion(save.snapshot);
      this.world = World.restore({
        tick: save.snapshot.tick,
        instances: save.snapshot.instances,
        definitions: ALL_DEFINITIONS,
        rngState: save.snapshot.rngState,
        idCounter: save.snapshot.idCounter,
        events: save.snapshot.events,
      });
      this.echoes = save.echoes;
      this.seen = new Set(save.seen);
      this.runs = [...save.runs];
      for (const [id, n] of Object.entries(save.joinedAt)) this.joinedAt.set(id, n);
      this.roster = save.roster
        .map((id) => this.world.find(id as InstanceId))
        .filter((c): c is CharacterInstance => c !== undefined && c.status === 'alive');
      this.attempt = this.runs.length + 1;
    } else {
      this.world = World.create(options.seed ?? 77001, ALL_DEFINITIONS);
    }

    this.session = this.openAttempt();
  }

  /* ── 명령 ── */

  setRisk(policy: RiskPolicy): void {
    this.risk = policy;
    this.session.setOrder(this.order());
  }

  setRetreatLine(ratio: number): void {
    this.line = ratio;
    this.session.setOrder(this.order());
  }

  currentRisk(): RiskPolicy { return this.risk; }
  currentLine(): number { return this.line; }

  private order(): MasterOrder {
    return {
      goal: 'advance',
      riskPolicy: this.risk,
      retreatCondition: { healthRatioBelow: this.line },
    };
  }

  /* ── 보급 ── */

  giveSuppressor(id: string): void {
    if (this.session.suppressorHolder() === (id as InstanceId)) this.session.clearSuppressor();
    else this.session.giveSuppressor(id as InstanceId);
  }

  useStabilizer(id: string): void { this.session.useStabilizer(id as InstanceId); }
  useSedative(id: string): void { this.session.useSedative(id as InstanceId); }

  /* ── 진행 ── */

  /** 다음 좌표의 문 세 개. 등반이 끝났으면 빈 배열 */
  gates(): readonly GateOptionView[] {
    const ctx = this.session.peek();
    if (!ctx) { this.closeIfNeeded(); return []; }

    const known = this.seen.has(ctx.depth) || ctx.known;
    return GATE_KEYS.map((key) => {
      const gate = GATES[key];
      const threat = Math.max(5, Math.round(ctx.baseThreat + gate.threat));
      return {
        key,
        ko: gate.ko,
        en: GATE_EN[key],
        desc: GATE_DESC[key],
        threatShown: known ? String(threat) : `${Math.max(5, threat - 8)}~${threat + 8}`,
        threatSign: gate.threat > 0 ? 'up' : gate.threat < 0 ? 'down' : 'flat',
        pressureGain: GATE_RULES.pressurePerDepth + gate.extraPressure,
        fatigue: gate.fatigue,
        supply: gate.supply,
        recoversEcho: gate.recoversEcho,
        echoName: ctx.echo?.name,
      };
    });
  }

  /** 다음 좌표 번호. 등반이 끝났으면 undefined */
  nextDepth(): number | undefined {
    return this.session.peek()?.depth;
  }

  /** 문을 고른다. 판단·피해·죽음·기억은 전부 엔진이 하고, 결과만 돌아온다 */
  enter(gate: GateKey): DepthView | undefined {
    const ctx = this.session.peek();
    if (!ctx) { this.closeIfNeeded(); return undefined; }

    this.seen.add(ctx.depth);
    const log = this.session.advance(gate);

    const died = new Set(log.died.map(String));
    const view: DepthView = {
      depth: log.depth,
      threat: log.threat,
      gate: log.gate,
      gateKo: GATES[log.gate].ko,
      fallenName: log.fallen.identity.name,
      firstVisit: log.firstVisit,
      echoNote: log.echoNote,
      supplyGained: log.supplyGained ? `${SUPPLY_KO[log.supplyGained]} +1` : undefined,
      rescued: log.rescued,
      rows: log.decisions.map((d) => ({
        id: String(d.actor.instanceId),
        name: d.actor.identity.name,
        action: d.decision.reason.action,
        layer: d.decision.reason.layer,
        code: formatReason(d.decision.reason),
        plan: d.decision.plan?.steps,
        sentence: narrateAction(d.actor, log.fallen, d.decision),
        damage: d.damage,
        died: died.has(String(d.actor.instanceId)),
      })),
      diedNames: log.died.map((id) => this.world.instance(id).identity.name),
    };

    this.history = [view, ...this.history];
    this.closeIfNeeded();
    return view;
  }

  /** 등반이 끝났다면 결과. 진행 중이면 undefined */
  finalView(): FinalView | undefined {
    this.closeIfNeeded();
    return this.final;
  }

  /** 캠프를 거쳐 다음 등반을 시작한다 */
  nextAttempt(): void {
    if (!this.final) return;
    this.attempt += 1;
    this.session = this.openAttempt();
    this.history = [];
    this.final = undefined;
  }

  /* ── 화면이 읽는 것 ── */

  hud(): HudView {
    return {
      attempt: this.attempt,
      returning: this.returning,
      depth: this.history[0]?.depth ?? 0,
      totalDepths: TOWER.floors,
      pressure: this.session.result().finalPressure,
      supplies: this.session.currentSupplies(),
      livingCount: this.roster.filter((c) => c.status === 'alive').length,
    };
  }

  units(): readonly UnitView[] {
    const holder = this.session.suppressorHolder();
    return this.roster.map((c) => this.unitView(c, holder));
  }

  log(): readonly DepthView[] { return this.history; }

  ledger(): LedgerView {
    return {
      coords: Array.from({ length: TOWER.floors }, (_, i) => {
        const depth = i + 1;
        return {
          depth,
          seen: this.seen.has(depth),
          echoName: this.echoes.find((e) => e.depth === depth)?.name,
        };
      }),
      runs: this.runs,
    };
  }

  /* ── 저장 ── */

  save(): SaveData {
    return {
      snapshot: takeSnapshot(this.world),
      echoes: this.echoes,
      seen: [...this.seen],
      roster: this.roster.map((c) => String(c.instanceId)),
      joinedAt: Object.fromEntries(this.joinedAt),
      runs: this.runs,
    };
  }

  /** 세이브 원문. Unity가 읽는 것과 같은 형식의 snapshot을 품는다 */
  saveText(): string {
    const data = this.save();
    return JSON.stringify({
      ...data,
      snapshot: JSON.parse(serialize(data.snapshot)) as unknown,
    });
  }

  /* ── 내부 ── */

  /** 몇 번째 등반인가. 합류 회차에서 계산한다 — 새로고침해도 늘어나지 않는다 */
  private attemptsSurvived(c: CharacterInstance): number {
    return this.attempt - (this.joinedAt.get(String(c.instanceId)) ?? this.attempt) + 1;
  }

  private unitView(c: CharacterInstance, holder: InstanceId | undefined): UnitView {
    const definition = this.world.definition(c.identity.definitionId);
    return {
      id: String(c.instanceId),
      name: c.identity.name,
      role: definition.archetype,
      loyalty: c.personality.loyalty,
      health: c.needs.health,
      maxHealth: c.needs.maxHealth,
      healthRatio: c.needs.health / c.needs.maxHealth,
      fear: c.emotion.fear,
      fatigue: c.needs.fatigue,
      alive: c.status === 'alive',
      attempts: this.attemptsSurvived(c),
      holdingSuppressor: holder === c.instanceId,
      goals: c.goals.map((g) => GOAL_KO[g.kind] ?? g.kind),
      memories: c.memory.map((m) => ({
        ko: MEMORY_KO[m.tag] ?? m.tag,
        importance: m.importance,
      })),
    };
  }

  /** 캠프 → 자리 보충 → 편성 → 새 등반 */
  private openAttempt(): GateSession {
    this.roster = this.roster.filter((c) => c.status === 'alive');
    this.returning = this.roster.length;

    campRest(this.roster, this.camp);
    refillRoster(this.world, this.roster, this.camp);

    for (const c of this.roster) {
      const key = String(c.instanceId);
      if (!this.joinedAt.has(key)) this.joinedAt.set(key, this.attempt);
    }

    const formed = runTransaction(this.world, FormPartyTransaction, {
      members: this.roster.map((c) => c.instanceId),
      baseTrust: 50,
    });
    if (!formed.ok) throw new Error(formed.error);

    return new GateSession({
      world: this.world,
      party: this.roster.map((c) => c.instanceId),
      order: this.order(),
      echoes: this.echoes,
    });
  }

  /** 등반이 끝났으면 결과를 만들고 잔상·기록을 갱신한다 */
  private closeIfNeeded(): void {
    if (this.final) return;
    if (this.session.peek()) return;

    const result = this.session.result();

    // 회수한 잔상은 지운다 — 안 지우면 같은 좌표를 매 회차 반복 수확할 수 있다
    this.echoes = [
      ...this.echoes.filter((e) => !result.consumedEchoes.includes(e)),
      ...result.newEchoes,
    ];

    const survivors = result.survivors.map((id) => this.world.instance(id));
    const deaths = result.deaths.map((id) => this.world.instance(id).identity.name);

    this.final = {
      cleared: result.cleared,
      reason: result.abortReason ? ABORT_KO[result.abortReason] : undefined,
      deepestDepth: result.deepestDepth,
      survivors: survivors.map((c) => c.identity.name),
      deaths,
      camp: survivors.map((c) => ({
        name: c.identity.name,
        attempts: this.attemptsSurvived(c),
        hasGoal: c.goals.length > 0,
        memories: c.memory.map((m) => MEMORY_KO[m.tag] ?? m.tag),
      })),
    };

    this.runs = [
      { attempt: this.attempt, depth: result.deepestDepth, cleared: result.cleared, deaths },
      ...this.runs,
    ].slice(0, 8);
  }
}

/** 화면이 쓰는 상수 — 규칙 수치를 화면에 복사해 두지 않기 위해 여기서 준다 */
export const RULES_FOR_DISPLAY = {
  totalDepths: TOWER.floors,
  pressurePerDepth: GATE_RULES.pressurePerDepth,
  echoFear: GATE_RULES.echoFear,
  calmFear: GATE_RULES.calmFear,
  calmFatigue: GATE_RULES.calmFatigue,
  healRatio: GATE_RULES.healRatio,
  supplyCap: GATE_RULES.supplyCap,
  partySize: CAMP.partySize,
  fearRecovered: CAMP.fearRecovered,
  definitions: [VANGUARD, SCOUT].map((d) => ({ ko: d.archetype, health: d.baseHealth })),
} as const;

export { summon };
export type { GateKey, Supplies };
