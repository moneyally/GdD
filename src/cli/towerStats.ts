/**
 * 등반 결과 분포 — Master 명령이 실제로 레버인지 보는 도구.
 *
 *   npm run tower:stats            기본 60회 × 12조합
 *   npm run tower:stats -- 200     시드 수 지정
 *
 * 이 도구가 필요한 이유: 층 하나하나의 로그를 읽어서는 "10층이 도달 가능한가",
 * "명령을 바꾸면 결과가 바뀌는가"를 알 수 없다. 실제로 이 도구가 클리어율 0%
 * (상위 3층이 죽은 콘텐츠인 상태)를 찾아냈고, 수정 후 회복을 검증했다.
 *
 * 밸런스 수치를 바꾼 뒤에는 이걸 돌려서 표가 어떻게 움직이는지 확인한다.
 */

import { World } from '../core/world.js';
import type { MasterOrder, RiskPolicy } from '../core/order.js';
import { ALL_DEFINITIONS } from '../data/definitions.js';
import { runTower, TOWER } from '../mission/tower.js';
import { buildParty, TOWER_RUN } from '../scenario/towerRun.js';

const POLICIES: readonly RiskPolicy[] = ['cautious', 'balanced', 'aggressive'];
const RETREAT_LINES: readonly number[] = [0, 0.25, 0.4, 0.6];

const seedCount = Number(process.argv[2] ?? 60);
if (!Number.isFinite(seedCount) || seedCount < 1) {
  throw new Error(`시드 수가 올바르지 않다: ${process.argv[2]}`);
}

interface Cell {
  readonly avgDepth: number;
  readonly clearRate: number;
  readonly avgDeaths: number;
}

function measure(riskPolicy: RiskPolicy, healthRatioBelow: number): Cell {
  let depth = 0;
  let cleared = 0;
  let deaths = 0;

  for (let i = 0; i < seedCount; i += 1) {
    const world = World.create(TOWER_RUN.seed + i * 7, ALL_DEFINITIONS);
    const party = buildParty(world);
    const order: MasterOrder = {
      goal: 'advance',
      riskPolicy,
      retreatCondition: { healthRatioBelow },
    };
    const result = runTower(
      world,
      party.map((c) => c.instanceId),
      order,
    );
    depth += result.deepestFloor;
    deaths += result.deaths.length;
    if (result.cleared) cleared += 1;
  }

  return {
    avgDepth: depth / seedCount,
    clearRate: (cleared / seedCount) * 100,
    avgDeaths: deaths / seedCount,
  };
}

console.log('');
console.log(`탑 ${TOWER.floors}층 · 파티 4명 · 시드 ${seedCount}개`);
console.log('각 칸: 평균 도달층 / 클리어율 / 평균 사망자');
console.log('');

const header = ['retreat\\risk'.padEnd(14), ...POLICIES.map((p) => p.padEnd(22))].join('');
console.log(header);
console.log('─'.repeat(header.length));

for (const line of RETREAT_LINES) {
  const cells = POLICIES.map((policy) => {
    const c = measure(policy, line);
    return `${c.avgDepth.toFixed(1)}층 ${c.clearRate.toFixed(0).padStart(3)}% ${c.avgDeaths.toFixed(2)}명`.padEnd(
      22,
    );
  });
  console.log((line === 0 ? '없음' : `< ${line}`).padEnd(14) + cells.join(''));
}

console.log('');
console.log('읽는 법:');
console.log('  riskPolicy       → 클리어율을 움직인다 (cautious가 가장 높다)');
console.log('  retreatCondition → 사망자 수를 움직인다 (선이 높으면 덜 죽고 덜 올라간다)');
console.log('  즉 Master는 "얼마나 깊이" 와 "얼마나 잃고" 를 교환한다.');
console.log('');

// 도달 층 분포도 한 번 보여준다 — 기본 명령 기준
const dist = new Map<number, number>();
for (let i = 0; i < seedCount; i += 1) {
  const world = World.create(TOWER_RUN.seed + i * 7, ALL_DEFINITIONS);
  const party = buildParty(world);
  const result = runTower(
    world,
    party.map((c) => c.instanceId),
    TOWER_RUN.order,
  );
  dist.set(result.deepestFloor, (dist.get(result.deepestFloor) ?? 0) + 1);
}

console.log(`도달 층 분포 (기본 명령: ${TOWER_RUN.order.riskPolicy}, 퇴각선 ${TOWER_RUN.order.retreatCondition.healthRatioBelow})`);
for (const floor of [...dist.keys()].sort((a, b) => a - b)) {
  const count = dist.get(floor)!;
  console.log(`  ${String(floor).padStart(2)}층  ${'█'.repeat(count)} ${count}`);
}
console.log('');
