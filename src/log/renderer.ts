/**
 * 텍스트 로그 렌더러.
 *
 * CORE CONTRACT 규칙 6: 플레이어용 로그와 디버거는 **같은 ReasonCode에서** 렌더링한다.
 * 두 함수가 서로 다른 데이터를 보지 않게 하려고 둘 다 Decision 하나만 입력으로 받는다.
 *
 * 여기 있는 문장은 전부 규칙 기반이다. LLM을 붙이면 이 문장이 캐릭터 시점으로
 * 풍부해지지만, LLM을 끄면 이 문장이 그대로 쓰이고 게임은 동일하게 돌아간다.
 */

import type { AgentState } from '../core/agentState.js';
import type { CharacterInstance } from '../core/instance.js';
import type { Decision } from '../decision/decide.js';
import { formatReason } from '../decision/reason.js';
import type { Situation } from '../decision/situation.js';
import { object, topic } from './josa.js';

export interface RenderContext {
  readonly actor: CharacterInstance;
  readonly subject: CharacterInstance;
  readonly decision: Decision;
  readonly situation: Situation;
  /**
   * 판단 시점의 입력. 행동이 Instance를 바꾸므로 여기서 actor를 읽으면
   * ReasonCode 옆에 행동 **후** 수치가 찍힌다 — 디버거가 거짓말을 하게 된다.
   */
  readonly state: AgentState;
}

/** 플레이어가 보는 두 줄. */
export function playerLines(ctx: RenderContext): string[] {
  const { actor, decision } = ctx;
  return [
    `[tick ${ctx.situation.tick}] ${actor.identity.name} — ${formatReason(decision.reason)}`,
    `            ${narrate(ctx)}`,
  ];
}

/** 개발/QA가 보는 블록. 같은 ReasonCode + 효용 점수. */
export function debuggerLines(ctx: RenderContext): string[] {
  const { actor, decision, state } = ctx;
  const lines = [
    `  ${actor.identity.name} [${actor.instanceId}] layer=${decision.reason.layer}  (판단 시점 State)`,
    `    reason   ${formatReason(decision.reason)}`,
    `    state    health_ratio=${state.healthRatio.toFixed(2)} fear=${state.fear} ` +
      `trust=${state.trustInSubject} self_risk=${Math.round(state.selfRisk)}`,
    `    memory   ${state.memoryInfluences.length === 0 ? '(없음)' : state.memoryInfluences.map((m) => `${m.tag}(${m.importance})`).join(', ')}`,
    `    goals    ${state.goals.length === 0 ? '(없음)' : state.goals.map((g) => `${g.kind}(${g.priority})`).join(', ')}`,
  ];
  if (decision.scores) {
    const scores = [...decision.scores]
      .sort((a, b) => b.score - a.score)
      .map((s) => `${s.action}=${s.score.toFixed(1)}`)
      .join('  ');
    lines.push(`    utility  ${scores}`);
  } else {
    lines.push(`    utility  (L0에서 결정되어 계산하지 않음)`);
  }
  return lines;
}

function narrate(ctx: RenderContext): string {
  return narrateAction(ctx.actor, ctx.subject, ctx.decision);
}

/**
 * 행동 한 줄. 화면(웹/Unity)과 텍스트 로그가 같은 문장을 쓰게 하기 위해 분리했다.
 * 판단에서 나온 것만 읽는다 — 점수나 내부 수치는 보지 않는다.
 */
export function narrateAction(
  actor: CharacterInstance,
  subject: CharacterInstance,
  decision: Decision,
): string {
  const goalDriven = decision.reason.factors.some((f) => f.key === 'goal');
  const memoryDriven = decision.reason.factors.some((f) => f.key === 'memory');

  switch (decision.reason.action) {
    case 'RESCUE':
      if (goalDriven) {
        const smoke = decision.plan?.steps.includes('SUPPRESS') === true;
        return `${topic(actor.identity.name)} 두려움에도 몸이 먼저 움직였다. `
          + `${smoke ? '교란기를 터뜨리고 들어갔다.' : '다시는 그러지 않겠다고 정했기 때문이다.'}`;
      }
      return `${topic(actor.identity.name)} ${object(subject.identity.name)} 끌어내려 적 앞으로 들어갔다.`;
    case 'RETREAT':
      if (memoryDriven) {
        return `${topic(actor.identity.name)} 또 물러섰다. 지난번의 상처가 발을 멈춰 세웠다.`;
      }
      return `${topic(actor.identity.name)} ${object(subject.identity.name)} 두고 물러섰다.`;
    case 'HOLD':
      return `${topic(actor.identity.name)} 자리를 지켰다. 명령이 그랬다.`;
    case 'ATTACK':
      return `${topic(actor.identity.name)} 적에게 달려들었다.`;
  }
}

/** Event 로그를 사람이 읽는 줄로. */
export function eventLine(event: {
  kind: string;
  tick: number;
  [key: string]: unknown;
}): string {
  const detail = Object.entries(event)
    .filter(([k]) => !['kind', 'tick', 'eventId', 'seq'].includes(k))
    .map(([k, v]) => `${k}=${Array.isArray(v) ? `[${v.join('|')}]` : String(v)}`)
    .join(' ');
  return `  #${String(event['seq'])} tick${event.tick} ${event.kind} ${detail}`;
}
