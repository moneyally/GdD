/**
 * 실행 로그 샘플 생성기 — 브리핑 4절 산출물 6.
 *
 *   npm run demo            텍스트 로그 출력
 *   npm run demo -- --save  로그 출력 + Snapshot 저장
 *
 * UI/그래픽 없음. 이 파일은 렌더러 층(Actor)의 MVP 구현에 해당한다 —
 * 판단 로직을 갖지 않고 Decision/Event만 읽는다.
 */

import { takeSnapshot } from '../persistence/snapshot.js';
import { JsonSnapshotRepository } from '../persistence/jsonRepository.js';
import { debuggerLines, eventLine, playerLines } from '../log/renderer.js';
import { buildScenario, runEncounter, summon } from '../scenario/coreGameplay.js';
import { SCOUT } from '../data/definitions.js';
import type { WorldEvent } from '../core/events.js';

const SNAPSHOT_PATH = 'save/core-gameplay.json';

function section(title: string): void {
  console.log('');
  console.log(`── ${title} ${'─'.repeat(Math.max(0, 56 - title.length))}`);
}

async function main(): Promise<void> {
  const shouldSave = process.argv.includes('--save');
  const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();

  section('소환 — 같은 Definition, 다른 개체 (규칙 8)');
  for (const c of [vanguardA, vanguardB]) {
    console.log(
      `  ${c.identity.name} [${c.instanceId}] ← ${c.identity.definitionId}  ` +
        `risk=${c.personality.risk} loyalty=${c.personality.loyalty} ` +
        `aggression=${c.personality.aggression}  fear=${c.emotion.fear} ` +
        `trust=${c.relationships[0]?.trust ?? 0}`,
    );
  }

  section('1차 조우 — 동일 상황, 다른 판단');
  world.advanceTick();
  const first = [
    runEncounter(world, vanguardA, allyOfA, world.tick),
    runEncounter(world, vanguardB, allyOfB, world.tick),
  ];
  for (const enc of first) {
    playerLines({ ...enc }).forEach((l) => console.log(l));
    debuggerLines({ ...enc }).forEach((l) => console.log(l));
    console.log('');
  }

  section('1차 결과 — State 변화');
  for (const c of [vanguardA, vanguardB]) {
    console.log(
      `  ${c.identity.name}  health=${c.needs.health}/${c.needs.maxHealth} ` +
        `fear=${c.emotion.fear}  memory=[${c.memory.map((m) => m.tag).join(', ')}]  ` +
        `goals=[${c.goals.map((g) => g.kind).join(', ')}]`,
    );
  }
  for (const c of [allyOfA, allyOfB]) {
    console.log(`  ${c.identity.name}  status=${c.status}`);
  }

  section('2차 조우 — 변화된 State 때문에 달라진 판단');
  world.advanceTick();
  // B의 동료는 죽었으므로 새 정찰병을 소환한다. 규칙 8이 여기서 다시 확인된다.
  const newAlly = summon(world, SCOUT.definitionId);
  console.log(`  새 정찰병 소환: ${newAlly.identity.name} [${newAlly.instanceId}]`);
  console.log('');

  const second = [
    runEncounter(world, vanguardA, allyOfA, world.tick),
    runEncounter(world, vanguardB, newAlly, world.tick),
  ];
  for (const enc of second) {
    playerLines({ ...enc }).forEach((l) => console.log(l));
    debuggerLines({ ...enc }).forEach((l) => console.log(l));
    console.log('');
  }

  section('판단 변화 요약');
  console.log(
    `  ${vanguardA.identity.name}: ${first[0]!.decision.reason.action} → ${second[0]!.decision.reason.action}` +
      `   (${first[0]!.decision.reason.layer} → ${second[0]!.decision.reason.layer})`,
  );
  console.log(
    `  ${vanguardB.identity.name}: ${first[1]!.decision.reason.action} → ${second[1]!.decision.reason.action}` +
      `   (${first[1]!.decision.reason.layer} → ${second[1]!.decision.reason.layer})`,
  );

  section(`Event Log — ${world.events.length}건 (6종만 기록, 규칙 3)`);
  for (const event of world.events.all()) {
    console.log(eventLine(event as unknown as WorldEvent & Record<string, unknown>));
  }

  if (shouldSave) {
    section('저장');
    await new JsonSnapshotRepository(SNAPSHOT_PATH).save(takeSnapshot(world));
    console.log(`  ${SNAPSHOT_PATH}`);
  }
  console.log('');
}

main().catch((error: unknown) => {
  console.error(error);
  process.exitCode = 1;
});
