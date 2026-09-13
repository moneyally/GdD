/**
 * 탑 등반 로그.
 *
 *   npm run tower           기본 시드로 1회 등반
 *   npm run tower -- 1234   시드 지정
 *
 * 판단 로직은 없다 — Decision과 Event만 읽어서 출력한다 (렌더러 규칙).
 */

import { formatReason } from '../decision/reason.js';
import { topic } from '../log/josa.js';
import { TOWER, floorKey } from '../mission/tower.js';
import { runTowerScenario, TOWER_RUN } from '../scenario/towerRun.js';

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 58 - title.length))}`);
}

const seedArg = process.argv[2];
const seed = seedArg ? Number(seedArg) : TOWER_RUN.seed;
if (Number.isNaN(seed)) throw new Error(`시드가 숫자가 아니다: ${seedArg}`);

const { world, party, result } = runTowerScenario(seed);

section(`파티 편성 (seed=${seed})`);
for (const c of party) {
  console.log(
    `  ${c.identity.name.padEnd(4)} [${c.instanceId}] ${c.identity.definitionId.padEnd(14)} ` +
      `risk=${String(c.personality.risk).padStart(2)} loyalty=${String(c.personality.loyalty).padStart(2)} ` +
      `hp=${c.needs.maxHealth}`,
  );
}

section('등반');
for (const floor of result.floors) {
  const mark = floor.firstVisit ? '★ 최초 도달' : '';
  console.log('');
  console.log(
    `  [${String(floor.floor).padStart(2)}층] 위협도 ${floor.threat}  ` +
      `${topic(floor.fallen.identity.name)} 쓰러졌다  ${mark}`,
  );
  for (const entry of floor.decisions) {
    const died = floor.died.includes(entry.actor.instanceId) ? '  (사망)' : '';
    console.log(
      `        ${entry.actor.identity.name.padEnd(4)} ${formatReason(entry.decision.reason)
        .padEnd(72)} 피해 ${String(entry.damage).padStart(2)}${died}`,
    );
  }
  if (floor.rescued) {
    console.log(`        → ${topic(floor.fallen.identity.name)} 살아남았다`);
  } else {
    console.log(`        → 아무도 오지 않았다. ${topic(floor.fallen.identity.name)} 죽었다`);
  }
}

section('결과');
console.log(`  도달 층      ${result.deepestFloor} / ${TOWER.floors}`);
console.log(`  클리어       ${result.cleared ? '성공' : `실패 (${result.abortReason ?? '중단'})`}`);
console.log(
  `  생존         ${
    result.survivors.length === 0
      ? '없음'
      : result.survivors.map((id) => world.instance(id).identity.name).join(', ')
  }`,
);
console.log(
  `  사망         ${
    result.deaths.length === 0
      ? '없음'
      : result.deaths.map((id) => world.instance(id).identity.name).join(', ')
  }`,
);

section('생존자 State');
for (const id of result.survivors) {
  const c = world.instance(id);
  console.log(
    `  ${c.identity.name.padEnd(4)} hp=${String(c.needs.health).padStart(3)}/${c.needs.maxHealth} ` +
      `fatigue=${String(c.needs.fatigue).padStart(2)} fear=${String(c.emotion.fear).padStart(3)} ` +
      `memory=${c.memory.length}건 goals=[${c.goals.map((g) => g.kind).join(', ')}]`,
  );
}

section('탑의 기록 — 발견된 층');
const discovered = world.events
  .ofKind('WorldDiscovery')
  .map((e) => e.what)
  .filter((what) => what.startsWith('tower_floor_'));
console.log(`  ${discovered.length}개 층이 기록에 남았다: ${discovered.join(', ')}`);
console.log(
  `  같은 층을 다시 올라도 다시 발견되지 않는다 — ${floorKey(1)}는 1회만 기록된다`,
);

section(`Event Log — ${world.events.length}건`);
const byKind = new Map<string, number>();
for (const event of world.events.all()) {
  byKind.set(event.kind, (byKind.get(event.kind) ?? 0) + 1);
}
for (const [kind, count] of [...byKind].sort((a, b) => b[1] - a[1])) {
  console.log(`  ${kind.padEnd(20)} ${count}`);
}
console.log('');
