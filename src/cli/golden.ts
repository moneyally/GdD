/**
 * 골든 출력 생성기 — 다른 언어로 이식한 구현을 검증하기 위한 정답지.
 *
 *   npm run golden          golden/*.json 재생성
 *
 * 판단 엔진을 C#(Unity)이나 C++(Unreal)로 옮기면 "같은 규칙을 옮겼다"를 주장해야 하는데,
 * 코드를 눈으로 대조하는 것으로는 증명이 안 된다. 그래서 고정 시드의 실행 결과를
 * 정규화해서 파일로 남기고, 이식한 쪽이 같은 파일을 만들어내는지 비교한다.
 *
 * 여기 담기는 것은 **관측 가능한 결과**뿐이다 — 행동, 판단 계층, ReasonCode 문자열,
 * 이벤트 종류와 순서, 최종 생존/사망. 내부 점수는 담지 않는다(가중치를 바꾸면 깨져야 하지만,
 * 리팩터링으로는 깨지지 않아야 하므로).
 */

import { mkdirSync, writeFileSync } from 'node:fs';
import { buildScenario, runEncounter, summon, SCENARIO } from '../scenario/coreGameplay.js';
import { runTowerScenario, TOWER_RUN } from '../scenario/towerRun.js';
import { SCOUT } from '../data/definitions.js';
import { formatReason } from '../decision/reason.js';
import { Rng } from '../core/rng.js';
import { takeSnapshot } from '../persistence/snapshot.js';
import { serialize } from '../persistence/jsonRepository.js';

const OUT_DIR = 'golden';

/** 난수부터 대조한다. 여기가 어긋나면 나머지 전부가 어긋난다. */
function rngGolden(): unknown {
  const draws: number[] = [];
  const rng = new Rng(77001);
  for (let i = 0; i < 12; i += 1) draws.push(Math.round(rng.next() * 1e9));
  const ints: number[] = [];
  const rng2 = new Rng(4242);
  for (let i = 0; i < 12; i += 1) ints.push(rng2.intBetween(40, 90));
  return { seed: 77001, draws, intSeed: 4242, ints };
}

/** CORE GAMEPLAY 시나리오 — 통과 기준의 두 캐릭터 */
function coreGolden(): unknown {
  const { world, vanguardA, vanguardB, allyOfA, allyOfB } = buildScenario();

  world.advanceTick();
  const firstA = runEncounter(world, vanguardA, allyOfA, world.tick);
  const firstB = runEncounter(world, vanguardB, allyOfB, world.tick);

  world.advanceTick();
  const newAlly = summon(world, SCOUT.definitionId);
  const secondA = runEncounter(world, vanguardA, allyOfA, world.tick);
  const secondB = runEncounter(world, vanguardB, newAlly, world.tick);

  const line = (label: string, enc: ReturnType<typeof runEncounter>) => ({
    label,
    actor: enc.actor.identity.name,
    action: enc.decision.reason.action,
    layer: enc.decision.reason.layer,
    reason: formatReason(enc.decision.reason),
    plan: enc.decision.plan?.steps ?? null,
    damage: enc.damageTaken,
  });

  return {
    seed: SCENARIO.seed,
    threat: SCENARIO.enemyThreat,
    order: SCENARIO.order,
    names: world.allInstances().map((i) => i.identity.name),
    encounters: [
      line('1st/A', firstA),
      line('1st/B', firstB),
      line('2nd/A', secondA),
      line('2nd/B', secondB),
    ],
    events: world.events.all().map((e) => `${e.seq}:${e.kind}`),
  };
}

/** 탑 등반 — 미션 전체 */
function towerGolden(): unknown {
  const { world, party, result } = runTowerScenario();

  return {
    seed: TOWER_RUN.seed,
    order: TOWER_RUN.order,
    baseTrust: TOWER_RUN.baseTrust,
    party: party.map((c) => ({
      name: c.identity.name,
      definition: c.identity.definitionId,
      risk: c.personality.risk,
      loyalty: c.personality.loyalty,
      aggression: c.personality.aggression,
      maxHealth: c.needs.maxHealth,
    })),
    floors: result.floors.map((f) => ({
      floor: f.floor,
      threat: f.threat,
      fallen: f.fallen.identity.name,
      firstVisit: f.firstVisit,
      rescued: f.rescued,
      decisions: f.decisions.map((d) => ({
        actor: d.actor.identity.name,
        action: d.decision.reason.action,
        layer: d.decision.reason.layer,
        reason: formatReason(d.decision.reason),
        plan: d.decision.plan?.steps ?? null,
        damage: d.damage,
      })),
      died: f.died.map((id) => world.instance(id).identity.name),
    })),
    result: {
      deepestFloor: result.deepestFloor,
      cleared: result.cleared,
      abortReason: result.abortReason ?? null,
      survivors: result.survivors.map((id) => world.instance(id).identity.name),
      deaths: result.deaths.map((id) => world.instance(id).identity.name),
    },
    survivorState: result.survivors.map((id) => {
      const c = world.instance(id);
      return {
        name: c.identity.name,
        health: c.needs.health,
        fatigue: c.needs.fatigue,
        fear: c.emotion.fear,
        memory: c.memory.map((m) => `${m.tag}:${m.importance}`),
        goals: c.goals.map((g) => g.kind),
      };
    }),
    events: world.events.all().map((e) => `${e.seq}:${e.kind}`),
  };
}

/**
 * Snapshot 원문 — 규칙 3의 저장 절반을 이식한 쪽에서도 검증하기 위한 정답지.
 *
 * 위의 세 파일은 "같은 판단이 나오는가"를 본다. 이 파일은 "같은 상태를 같은 바이트로
 * 저장하는가"를 본다. 둘은 다른 주장이다 — 판단이 같아도 저장 스키마가 어긋나면
 * 한쪽에서 저장한 세이브를 다른 쪽이 못 읽는다.
 *
 * 정렬된 키 순서까지 고정되어 있으므로 **바이트 단위로** 대조할 수 있다.
 */
function towerSnapshotGolden(): string {
  const { world } = runTowerScenario();
  return serialize(takeSnapshot(world));
}

const files: readonly [string, unknown][] = [
  ['rng.json', rngGolden()],
  ['core-gameplay.json', coreGolden()],
  ['tower-run.json', towerGolden()],
];

/** 이미 직렬화된 문자열로 나오는 것들 (키 순서가 의미를 갖는다) */
const rawFiles: readonly [string, string][] = [
  ['tower-snapshot.json', towerSnapshotGolden()],
];

mkdirSync(OUT_DIR, { recursive: true });
for (const [name, data] of files) {
  writeFileSync(`${OUT_DIR}/${name}`, JSON.stringify(data, null, 2) + '\n', 'utf8');
  console.log(`  ${OUT_DIR}/${name}`);
}
for (const [name, text] of rawFiles) {
  writeFileSync(`${OUT_DIR}/${name}`, text + '\n', 'utf8');
  console.log(`  ${OUT_DIR}/${name}`);
}
console.log('');
console.log('이식한 구현은 같은 시드로 돌려 이 파일들과 일치해야 한다.');
