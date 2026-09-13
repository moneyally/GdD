/**
 * 행동 결과 적용. 판단(Decision) → 세계 변화(Event) → State 변화.
 *
 * 여기가 폐루프의 후반부다:
 *   [판단] → [행동] → [사건] → [죽음] → [역사] → 다음 판단이 달라진다
 *
 * 모든 변화는 트랜잭션을 통과하고(규칙 4), 중요한 변화는 Event로 남는다(규칙 3).
 *
 * 결과 수치는 전부 이 파일 상단 OUTCOME에 모아둔다.
 */

import { clamp } from '../core/agentState.js';
import type { WorldEvent } from '../core/events.js';
import { memoryId, type InstanceId, type MemoryId } from '../core/ids.js';
import { goalId } from '../core/ids.js';
import type { CharacterInstance, MemoryEntry, MemoryTag } from '../core/instance.js';
import type { Transaction } from '../core/transaction.js';
import type { World } from '../core/world.js';
import type { Action } from '../decision/reason.js';
import type { PlanStep } from '../decision/goapActions.js';
import { effectiveThreat } from '../decision/l2Goap.js';
import type { Situation } from '../decision/situation.js';
import { object, topic } from '../log/josa.js';

export const OUTCOME = {
  /** 구조 성공 시 구조자가 입는 피해. 위협도에 비례 */
  rescueDamageRatio: 0.7,
  /** 구조 성공 시 구조된 쪽이 구조자에게 갖는 신뢰 상승 */
  rescuedTrustGain: 18,
  /**
   * 구조 성공 시 구조자가 구조 대상에게 갖는 신뢰 상승.
   * 구조된 쪽보다 작다 — 목숨을 구해준 쪽의 체감이 더 크다.
   */
  rescuerTrustGain: 8,
  /** 구조 성공 시 구조자가 체감하는 공포 상승 (피해의 절반) */
  rescueFearGainRatio: 0.5,
  /** 퇴각 시 공포 감쇠 */
  retreatFearDecay: 8,
  /** 내가 퇴각해서 동료가 죽었을 때 생기는 기억의 중요도 */
  abandonMemoryImportance: 90,
  /** 그 기억이 만드는 목표의 우선순위 */
  neverAbandonGoalPriority: 85,
  /** 구조 성공 기억의 중요도 */
  rescueMemoryImportance: 55,
  /** 부상 기억의 중요도 */
  woundMemoryImportance: 45,
  /** 동료의 죽음을 목격한 기억의 중요도. 내 탓(abandon 90)보다 약하다 */
  witnessMemoryImportance: 60,
  /** 조우 1회당 누적 피로. 10층을 오르는 동안 행동 여력이 줄어든다 */
  fatiguePerEncounter: 6,
  /** 같은 일이 반복될 때 기존 기억이 강화되는 정도 */
  memoryReinforcement: 3,
} as const;

/** 한 명의 판단 */
export interface ActorDecision {
  readonly actor: InstanceId;
  readonly action: Action;
  /**
   * L2가 세운 계획. 있으면 계획대로 수행한다.
   * 연막이 포함되면 실제 위협이 줄어 피해도 줄어든다 — 계획한 캐릭터는 덜 다친다.
   */
  readonly plan?: readonly PlanStep[];
}

/**
 * 한 조우의 결과를 적용한다.
 *
 * 여러 명이 같은 상황을 보고 각자 판단하므로 결과는 판단의 **집합**에서 나온다:
 * 한 명이라도 구하러 가면 쓰러진 동료는 살고, 아무도 안 가면 죽는다.
 * 그래서 행동자별로 따로 처리할 수 없다 — 한 트랜잭션이 전원의 판단을 함께 받는다.
 */
export interface ResolveRequest {
  readonly situation: Situation;
  readonly decisions: readonly ActorDecision[];
}

export interface ResolveResult {
  /** 이 조우에서 죽은 캐릭터 */
  readonly died: readonly InstanceId[];
  /** 행동자별 실제 피해. 계획에 따라 달라진다 */
  readonly damageByActor: ReadonlyMap<InstanceId, number>;
  /** 구하러 간 사람이 있었는가 */
  readonly rescued: boolean;
  readonly events: readonly WorldEvent[];
}

export const ResolveTransaction: Transaction<ResolveRequest, ResolveResult> = {
  name: 'ResolveAction',

  validate(world, request): string | undefined {
    if (request.decisions.length === 0) return '판단이 비어 있다';
    const subject = world.find(request.situation.subject);
    if (!subject) return `알 수 없는 대상: ${request.situation.subject}`;
    if (subject.status !== 'alive') return `이미 죽은 대상: ${request.situation.subject}`;

    const seen = new Set<InstanceId>();
    for (const decision of request.decisions) {
      const actor = world.find(decision.actor);
      if (!actor) return `알 수 없는 Instance: ${decision.actor}`;
      if (actor.status !== 'alive') return `죽은 캐릭터는 행동할 수 없다: ${decision.actor}`;
      if (actor.instanceId === subject.instanceId) return '쓰러진 당사자는 판단하지 않는다';
      if (seen.has(decision.actor)) return `같은 캐릭터의 판단이 두 번 들어왔다: ${decision.actor}`;
      seen.add(decision.actor);
    }
    return undefined;
  },

  apply(world, request): ResolveResult {
    const before = world.events.length;
    const subject = world.instance(request.situation.subject);
    const tick = request.situation.tick;
    const died: InstanceId[] = [];
    const damageByActor = new Map<InstanceId, number>();

    /**
     * 구조는 RESCUE만이다.
     *
     * 한때 ATTACK도 구조로 처리했는데, 그러면 동료에게 관심 없는 캐릭터가 적에게
     * 달려들면서 우연히 동료를 구한다. 실측에서 편성(신뢰 50)과 미편성(신뢰 0)의
     * 구조율이 93% 대 92%로 같아졌다 — 관계가 판단에 영향을 준다는 전제가
     * ATTACK 경로로 새고 있었다. 적을 치는 것과 쓰러진 사람을 끌어내는 것은 다른 행동이다.
     */
    const rescued = request.decisions.some((d) => d.action === 'RESCUE');

    for (const decision of request.decisions) {
      const actor = world.instance(decision.actor);
      actor.needs.fatigue = clamp(actor.needs.fatigue + OUTCOME.fatiguePerEncounter, 0, 100);

      if (decision.action === 'RESCUE' || decision.action === 'ATTACK') {
        const isRescue = decision.action === 'RESCUE';
        // 계획에 연막이 있으면 실제 위협이 줄어든다
        const threat = effectiveThreat(request.situation.enemyThreat, decision.plan ?? []);
        // 인원수로 나누지 않는다. 판단은 각자 독립적으로 하므로 남이 올 것을 전제한
        // 할인을 주면, ReasonCode의 self_risk가 실제 피해와 달라져 근거가 거짓이 된다.
        // 협동으로 위험이 줄어드는 모델을 넣으려면 먼저 '동료가 올 것이라는 예측'이
        // 판단 입력에 있어야 한다 — 그건 지금 범위가 아니다.
        const damage = Math.round(threat * OUTCOME.rescueDamageRatio);
        damageByActor.set(actor.instanceId, damage);

        actor.needs.health = clamp(actor.needs.health - damage, 0, actor.needs.maxHealth);
        actor.emotion.fear = clamp(
          actor.emotion.fear + Math.round(damage * OUTCOME.rescueFearGainRatio),
          0,
          100,
        );

        if (isRescue) {
          // 관계는 양방향으로 변한다 — 둘 다 Event로 기록 (규칙 3)
          raiseTrust(world, subject, actor.instanceId, OUTCOME.rescuedTrustGain, tick, 'rescued_by');
          raiseTrust(world, actor, subject.instanceId, OUTCOME.rescuerTrustGain, tick, 'rescued_them');

          addMemory(world, actor, {
            tag: 'rescued_ally',
            importance: OUTCOME.rescueMemoryImportance,
            tick,
            subject: subject.instanceId,
            text: `${object(subject.identity.name)} 적 앞에서 끌어냈다.`,
          });
        }

        if (damage > 0) {
          addMemory(world, actor, {
            tag: 'wounded_in_rescue',
            importance: OUTCOME.woundMemoryImportance,
            tick,
            text: `그 대가로 깊은 상처를 입었다.`,
          });
        }

        if (actor.needs.health <= 0) {
          killInstance(world, actor, 'killed_by_enemy', [subject.instanceId], tick);
          died.push(actor.instanceId);
        }
      } else {
        damageByActor.set(actor.instanceId, 0);
        actor.emotion.fear = clamp(actor.emotion.fear - OUTCOME.retreatFearDecay, 0, 100);
      }
    }

    if (!rescued) {
      // 아무도 구하지 않았으므로 쓰러진 동료는 죽는다
      const witnesses = request.decisions.map((d) => d.actor);
      killInstance(world, subject, 'abandoned', witnesses, tick);
      died.push(subject.instanceId);

      // 구하지 않은 각자에게 기억이 생기고, 기억이 목표를 만든다.
      // 교전을 택한 사람도 포함된다 — 그도 구하지는 않았다.
      for (const decision of request.decisions) {
        const actor = world.instance(decision.actor);
        if (actor.status !== 'alive') continue;
        const memory = addMemory(world, actor, {
          tag: 'ally_died_unrescued',
          importance: OUTCOME.abandonMemoryImportance,
          tick,
          subject: subject.instanceId,
          text:
            decision.action === 'ATTACK'
              ? `나는 적을 쫓았고, ${topic(subject.identity.name)} 그 사이에 죽었다.`
              : `내가 물러섰고, ${topic(subject.identity.name)} 거기서 죽었다.`,
        });
        addGoalFromMemory(actor, memory.memoryId, tick);
      }
    }

    /*
     * 죽음을 목격하면 기억이 남는다.
     *
     * 이 블록이 없던 동안 `witnessed_ally_death` 태그는 정의되고 L1 가중치까지 있는데
     * 아무도 만들지 않았다 — 동료가 눈앞에서 죽어도 아무 기억이 안 남았다.
     * "그 역사 때문에 다음 캐릭터의 행동이 달라진다"는 전제와 정면으로 어긋난다.
     *
     * 내 탓인 경우(ally_died_unrescued)와는 다른 사실이므로 태그를 따로 둔다.
     * 같은 사건에 두 기억을 겹쳐 쌓지 않도록, 방치로 죽은 대상에 대해서는 목격 기억을 남기지 않는다.
     */
    for (const victimId of died) {
      const victim = world.instance(victimId);
      const abandoned = !rescued && victimId === subject.instanceId;

      const observers: CharacterInstance[] = request.decisions
        .map((d) => world.instance(d.actor))
        .filter((actor) => actor.status === 'alive' && actor.instanceId !== victimId);

      // 구조된 당사자도 목격자다 — 나를 구하다 죽은 사람을 잊지 않는다
      if (rescued && subject.status === 'alive' && subject.instanceId !== victimId) {
        observers.push(subject);
      }

      for (const observer of observers) {
        if (abandoned) continue;
        addMemory(world, observer, {
          tag: 'witnessed_ally_death',
          importance: OUTCOME.witnessMemoryImportance,
          tick,
          subject: victimId,
          text: `${topic(victim.identity.name)} 눈앞에서 죽었다.`,
        });
      }
    }

    world.events.append({
      kind: 'MissionOutcome',
      tick,
      participants: [...request.decisions.map((d) => d.actor), subject.instanceId],
      outcome: died.length === 0 ? 'success' : 'partial',
      summary: request.decisions
        .map((d) => `${world.instance(d.actor).identity.name}:${d.action}`)
        .join(' '),
    });

    return {
      died,
      damageByActor,
      rescued,
      events: world.events.all().slice(before),
    };
  },
};

function raiseTrust(
  world: World,
  holder: CharacterInstance,
  target: InstanceId,
  delta: number,
  tick: number,
  cause: string,
): void {
  let relationship = holder.relationships.find((r) => r.target === target);
  if (!relationship) {
    relationship = { target, trust: 50 };
    holder.relationships.push(relationship);
  }
  const trustBefore = relationship.trust;
  relationship.trust = clamp(trustBefore + delta, 0, 100);

  world.events.append({
    kind: 'RelationshipChange',
    tick,
    from: holder.instanceId,
    to: target,
    trustBefore,
    trustAfter: relationship.trust,
    cause,
  });
}

/**
 * 기억을 남긴다. 같은 태그·같은 대상의 기억이 이미 있으면 **새로 쌓지 않고 강화한다.**
 *
 * 10층을 오르면 같은 종류의 사건이 여러 번 일어난다. 그때마다 항목을 추가하면
 * Instance가 중복 기억으로 부풀고 Snapshot도 같이 커진다(OPEN-QUESTIONS 6-3).
 * 사람의 기억도 같은 일이 반복되면 개별 사건이 아니라 하나의 강한 인상으로 남는다.
 *
 * 강화는 새로운 사건이 아니므로 MajorMemory Event를 다시 남기지 않는다 —
 * Event Log는 중요한 **변화**를 기록하고, 현재 상태는 Snapshot이 갖는다.
 */
function addMemory(
  world: World,
  owner: CharacterInstance,
  args: {
    tag: MemoryTag;
    importance: number;
    tick: number;
    subject?: InstanceId;
    text: string;
  },
): MemoryEntry {
  const existingIndex = owner.memory.findIndex(
    (m) => m.tag === args.tag && m.subject === args.subject,
  );
  if (existingIndex >= 0) {
    const existing = owner.memory[existingIndex]!;
    const reinforced: MemoryEntry = {
      ...existing,
      importance: clamp(existing.importance + OUTCOME.memoryReinforcement, 0, 100),
      atTick: args.tick,
    };
    owner.memory[existingIndex] = reinforced;
    return reinforced;
  }

  const entry: MemoryEntry = {
    memoryId: memoryId(String(world.ids.next()).padStart(4, '0')),
    kind: args.subject ? 'Social' : 'Episodic',
    tag: args.tag,
    importance: args.importance,
    atTick: args.tick,
    subject: args.subject,
    text: args.text,
  };
  owner.memory.push(entry);

  world.events.append({
    kind: 'MajorMemory',
    tick: args.tick,
    owner: owner.instanceId,
    memoryId: entry.memoryId,
    tag: entry.tag,
    importance: entry.importance,
  });

  return entry;
}

/**
 * 기억 → 목표. 이 함수가 "기억이 판단을 바꾼다"의 유일한 경로다.
 * 생성된 목표는 L0 규칙 2에서 효용 계산을 덮어쓴다.
 */
function addGoalFromMemory(owner: CharacterInstance, source: MemoryId, tick: number): void {
  const already = owner.goals.some((g) => g.kind === 'never_abandon_ally');
  if (already) return;
  owner.goals.push({
    goalId: goalId(`${owner.instanceId}_never_abandon`),
    kind: 'never_abandon_ally',
    priority: OUTCOME.neverAbandonGoalPriority,
    sourceMemory: source,
    createdAtTick: tick,
  });
}

/** CORE CONTRACT 규칙 7 — 죽음은 최종. 삭제하지 않고 dead로 남긴다. */
function killInstance(
  world: World,
  victim: CharacterInstance,
  cause: 'killed_by_enemy' | 'abandoned',
  witnesses: readonly InstanceId[],
  tick: number,
): void {
  victim.status = 'dead';
  victim.needs.health = 0;
  victim.legacy.diedAtTick = tick;

  world.events.append({
    kind: 'Death',
    tick,
    subject: victim.instanceId,
    cause,
    witnesses,
  });

  world.events.append({
    kind: 'LegacyCreation',
    tick,
    from: victim.instanceId,
    relics: victim.legacy.relics,
    inheritedMemories: victim.memory
      .filter((m) => m.importance >= 70)
      .map((m) => m.memoryId),
  });
}
