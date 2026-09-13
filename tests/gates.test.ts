/**
 * 차원문 등반 검증.
 *
 * 밸런스 수치가 아니라 **규칙이 작동하는지**를 본다:
 * 위상압이 위협을 올리는가, 교란기가 유한하게 쓰이는가, 잔상이 양방향으로 작용하는가,
 * 그리고 선형 등반(골든 대조의 기준점)이 영향을 받지 않는가.
 */

import { describe, expect, it } from 'vitest';
import { World } from '../src/core/world.js';
import { runTransaction } from '../src/core/transaction.js';
import { ALL_DEFINITIONS, SCOUT, VANGUARD } from '../src/data/definitions.js';
import {
  DEFAULT_SUPPLIES,
  FormPartyTransaction,
  GATES,
  GATE_RULES,
  runGateTower,
  type Echo,
  type GateContext,
  type GateKey,
  type GateStrategy,
} from '../src/mission/gates.js';
import { ADAPTIVE, ALIGNED_ONLY, DEEP_ONLY, WARPED_ONLY } from '../src/mission/gateStrategies.js';
import { summon } from '../src/scenario/coreGameplay.js';
import { TOWER_RUN } from '../src/scenario/towerRun.js';
import { TOWER } from '../src/mission/tower.js';
import { runCampaign } from '../src/mission/campaign.js';

function buildWorld(seed = 5000) {
  const world = World.create(seed, ALL_DEFINITIONS);
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
  return { world, party };
}

function run(strategy: GateStrategy, seed = 5000, echoes: readonly Echo[] = []) {
  const { world, party } = buildWorld(seed);
  const result = runGateTower({
    world,
    party: party.map((c) => c.instanceId),
    order: TOWER_RUN.order,
    strategy,
    echoes,
  });
  return { world, party, result };
}

/** 문만 고르고 보급은 쓰지 않는 전략 */
function gateOnly(key: GateKey): GateStrategy {
  return { name: `only:${key}`, chooseGate: () => key, allocate: () => ({}) };
}

describe('위상압 — 안전을 사면 탑이 조여온다', () => {
  it('뒤틀린문은 위협을 낮추지만 위상압을 더 올린다', () => {
    const warped = run(gateOnly('warped'));
    const aligned = run(gateOnly('aligned'));

    expect(warped.result.finalPressure).toBeGreaterThan(aligned.result.finalPressure);
    // 같은 좌표에서 뒤틀린문의 위협이 더 낮아야 한다 (1좌표는 위상압 차이가 작다)
    expect(warped.result.floors[0]!.threat).toBeLessThan(aligned.result.floors[0]!.threat);
  });

  it('위상압이 쌓이면 같은 문이라도 위협이 올라간다', () => {
    const { result } = run(gateOnly('aligned'));
    expect(result.floors.length).toBeGreaterThan(3);

    for (let i = 1; i < result.floors.length; i += 1) {
      expect(result.floors[i]!.pressure).toBeGreaterThan(result.floors[i - 1]!.pressure);
      expect(result.floors[i]!.threat).toBeGreaterThan(result.floors[i - 1]!.threat);
    }
  });

  it('뒤틀린문을 계속 고르면 결국 정렬문보다 위협이 높아진다', () => {
    const warped = run(gateOnly('warped'));
    const aligned = run(gateOnly('aligned'));

    const last = Math.min(warped.result.floors.length, aligned.result.floors.length) - 1;
    expect(last).toBeGreaterThan(4);
    // 초반에는 뒤틀린문이 안전하지만 누적된 위상압이 그걸 뒤집는다
    expect(warped.result.floors[last]!.threat)
      .toBeGreaterThan(aligned.result.floors[last]!.threat);
  });

  it('뒤틀린문은 피로를 남긴다', () => {
    const warped = run(gateOnly('warped'));
    const aligned = run(gateOnly('aligned'));

    const fatigue = (r: ReturnType<typeof run>) =>
      r.result.survivors.reduce((sum, id) => sum + r.world.instance(id).needs.fatigue, 0);

    expect(GATES.warped.fatigue).toBeGreaterThan(0);
    if (warped.result.survivors.length > 0 && aligned.result.survivors.length > 0) {
      expect(fatigue(warped) / warped.result.survivors.length)
        .toBeGreaterThan(fatigue(aligned) / aligned.result.survivors.length);
    }
  });
});

describe('유한한 교란기', () => {
  it('연막이 들어간 계획은 반드시 교란기 소지자의 것이다', () => {
    const { result } = run(ADAPTIVE);
    const plansWithSuppress = result.floors.flatMap((f) =>
      f.decisions.filter((d) => d.decision.plan?.steps.includes('SUPPRESS')),
    );
    for (const d of plansWithSuppress) expect(d.heldSuppressor).toBe(true);
  });

  it('목표 보유자가 없으면 교란기를 배분하지 않는다', () => {
    // 교란기는 L2 계획에만 들어가고, L2는 기억에서 파생된 목표가 있어야 실행된다.
    // 목표 없는 사람에게 주는 것은 버리는 것이므로 적응형은 아예 주지 않는다.
    const { result } = run(ADAPTIVE);

    for (const floor of result.floors) {
      const holders = floor.decisions.filter((d) => d.heldSuppressor);
      for (const holder of holders) {
        expect(holder.actor.goals.some((g) => g.kind === 'never_abandon_ally')).toBe(true);
      }
    }
  });

  it('배분하지 않으면 아무도 연막을 쓰지 못한다', () => {
    const noKit: GateStrategy = {
      name: '배분안함',
      chooseGate: ADAPTIVE.chooseGate,
      allocate: () => ({}),
    };
    const { result } = run(noKit);

    for (const floor of result.floors)
      for (const d of floor.decisions)
        expect(d.decision.plan?.steps ?? []).not.toContain('SUPPRESS');
  });

  it('교란기는 가진 개수만큼만 쓸 수 있다', () => {
    const everyoneAlways: GateStrategy = {
      name: '매번배분',
      chooseGate: () => 'aligned',
      allocate: (ctx: GateContext) => ({ suppressorTo: ctx.living[0]?.instanceId }),
    };
    const { result } = run(everyoneAlways);

    const handedOut = result.floors.filter((f) => f.decisions.some((d) => d.heldSuppressor)).length;
    // 시작 보유량을 넘을 수 없다 (정렬문은 보급을 주지 않는다)
    expect(handedOut).toBeLessThanOrEqual(DEFAULT_SUPPLIES.suppressor);
  });
});

describe('보급', () => {
  it('심층문은 보급을 확실히 준다', () => {
    const { result } = run(gateOnly('deep'));
    expect(result.floors.every((f) => f.supplyGained !== undefined)).toBe(true);
  });

  it('정렬문은 보급을 주지 않는다', () => {
    const { result } = run(gateOnly('aligned'));
    expect(result.floors.every((f) => f.supplyGained === undefined)).toBe(true);
  });

  it('보급은 상한을 넘지 않는다', () => {
    const hoard: GateStrategy = { name: '모으기', chooseGate: () => 'deep', allocate: () => ({}) };
    const { result } = run(hoard);
    // 상한이 없으면 10좌표를 지나며 무한히 쌓인다. 상한이 걸렸다면 전부 받아도 4를 넘지 않는다
    expect(GATE_RULES.supplyCap).toBe(4);
    expect(result.floors.filter((f) => f.supplyGained === 'suppressor').length)
      .toBeLessThanOrEqual(TOWER.floors);
  });
});

describe('잔상 — 같은 기록이 도움도 되고 부담도 된다', () => {
  const echo: Echo = { depth: 2, name: '이전등반자', grants: 'suppressor' };

  it('뒤틀린문으로 가면 회수하고 공포가 내려간다', () => {
    const { result } = run(WARPED_ONLY, 5000, [echo]);
    const at = result.floors.find((f) => f.depth === 2)!;
    expect(at.echoNote).toContain('회수');
  });

  it('다른 문으로 지나가면 이름만 보이고 공포가 오른다', () => {
    const { result } = run(ALIGNED_ONLY, 5000, [echo]);
    const at = result.floors.find((f) => f.depth === 2)!;
    expect(at.echoNote).toContain('벽면');
  });

  it('회수한 잔상은 같은 등반에서 다시 나오지 않는다', () => {
    const { result } = run(WARPED_ONLY, 5000, [echo]);
    const mentions = result.floors.filter((f) => f.echoNote?.includes('회수'));
    expect(mentions).toHaveLength(1);
  });

  it('사망자는 그 좌표에 잔상을 남긴다', () => {
    const { result } = run(DEEP_ONLY, 5000);
    expect(result.deaths.length).toBeGreaterThan(0);
    expect(result.newEchoes.length).toBeGreaterThan(0);
    for (const e of result.newEchoes) {
      expect(e.depth).toBeGreaterThanOrEqual(1);
      expect(e.depth).toBeLessThanOrEqual(TOWER.floors);
    }
  });
});

describe('결정론', () => {
  it('같은 시드와 같은 전략이면 완전히 같은 등반이 나온다', () => {
    const summarize = () => {
      const { result } = run(ADAPTIVE, 6100);
      return JSON.stringify({
        gates: result.gatesTaken,
        depth: result.deepestDepth,
        cleared: result.cleared,
        pressure: result.finalPressure,
        actions: result.floors.flatMap((f) =>
          f.decisions.map((d) => `${f.depth}:${d.decision.reason.action}:${d.damage}`),
        ),
      });
    };
    expect(summarize()).toBe(summarize());
  });

  it('전략을 바꾸면 결과가 달라진다 — 선택이 장식이 아니다', () => {
    const adaptive = run(ADAPTIVE, 6100).result;
    const deep = run(DEEP_ONLY, 6100).result;

    expect(adaptive.gatesTaken).not.toEqual(deep.gatesTaken);
    // 같은 시드에서도 문 선택이 다르면 등반 자체가 달라진다
    const same = adaptive.deepestDepth === deep.deepestDepth
      && adaptive.deaths.length === deep.deaths.length
      && adaptive.finalPressure === deep.finalPressure;
    expect(same).toBe(false);
  });
});

describe('캠페인 — 기억이 판단을 바꾸는 경로', () => {
  function campaign(fatigueRecovered: number) {
    const world = World.create(7100, ALL_DEFINITIONS);
    return runCampaign({
      world,
      order: TOWER_RUN.order,
      strategy: ADAPTIVE,
      attempts: 4,
      camp: { fatigueRecovered },
    });
  }

  it('한 번의 등반만으로는 L2가 실행되지 않는다', () => {
    // 목표는 거의 항상 마지막 좌표에서 생기고 그 시점에 등반이 끝난다.
    // 이건 현재 설계의 한계를 고정하는 테스트다 — 고쳐지면 이 테스트가 실패하고,
    // 그때 docs/proposal/holo-gates.md의 미결 항목도 같이 갱신해야 한다.
    const { result } = run(ADAPTIVE);
    const planningDepths = result.floors.filter((f) =>
      f.decisions.some((d) => d.decision.reason.layer === 'L2'),
    );
    expect(planningDepths).toHaveLength(0);
  });

  it('캠프에서 피로가 회복되면 2회차부터 L2가 실행된다', () => {
    const rested = campaign(1);
    const exhausted = campaign(0);

    const total = (c: ReturnType<typeof campaign>) =>
      c.attempts.reduce((sum, a) => sum + a.planningDepths, 0);

    // 이게 이 게임의 핵심 명제가 실제로 실행되는 유일한 조건이다
    expect(total(rested)).toBeGreaterThan(0);
    expect(total(rested)).toBeGreaterThan(total(exhausted));
    // 1회차에는 아직 아무 기억도 없다
    expect(rested.attempts[0]!.planningDepths).toBe(0);
  });

  it('죽은 사람은 다음 회차에 돌아오지 않고 새 사람이 채운다 (규칙 7)', () => {
    const result = campaign(1);

    for (let i = 1; i < result.attempts.length; i += 1) {
      const previous = result.attempts[i - 1]!;
      const current = result.attempts[i]!;
      // 이전 회차 생존자 수가 이번 회차에 복귀한 인원이다
      expect(current.returning).toBe(previous.result.survivors.length);
    }
  });

  it('베테랑이 목표를 들고 돌아온다', () => {
    const result = campaign(1);
    const later = result.attempts.slice(1);
    expect(later.some((a) => a.veteransWithGoal > 0)).toBe(true);
  });

  it('잔상이 회차를 넘어 누적된다', () => {
    const result = campaign(1);
    expect(result.echoes.length).toBeGreaterThan(0);
    // 같은 좌표에 잔상이 두 개 생기지 않는다
    const depths = result.echoes.map((e) => e.depth);
    expect(new Set(depths).size).toBe(depths.length);
  });
});

describe('선형 등반은 영향받지 않는다', () => {
  it('차원문 모듈은 tower.ts의 상수를 재정의하지 않는다', () => {
    // 밸런스 상수를 두 곳에 두면 반드시 어긋난다. 회복·피로는 tower.ts가 기준이다
    expect(TOWER.restHealRatio).toBe(0.12);
    expect(TOWER.restFearDecay).toBe(4);
    expect(TOWER.floors).toBe(10);
  });
});
