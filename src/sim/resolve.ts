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
} as const;

export interface ResolveRequest {
  readonly actor: InstanceId;
  readonly action: Action;
  readonly situation: Situation;
  /**
   * L2가 세운 계획. 있으면 계획대로 수행한다.
   * 연막이 포함되면 실제 위협이 줄어 피해도 줄어든다 — 계획한 캐릭터는 덜 다친다.
   */
  readonly plan?: readonly PlanStep[];
}

export interface ResolveResult {
  readonly actor: InstanceId;
  readonly action: Action;
  /** 이 행동으로 죽은 캐릭터 */
  readonly died: readonly InstanceId[];
  /** 실제로 입은 피해. 계획에 따라 달라진다 */
  readonly damageTaken: number;
  readonly events: readonly WorldEvent[];
}

export const ResolveTransaction: Transaction<ResolveRequest, ResolveResult> = {
  name: 'ResolveAction',

  validate(world, request): string | undefined {
    const actor = world.find(request.actor);
    if (!actor) return `알 수 없는 Instance: ${request.actor}`;
    if (actor.status !== 'alive') return `죽은 캐릭터는 행동할 수 없다: ${request.actor}`;
    const subject = world.find(request.situation.subject);
    if (!subject) return `알 수 없는 대상: ${request.situation.subject}`;
    return undefined;
  },

  apply(world, request): ResolveResult {
    const before = world.events.length;
    const actor = world.instance(request.actor);
    const subject = world.instance(request.situation.subject);
    const tick = request.situation.tick;
    const died: InstanceId[] = [];
    let damageTaken = 0;

    switch (request.action) {
      case 'RESCUE':
      case 'ATTACK': {
        // 동료는 살아남고 행동자가 피해를 입는다
        const threat = effectiveThreat(request.situation.enemyThreat, request.plan ?? []);
        const damage = Math.round(threat * OUTCOME.rescueDamageRatio);
        damageTaken = damage;
        actor.needs.health = clamp(actor.needs.health - damage, 0, actor.needs.maxHealth);
        actor.emotion.fear = clamp(
          actor.emotion.fear + Math.round(damage * OUTCOME.rescueFearGainRatio),
          0,
          100,
        );

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
        break;
      }

      case 'RETREAT':
      case 'HOLD': {
        // 아무도 구하지 않았으므로 쓰러진 동료는 죽는다
        actor.emotion.fear = clamp(actor.emotion.fear - OUTCOME.retreatFearDecay, 0, 100);
        killInstance(world, subject, 'abandoned', [actor.instanceId], tick);
        died.push(subject.instanceId);

        // 목격 + 자신의 선택이 원인 → 기억이 생기고, 기억이 목표를 만든다
        const memory = addMemory(world, actor, {
          tag: 'ally_died_by_my_retreat',
          importance: OUTCOME.abandonMemoryImportance,
          tick,
          subject: subject.instanceId,
          text: `내가 물러섰고, ${topic(subject.identity.name)} 거기서 죽었다.`,
        });
        addGoalFromMemory(actor, memory.memoryId, tick);
        break;
      }
    }

    world.events.append({
      kind: 'MissionOutcome',
      tick,
      participants: [actor.instanceId, subject.instanceId],
      outcome: died.length === 0 ? 'success' : 'partial',
      summary: `${actor.identity.name}: ${request.action}`,
    });

    return {
      actor: request.actor,
      action: request.action,
      died,
      damageTaken,
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
