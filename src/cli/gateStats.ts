/**
 * 차원문 선택이 실제 결정인지 측정한다.
 *
 *   npm run gates:stats             시드 80개
 *   npm run gates:stats -- 300      시드 수 지정
 *
 * 판정 기준:
 * - 전략마다 결과가 **다르면** 문 선택은 결정이다
 * - "안전탐욕"이 최고 성적이면 위상압이 제 역할을 못 하는 것이다 (편한 길만 골라도 됨)
 * - "보급미사용"과 "적응형"이 같으면 보급은 장식이다
 * - 한 문만 고르는 전략이 적응형을 이기면 고민할 이유가 없는 게임이다
 */

import { World } from '../core/world.js';
import { runTransaction } from '../core/transaction.js';
import { ALL_DEFINITIONS, SCOUT, VANGUARD } from '../data/definitions.js';
import {
  FormPartyTransaction,
  runGateTower,
  type Echo,
  type GateKey,
  type GateStrategy,
} from '../mission/gates.js';
import { ADAPTIVE as ADAPTIVE_STRATEGY, ALL_STRATEGIES } from '../mission/gateStrategies.js';
import { runCampaign } from '../mission/campaign.js';
import { summon } from '../scenario/coreGameplay.js';
import { TOWER_RUN } from '../scenario/towerRun.js';
import { TOWER } from '../mission/tower.js';

const seedCount = Number(process.argv[2] ?? 80);
if (!Number.isFinite(seedCount) || seedCount < 1) {
  throw new Error(`시드 수가 올바르지 않다: ${process.argv[2]}`);
}

interface Measured {
  readonly avgDepth: number;
  readonly clearRate: number;
  readonly avgDeaths: number;
  readonly wipeRate: number;
  readonly avgPressure: number;
  readonly gateMix: Readonly<Record<GateKey, number>>;
  /** L2 계획이 실행된 좌표 수 합계 — 기억이 판단을 바꾼 횟수 */
  readonly planningDepths: number;
}

function buildParty(world: World) {
  const party = [
    summon(world, VANGUARD.definitionId),
    summon(world, VANGUARD.definitionId),
    summon(world, SCOUT.definitionId),
    summon(world, SCOUT.definitionId),
  ];
  const formed = runTransaction(world, FormPartyTransaction, {
    members: party.map((c) => c.instanceId),
    baseTrust: TOWER_RUN.baseTrust,
  });
  if (!formed.ok) throw new Error(formed.error);
  return party;
}

function measure(strategy: GateStrategy, echoes: readonly Echo[] = []): Measured {
  let depth = 0;
  let cleared = 0;
  let deaths = 0;
  let wiped = 0;
  let pressure = 0;
  let planningDepths = 0;
  const gateMix: Record<GateKey, number> = { aligned: 0, warped: 0, deep: 0 };

  for (let i = 0; i < seedCount; i += 1) {
    const world = World.create(TOWER_RUN.seed + i * 7, ALL_DEFINITIONS);
    const party = buildParty(world);
    const result = runGateTower({
      world,
      party: party.map((c) => c.instanceId),
      order: TOWER_RUN.order,
      strategy,
      echoes,
    });

    depth += result.deepestDepth;
    deaths += result.deaths.length;
    pressure += result.finalPressure;
    if (result.cleared) cleared += 1;
    if (result.abortReason === 'party_wiped') wiped += 1;
    for (const g of result.gatesTaken) gateMix[g] += 1;
    planningDepths += result.floors.filter((f) =>
      f.decisions.some((d) => d.decision.reason.layer === 'L2'),
    ).length;
  }

  const totalGates = gateMix.aligned + gateMix.warped + gateMix.deep || 1;
  return {
    avgDepth: depth / seedCount,
    clearRate: (cleared / seedCount) * 100,
    avgDeaths: deaths / seedCount,
    wipeRate: (wiped / seedCount) * 100,
    avgPressure: pressure / seedCount,
    gateMix: {
      aligned: (gateMix.aligned / totalGates) * 100,
      warped: (gateMix.warped / totalGates) * 100,
      deep: (gateMix.deep / totalGates) * 100,
    },
    planningDepths,
  };
}

console.log('');
console.log(`차원문 ${TOWER.floors}좌표 · 파티 4명 · 시드 ${seedCount}개`);
console.log('');

const rows = ALL_STRATEGIES.map((s) => ({ strategy: s, m: measure(s) }));

const header = ['전략'.padEnd(12), '평균도달', '클리어', '사망', '전멸', '최종압', 'L2', '문 비율(정렬/뒤틀림/심층)'];
console.log(header.join('  '));
console.log('─'.repeat(92));
for (const { strategy, m } of rows) {
  console.log([
    strategy.name.padEnd(12),
    `${m.avgDepth.toFixed(1)}`.padStart(8),
    `${m.clearRate.toFixed(0)}%`.padStart(6),
    `${m.avgDeaths.toFixed(2)}`.padStart(5),
    `${m.wipeRate.toFixed(0)}%`.padStart(5),
    `${m.avgPressure.toFixed(0)}`.padStart(6),
    `${m.planningDepths}`.padStart(3),
    `   ${m.gateMix.aligned.toFixed(0)}/${m.gateMix.warped.toFixed(0)}/${m.gateMix.deep.toFixed(0)}`,
  ].join('  '));
}

/* ── 판정 ── */
console.log('');
console.log('판정');
console.log('─'.repeat(84));

const best = rows.reduce((a, b) => (b.m.clearRate > a.m.clearRate ? b : a));
const worst = rows.reduce((a, b) => (b.m.clearRate < a.m.clearRate ? b : a));
const spread = best.m.clearRate - worst.m.clearRate;

console.log(
  `  클리어율 폭  ${spread.toFixed(0)}%p  (${best.strategy.name} ${best.m.clearRate.toFixed(0)}% ↔ ` +
    `${worst.strategy.name} ${worst.m.clearRate.toFixed(0)}%)`,
);
console.log(
  spread >= 20
    ? '  → 문 선택이 결과를 크게 바꾼다. 결정으로 성립한다.'
    : spread >= 8
      ? '  → 차이는 있지만 작다. 문별 보정을 키우거나 위상압 비중을 올릴 여지가 있다.'
      : '  → 문 선택이 결과를 거의 바꾸지 않는다. 지금은 장식이다.',
);

const adaptive = rows.find((r) => r.strategy.name === '적응형')!;
const greedy = rows.find((r) => r.strategy.name === '안전탐욕')!;
const noSupply = rows.find((r) => r.strategy.name === '보급미사용')!;

console.log('');
console.log(
  `  안전탐욕 대비 적응형  ${(adaptive.m.clearRate - greedy.m.clearRate).toFixed(0)}%p`,
);
console.log(
  greedy.m.clearRate >= adaptive.m.clearRate
    ? '  → 편한 길만 골라도 된다. 위상압이 제 역할을 못 한다.'
    : '  → 안전만 사면 위상압에 잡힌다. 교환이 작동한다.',
);

console.log('');
console.log(
  `  보급 사용 효과  ${(adaptive.m.clearRate - noSupply.m.clearRate).toFixed(0)}%p`,
);
console.log(
  adaptive.m.clearRate - noSupply.m.clearRate >= 10
    ? '  → 보급 배분이 결과를 바꾼다. 아까운 자원이 맞다.'
    : '  → 보급이 결과에 거의 영향을 주지 않는다. 효과를 키우거나 개수를 줄여야 한다.',
);

/* ── 잔상 효과 ── */
const seeded: Echo[] = [
  { depth: 4, name: '이전등반자', grants: 'suppressor' },
  { depth: 7, name: '이전등반자', grants: 'stabilizer' },
];
const withEchoes = measure(ALL_STRATEGIES.find((s) => s.name === '적응형')!, seeded);

console.log('');
console.log(
  `  잔상 2개가 있을 때 적응형  ${withEchoes.clearRate.toFixed(0)}% ` +
    `(없을 때 ${adaptive.m.clearRate.toFixed(0)}%)`,
);
console.log(
  withEchoes.clearRate > adaptive.m.clearRate
    ? '  → 이전 등반자의 실패가 다음 등반을 돕는다. 메타 진행이 작동한다.'
    : '  → 잔상이 도움이 되지 않는다. 회수 보상을 키워야 한다.',
);

/* ── 캠페인: 기억이 판단을 바꾸는 경로가 열리는가 ── */
console.log('');
console.log(`  단일 등반에서 L2(기억→계획)가 실행된 좌표: ${adaptive.m.planningDepths}개`);
console.log(
  adaptive.m.planningDepths === 0
    ? '  → 한 번의 등반만으로는 기억이 판단을 바꾸는 경로가 열리지 않는다.'
    : '  → 단일 등반에서도 기억이 판단을 바꾼다.',
);

const campaignSeeds = Math.max(6, Math.floor(seedCount / 4));
function campaignPlanning(fatigueRecovered: number): { plans: number; runs: number } {
  let plans = 0;
  let runs = 0;
  for (let i = 0; i < campaignSeeds; i += 1) {
    const world = World.create(TOWER_RUN.seed + 900 + i * 11, ALL_DEFINITIONS);
    const campaign = runCampaign({
      world,
      order: TOWER_RUN.order,
      strategy: ADAPTIVE_STRATEGY,
      attempts: 4,
      camp: { fatigueRecovered },
    });
    for (const a of campaign.attempts) { plans += a.planningDepths; runs += 1; }
  }
  return { plans, runs };
}

const noRest = campaignPlanning(0);
const rested = campaignPlanning(1);

console.log('');
console.log(`  캠페인 4회차 × 시드 ${campaignSeeds}개`);
console.log(`    캠프에서 피로 회복 없음:  L2 좌표 ${noRest.plans}개 (${noRest.runs}회 등반)`);
console.log(`    캠프에서 피로 완전 회복:  L2 좌표 ${rested.plans}개 (${rested.runs}회 등반)`);
console.log(
  rested.plans > noRest.plans * 2 + 1
    ? '  → 생존자를 데려가고 쉬게 하는 것이 기억→판단 경로를 여는 스위치다.'
    : '  → 캠프 회복이 경로를 열지 못한다. 다른 원인을 봐야 한다.',
);
console.log('');
