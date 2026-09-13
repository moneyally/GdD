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
  const { world, squad } = buildScenario();

  section('소환 — 같은 Definition에서 4명 (규칙 8)');
  for (const pair of squad) {
    const c = pair.vanguard;
    console.log(
      `  ${c.identity.name} [${c.instanceId}] ← ${c.identity.definitionId}  ` +
        `risk=${c.personality.risk} loyalty=${c.personality.loyalty} ` +
        `aggression=${c.personality.aggression}  ${pair.label}  동료=${pair.ally.identity.name}`,
    );
  }

  section('1차 조우 — 동일 상황, 4명의 다른 판단');
  world.advanceTick();
  const first = squad.map((pair) => runEncounter(world, pair.vanguard, pair.ally, world.tick));
  for (const enc of first) {
    playerLines({ ...enc }).forEach((l) => console.log(l));
    debuggerLines({ ...enc }).forEach((l) => console.log(l));
    console.log('');
  }

  section('1차 결과 — State 변화');
  for (const pair of squad) {
    const c = pair.vanguard;
    console.log(
      `  ${c.identity.name}  health=${c.needs.health}/${c.needs.maxHealth} ` +
        `fear=${c.emotion.fear}  memory=[${c.memory.map((m) => m.tag).join(', ')}]  ` +
        `goals=[${c.goals.map((g) => g.kind).join(', ')}]  동료=${pair.ally.status}`,
    );
  }

  section('2차 조우 — 변화된 State 때문에 달라진 판단');
  world.advanceTick();
  // 동료가 죽은 캐릭터에게는 새 정찰병을 붙인다. 규칙 8이 여기서 다시 확인된다.
  const second = squad.map((pair) => {
    let ally = pair.ally;
    if (ally.status === 'dead') {
      ally = summon(world, SCOUT.definitionId);
      console.log(
        `  ${pair.vanguard.identity.name}의 새 동료: ${ally.identity.name} [${ally.instanceId}]`,
      );
    }
    return { pair, ally };
  }).map(({ pair, ally }) => runEncounter(world, pair.vanguard, ally, world.tick));
  console.log('');

  for (const enc of second) {
    playerLines({ ...enc }).forEach((l) => console.log(l));
    debuggerLines({ ...enc }).forEach((l) => console.log(l));
    console.log('');
  }

  section('판단 변화 요약');
  for (const [i, pair] of squad.entries()) {
    const f = first[i]!;
    const s2 = second[i]!;
    const changed = f.decision.reason.action === s2.decision.reason.action ? '  ' : '← 변화';
    console.log(
      `  ${pair.vanguard.identity.name.padEnd(4)} ${pair.label.padEnd(18)} ` +
        `${f.decision.reason.action}(${f.decision.reason.layer}) → ` +
        `${s2.decision.reason.action}(${s2.decision.reason.layer})  ` +
        `피해 ${f.damageTaken} → ${s2.damageTaken}  ${changed}`,
    );
  }

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
