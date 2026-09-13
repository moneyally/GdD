# CORE GAMEPLAY — 구현 현황

브리핑 4절 "CORE GAMEPLAY 증명"의 구현물이다. 목표는 기능이 아니라 **증명**이다:

> 플레이어가 직접 조종하지 않아도 캐릭터가 자기 기억·관계·감정 때문에 다른 선택을 하고,
> 그 선택이 세계의 역사로 남으며, 그 역사 때문에 다음 캐릭터의 행동이 달라진다.

## 실행

```bash
npm install
npm run demo      # 4명 시나리오 텍스트 로그 (샘플: docs/logs/core-gameplay-sample.txt)
npm run compare   # 판단 비교표 (샘플: docs/logs/decision-comparison.md)
npm run check     # 타입 검사 + 테스트 40개
```

스택: TypeScript (strict) / Node 22 / vitest. 엔진·렌더러·서버·LLM 없음.

## 통과 기준 대응

| 기준 | 결과 | 검증 위치 |
|---|---|---|
| A(fear=20, trust=80) → RESCUE | 통과 | `tests/decision.test.ts` |
| B(fear=80, trust=20) → RETREAT | 통과 | 같음 |
| 행동 후 State 변화 (A 부상/신뢰↑, B 동료사망 목격→MajorMemory) | 통과 | 같음 |
| 저장 → **프로세스 재시작** → 복원 → 동일 State·동일 Event Log | 통과 | `tests/persistence.test.ts` (자식 프로세스로 검증) |
| 같은 상황 재투입 시 다른 판단 | 통과 (4명 전원 뒤집힘) | `tests/decision.test.ts` |
| LLM 호출 0회 | 통과 | `tests/contract.test.ts` (fetch 스파이 + src 정적 검사) |

### 브리핑 5절 진행 — 4명 State / L2 GOAP / 비교표

| 항목 | 결과 |
|---|---|
| 캐릭터 State 4명 | fear × trust 2×2로 배치. `scenario/coreGameplay.ts` `squad` |
| L2 GOAP | 전제조건·효과·비용 기반 균일비용탐색. `decision/{goapActions,l2Goap}.ts` |
| Memory/Relationship 비교표 | `docs/logs/decision-comparison.md` (`npm run compare`로 재생성) |

### 실제로 관찰된 판단 변화 (4명, 같은 Definition, 같은 상황)

```
세인   fear=20 trust=80   RESCUE(L1)  → RETREAT(L1)   피해 49 → 0    ← 변화
도하   fear=80 trust=20   RETREAT(L1) → RESCUE(L2)    피해  0 → 28   ← 변화
유진   fear=80 trust=80   RETREAT(L1) → RESCUE(L2)    피해  0 → 28   ← 변화
라온   fear=20 trust=20   RETREAT(L1) → RESCUE(L2)    피해  0 → 49   ← 변화
```

네 명 모두 1차 조우의 결과가 2차 판단을 바꿨다. 피해 열이 L2의 효과다 —
계획에 연막이 들어간 도하·유진은 28, 계획 없이 곧장 들어간 세인·라온은 49를 입는다.

도하의 두 번째 판단 근거:

```
RESCUE(goal=never_abandon_ally,plan=SUPPRESS→RESCUE→FALL_BACK,cost=6.6,source=MEM_0018 overrides fear=72)
       도하는 두려움에도 몸이 먼저 움직였다. 다시는 그러지 않겠다고 정했기 때문이다.
```

이 한 줄이 증명 대상이다. 공포는 여전히 높은데(72) 행동이 반대로 나왔고,
그 원인이 **이전 조우에서 자기가 만든 기억**(`MEM_0018`)으로 추적된다.
게다가 무작정 뛰어들지 않는다 — 공포 때문에 감당 상한이 내려갔으므로 연막을 먼저 친다.

세인은 반대 방향의 증거다. 같은 Definition에서 나왔고 처음엔 구하러 갔지만,
구조의 대가(부상)가 다음 판단을 바꿨다. 성격이 아니라 **경험**이 갈랐다.

## 구조

```
src/
├── core/                    상태와 계약
│   ├── ids.ts               branded ID — Definition/Instance 혼용을 컴파일 타임에 차단
│   ├── definition.ts        [1층] CharacterDefinition — 정적 설계
│   ├── instance.ts          [2층] CharacterInstance — 소유된 영속 개체 (8개 도메인)
│   ├── agentState.ts        [3층] AgentState — 판단 전용 파생 상태 (저장되지 않음)
│   ├── actor.ts             [4층] Actor — 렌더 실체 (타입만, 판단 로직 없음)
│   ├── events.ts            Event 6종 + append-only 로그
│   ├── transaction.ts       Request → Validate → Apply → Event
│   ├── instanceFactory.ts   규칙 8 — 중복 획득은 새 개체
│   ├── order.ts             Master 명령 3개
│   ├── rng.ts               시드 난수 (Math.random 미사용)
│   └── world.ts             상태 보관소 + 복원
├── decision/                판단 — World도 렌더러도 참조하지 않는다
│   ├── situation.ts         상황
│   ├── l0Rules.ts           L0 규칙/상태 (Master 퇴각 조건, 방어 명령)
│   ├── l1Utility.ts         L1 효용 (가중치 전부 파일 상단)
│   ├── goapActions.ts       L2 행동 정의 — 전제조건 / 효과 / 비용
│   ├── l2Goap.ts            L2 플래너 (균일비용탐색)
│   ├── decide.ts            진입점 L0 → L2 → L1 — LLM 없음
│   └── reason.ts            ReasonCode
├── sim/resolve.ts           행동 → 사건 → 죽음 → 기억 → 목표
├── transactions/summon.ts   소환
├── persistence/             Snapshot + Repository 인터페이스 + JSON 구현
├── log/                     텍스트 렌더러 (판단 함수 호출 금지) + 조사 처리
├── scenario/coreGameplay.ts 시나리오
├── data/definitions.ts      Definition 2개
└── cli/                     demo / compare / verifyRestore
```

## CORE CONTRACT 8개 규칙이 어디에 있나

| 규칙 | 구현 | 계약 테스트 |
|---|---|---|
| 1. 4단 분리 | `core/{definition,instance,agentState,actor}.ts` + `ids.ts` branded type | AgentState 미저장, 판단 모듈의 의존 방향, 스냅샷 불변성 |
| 2. State Contract 8도메인 | `instance.ts` `CharacterInstance` | 타입으로 강제 |
| 3. Event 6종 append-only | `events.ts` | 6종 외 기록 없음 / 수정·삭제 메서드 없음 / seq 연속 |
| 4. 트랜잭션 경유 | `transaction.ts` + `transactions/`, `sim/resolve.ts` | 검증 실패 시 무변경 |
| 5. L0→L2→L1, LLM 배제 | `decision/` | fetch 0회 + src 정적 검사 |
| 6. 모든 판단에 ReasonCode | `reason.ts`, 렌더러 2개가 같은 ReasonCode 사용 | 브리핑 예시 3개와 문자열 일치 |
| 7. 죽음은 최종 | `sim/resolve.ts` `killInstance` | Instance 미삭제 + `dead` + LegacyCreation |
| 8. 중복 = 새 Instance | `instanceFactory.ts` | 다른 ID·이름·성격, 배열 비공유, 이름 유일성 |

L2 GOAP는 계약이 아니라 기능이므로 별도로 검증한다 — `tests/goap.test.ts`
(계획 순서, 전제조건 준수, 계획 불가 시 하강, 결정론, 피해 감소).

## L2 GOAP 설계

행동 3개(`SUPPRESS` / `RESCUE` / `FALL_BACK`)에 전제조건·효과·비용을 주고, 목표
(`동료도 살고 나도 빠져나온다`)를 만족하는 최소 비용 순서를 탐색한다. 행동을 추가하면
플래너를 고치지 않아도 새 계획이 생긴다.

핵심 수치는 **감당 상한**이다:

```
tolerable = 40 + (risk - 50) × 0.6 + healthRatio × 40 − fear × 0.25
```

`RESCUE`의 전제조건이 `threat ≤ tolerable`이므로:

- 상한이 위협보다 높으면 → `RESCUE → FALL_BACK` (곧장 들어간다)
- 상한이 낮으면 → `SUPPRESS → RESCUE → FALL_BACK` (연막을 먼저 친다)
- 연막으로도 못 메우면 → **계획 없음.** L1 효용으로 내려가고, 거기서 물러설 수도 있다

여기에 `fear`가 들어가는 이유: 없으면 목표를 가진 캐릭터가 공포와 무관하게 늘 같은
계획을 세운다. 그러면 감정이 판단에 영향을 준다는 전제가 무너진다.
**공포는 목표를 지우지 못하지만 방법을 바꾼다.**

자세한 경계값은 `docs/logs/decision-comparison.md`의 "계획 가능 경계" 표에 있다.

## 설계 판단 기록

구현하면서 정해야 했던 것들. 되돌릴 수 있지만 지금은 이렇게 돼 있다.

1. **판단 호출 순서는 L0 → L2 → L1이다** (규칙 5의 나열 순서와 다르다).
   L1은 단일 행동의 효용을 비교하는 층이고 L2는 여러 걸음이 필요한 목표를 다룬다.
   한 번의 행동으로 달성할 수 없는 목표를 L1에 먼저 물으면 목표가 무시된 답이 나온다.
   L1은 언제나 답을 내므로 판단이 비는 경우는 없다.
2. **기억에서 파생된 목표를 L0에서 L2로 옮겼다.** L0가 RESCUE를 강제하면 부상당한
   캐릭터가 아무 준비 없이 뛰어들어 죽는다. 목표는 "무엇을", 계획은 "어떻게"다.
   그래도 **Master의 퇴각 조건은 여전히 캐릭터 목표보다 강하다.** 넘게 하려면
   "명령에 비용"(신뢰 소모) 개념이 필요하다 — 미결(OPEN-QUESTIONS 6-2).
3. **ReasonCode에 효용 점수를 넣지 않는다.** 플레이어에게 `rescue=71.0`은 의미가 없다.
   입력 값(trust/fear/self_risk)만 싣고, 점수는 디버거 전용으로 분리했다.
4. **AgentState는 복사본이다.** Instance의 배열을 참조로 들면 행동 후 변화가
   "판단 시점 State"에 비쳐 디버거가 거짓 근거를 보여준다. 실제로 한 번 발생했고
   회귀 테스트로 고정했다.
5. **이름은 유일하다.** 규칙 8이 "완전히 다른 이름"을 요구하므로 사용 중인 이름
   (죽은 캐릭터 포함)을 피해서 뽑는다. 풀이 소진되면 서수를 붙인다.
6. **양방향 신뢰 변화.** 구조하면 구조된 쪽(+18)과 구조한 쪽(+8) 모두 오른다.
7. **ID·난수·tick이 전부 결정론적이다.** Snapshot에 난수 상태와 ID 카운터를 저장하므로
   복원 후 이어서 소환해도 저장 전과 같은 결과가 나온다.

## 다음 단계 (브리핑 5절, 지금 만들지 않음)

~~캐릭터 State 4명~~ → ~~L2 GOAP~~ → ~~Memory/Relationship 비교표~~ →
**10층 미션** → 첫 사망 → History → Legacy → 소환/InstanceFactory 확장 →
30분 플레이 시나리오로 통합 검증 → LLM 서술 연동.
