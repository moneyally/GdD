/**
 * Memory / Relationship이 판단을 바꾸는 비교표 생성기 (브리핑 5절).
 *
 *   npm run compare              마크다운 표 출력
 *
 * 한 축만 바꾸고 나머지를 고정한다. "기억 때문에 달라졌다"를 주장하려면
 * 기억 외의 모든 입력이 같아야 하기 때문이다.
 *
 * 이 도구는 AgentState를 직접 구성한다. AgentState는 저장되지 않는 파생 타입이고
 * 세계 상태를 건드리지 않으므로 규칙 4(트랜잭션 경유)의 대상이 아니다.
 * 세계를 바꾸는 비교가 필요해지면 그때는 소환 트랜잭션을 거쳐야 한다.
 */

import type { AgentState, MemoryInfluence } from '../core/agentState.js';
import { goalId, instanceId, memoryId } from '../core/ids.js';
import type { Goal, Personality } from '../core/instance.js';
import { decide } from '../decision/decide.js';
import { formatReason } from '../decision/reason.js';
import { SCENARIO } from '../scenario/coreGameplay.js';
import { tolerableThreat } from '../decision/goapActions.js';

/** 성격을 고정한다 — 성격 차이가 결과를 흐리지 않게 하려는 통제 변수 */
const FIXED_PERSONALITY: Personality = {
  risk: 50,
  loyalty: 70,
  sociability: 50,
  aggression: 55,
  honesty: 60,
};

const SUBJECT = instanceId('9001');

const ABANDON_MEMORY: MemoryInfluence = {
  tag: 'ally_died_unrescued',
  importance: 90,
  memoryId: memoryId('9001'),
};

const NEVER_ABANDON_GOAL: Goal = {
  goalId: goalId('cmp_never_abandon'),
  kind: 'never_abandon_ally',
  priority: 85,
  sourceMemory: memoryId('9001'),
  createdAtTick: 0,
};

interface Variant {
  readonly fear: number;
  readonly trust: number;
  readonly healthRatio: number;
  readonly withMemory: boolean;
}

function buildState(v: Variant): AgentState {
  const injuryMultiplier = 1 + (1 - v.healthRatio) * 0.6;
  return {
    self: instanceId('9000'),
    personality: FIXED_PERSONALITY,
    healthRatio: v.healthRatio,
    fear: v.fear,
    subject: SUBJECT,
    trustInSubject: v.trust,
    selfRisk: Math.min(100, SCENARIO.enemyThreat * injuryMultiplier),
    stamina: v.healthRatio * 100,
    hasSuppressor: true,
    memoryInfluences: v.withMemory ? [ABANDON_MEMORY] : [],
    goals: v.withMemory ? [NEVER_ABANDON_GOAL] : [],
    order: SCENARIO.order,
    tick: 0,
  };
}

function cell(v: Variant): string {
  const decision = decide(buildState(v));
  const plan = decision.plan ? ` ${decision.plan.steps.join('→')}` : '';
  return `${decision.reason.action} \`${decision.reason.layer}\`${plan}`;
}

function table(title: string, note: string, rows: readonly Variant[]): string {
  const lines = [
    `### ${title}`,
    '',
    note,
    '',
    '| fear | trust(동료) | 체력 | 기억 없음 | 기억 있음 (`ally_died_unrescued` 90 + 목표) |',
    '|---|---|---|---|---|',
  ];
  for (const row of rows) {
    lines.push(
      `| ${row.fear} | ${row.trust} | ${row.healthRatio.toFixed(2)} | ` +
        `${cell({ ...row, withMemory: false })} | ${cell({ ...row, withMemory: true })} |`,
    );
  }
  return lines.join('\n');
}

function reasonSamples(): string {
  const samples: readonly { readonly label: string; readonly variant: Variant }[] = [
    {
      label: '신뢰 높고 침착 · 기억 없음',
      variant: { fear: 20, trust: 80, healthRatio: 1, withMemory: false },
    },
    {
      label: '겁많고 불신 · 기억 없음',
      variant: { fear: 80, trust: 20, healthRatio: 1, withMemory: false },
    },
    {
      label: '겁많고 불신 · **기억 있음**',
      variant: { fear: 80, trust: 20, healthRatio: 1, withMemory: true },
    },
    {
      label: '부상 · **기억 있음** (연막이 계획에 들어온다)',
      variant: { fear: 20, trust: 20, healthRatio: 0.6, withMemory: true },
    },
    {
      label: '중상 · **기억 있음** (계획 불가 → 목표 포기)',
      variant: { fear: 20, trust: 20, healthRatio: 0.4, withMemory: true },
    },
  ];

  const lines = ['### ReasonCode 샘플', ''];
  for (const sample of samples) {
    const state = buildState(sample.variant);
    lines.push(`- ${sample.label}`);
    lines.push(`  \`\`\``);
    lines.push(`  ${formatReason(decide(state).reason)}`);
    lines.push(`  \`\`\``);
  }
  return lines.join('\n');
}

function thresholds(): string {
  const lines = [
    '### 계획 가능 경계 — 부상과 공포가 계획을 바꾸는 지점',
    '',
    '부상은 두 방향으로 작용한다. 체감 위협(`self_risk`)을 올리고, 동시에 감당하겠다고',
    '판단하는 상한(`tolerable`)을 내린다. 공포는 상한만 내린다.',
    '둘이 교차하면 맨몸 구조가 불가능해져 연막이 계획에 들어오고, 더 벌어지면 계획이 사라진다.',
    '',
    '아래는 기억(목표)을 가진 상태에서 체력과 공포만 바꾼 결과다.',
    '',
    '| 체력 | self_risk | tolerable (fear=20) | 계획 (fear=20) | tolerable (fear=80) | 계획 (fear=80) |',
    '|---|---|---|---|---|---|',
  ];
  for (const healthRatio of [1, 0.8, 0.6, 0.5, 0.4]) {
    const calm = buildState({ fear: 20, trust: 20, healthRatio, withMemory: true });
    const afraid = buildState({ fear: 80, trust: 20, healthRatio, withMemory: true });
    const planOf = (state: AgentState): string => {
      const plan = decide(state).plan;
      return plan ? plan.steps.join('→') : '없음 → 포기';
    };
    lines.push(
      `| ${healthRatio.toFixed(2)} | ${Math.round(calm.selfRisk)} | ` +
        `${Math.round(tolerableThreat(calm))} | ${planOf(calm)} | ` +
        `${Math.round(tolerableThreat(afraid))} | ${planOf(afraid)} |`,
    );
  }
  return lines.join('\n');
}

const out = [
  '# 비교표 — Memory / Relationship이 판단을 바꾸는가',
  '',
  '`npm run compare`로 생성. 성격은 고정(risk=50, loyalty=70, aggression=55)하고',
  `상황도 고정(위협도 ${SCENARIO.enemyThreat}, 명령 goal=${SCENARIO.order.goal},`,
  `퇴각조건 체력 ${SCENARIO.order.retreatCondition.healthRatioBelow} 미만)했다.`,
  '즉 아래 표에서 결과를 가르는 것은 **감정 · 관계 · 기억 · 체력뿐**이다.',
  '',
  table(
    'fear × trust (건강한 상태)',
    '기억이 없으면 **신뢰와 침착이 둘 다 있어야** 구하러 간다. 하나라도 부족하면 물러선다.\n' +
      '기억이 생기면 네 경우 모두 구하러 간다 — 단, L1 효용이 아니라 L2 계획으로 간다.',
    [
      { fear: 20, trust: 80, healthRatio: 1, withMemory: false },
      { fear: 80, trust: 20, healthRatio: 1, withMemory: false },
      { fear: 80, trust: 80, healthRatio: 1, withMemory: false },
      { fear: 20, trust: 20, healthRatio: 1, withMemory: false },
    ],
  ),
  '',
  table(
    '체력 × 기억 (fear=20 고정)',
    '기억이 있으면 방법을 찾는다. 몸이 상하면 계획에 연막이 들어오고,\n' +
      '더 상하면 계획 자체가 사라진다. 계획이 사라져도 기억은 L1 효용에 남아 있으므로\n' +
      '체력 0.50에서는 **계획 없이 감정만으로** 뛰어들고, 0.40에서는 결국 물러선다.\n' +
      '기억은 캐릭터를 무적으로 만들지 않는다.',
    [
      { fear: 20, trust: 20, healthRatio: 1, withMemory: false },
      { fear: 20, trust: 20, healthRatio: 0.8, withMemory: false },
      { fear: 20, trust: 20, healthRatio: 0.6, withMemory: false },
      { fear: 20, trust: 20, healthRatio: 0.5, withMemory: false },
      { fear: 20, trust: 20, healthRatio: 0.4, withMemory: false },
    ],
  ),
  '',
  thresholds(),
  '',
  reasonSamples(),
  '',
  '---',
  '',
  '## 읽는 법',
  '',
  '- `L1` — 단일 행동의 효용 비교로 결정. 감정과 관계가 직접 작용한다',
  '- `L2` — 기억에서 나온 목표가 있어 계획을 세웠다. 화살표가 계획의 순서다',
  '- `L0` — 하드 규칙(Master 퇴각 조건 등)이 판단을 확정했다',
  '',
  '기억 열은 **한 칸만 다르다**. 같은 감정, 같은 관계, 같은 체력, 같은 명령에서',
  '기억 하나가 행동을 바꾸는 것이 이 표의 주장이다.',
  '',
].join('\n');

console.log(out);
