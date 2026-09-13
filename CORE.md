# CORE GAMEPLAY — 구현 현황

브리핑 4절 "CORE GAMEPLAY 증명"의 구현물이다. 목표는 기능이 아니라 **증명**이다:

> 플레이어가 직접 조종하지 않아도 캐릭터가 자기 기억·관계·감정 때문에 다른 선택을 하고,
> 그 선택이 세계의 역사로 남으며, 그 역사 때문에 다음 캐릭터의 행동이 달라진다.

## 실행

```bash
npm install
npm run demo      # 텍스트 로그 (샘플: docs/logs/core-gameplay-sample.txt)
npm run check     # 타입 검사 + 테스트 29개
```

스택: TypeScript (strict) / Node 22 / vitest. 엔진·렌더러·서버·LLM 없음.

## 통과 기준 대응

| 기준 | 결과 | 검증 위치 |
|---|---|---|
| A(fear=20, trust=80) → RESCUE | 통과 | `tests/decision.test.ts` |
| B(fear=80, trust=20) → RETREAT | 통과 | 같음 |
| 행동 후 State 변화 (A 부상/신뢰↑, B 동료사망 목격→MajorMemory) | 통과 | 같음 |
| 저장 → **프로세스 재시작** → 복원 → 동일 State·동일 Event Log | 통과 | `tests/persistence.test.ts` (자식 프로세스로 검증) |
| 같은 상황 재투입 시 다른 판단 | 통과 (A·B 둘 다 뒤집힘) | `tests/decision.test.ts` |
| LLM 호출 0회 | 통과 | `tests/contract.test.ts` (fetch 스파이 + src 정적 검사) |

### 실제로 관찰된 판단 변화

```
세인: RESCUE → RETREAT   (L1 → L1)   부상(체력 0.51)과 공포 상승이 효용을 뒤집음
도하: RETREAT → RESCUE   (L1 → L0)   기억이 만든 목표가 공포를 덮어씀
```

도하의 두 번째 판단 근거:

```
RESCUE(goal=never_abandon_ally,priority=85,source=MEM_0014 overrides fear=72)
       도하는 두려움에도 몸이 먼저 움직였다. 다시는 그러지 않겠다고 정했기 때문이다.
```

이 한 줄이 증명 대상이다. 공포는 오히려 더 높은데(72) 행동이 반대로 나왔고,
그 원인이 **이전 조우에서 자기가 만든 기억**(MEM_0014)으로 추적된다.

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
│   ├── l0Rules.ts           L0 규칙/상태
│   ├── l1Utility.ts         L1 효용 (가중치 전부 파일 상단)
│   ├── decide.ts            진입점 — LLM 없음
│   └── reason.ts            ReasonCode
├── sim/resolve.ts           행동 → 사건 → 죽음 → 기억 → 목표
├── transactions/summon.ts   소환
├── persistence/             Snapshot + Repository 인터페이스 + JSON 구현
├── log/                     텍스트 렌더러 (판단 함수 호출 금지) + 조사 처리
├── scenario/coreGameplay.ts 시나리오
├── data/definitions.ts      Definition 2개
└── cli/                     demo / verifyRestore
```

## CORE CONTRACT 8개 규칙이 어디에 있나

| 규칙 | 구현 | 계약 테스트 |
|---|---|---|
| 1. 4단 분리 | `core/{definition,instance,agentState,actor}.ts` + `ids.ts` branded type | AgentState 미저장, 판단 모듈의 의존 방향, 스냅샷 불변성 |
| 2. State Contract 8도메인 | `instance.ts` `CharacterInstance` | 타입으로 강제 |
| 3. Event 6종 append-only | `events.ts` | 6종 외 기록 없음 / 수정·삭제 메서드 없음 / seq 연속 |
| 4. 트랜잭션 경유 | `transaction.ts` + `transactions/`, `sim/resolve.ts` | 검증 실패 시 무변경 |
| 5. L0→L1, LLM 배제 | `decision/` | fetch 0회 + src 정적 검사 |
| 6. 모든 판단에 ReasonCode | `reason.ts`, 렌더러 2개가 같은 ReasonCode 사용 | 브리핑 예시 3개와 문자열 일치 |
| 7. 죽음은 최종 | `sim/resolve.ts` `killInstance` | Instance 미삭제 + `dead` + LegacyCreation |
| 8. 중복 = 새 Instance | `instanceFactory.ts` | 다른 ID·이름·성격, 배열 비공유, 이름 유일성 |

## 설계 판단 기록

구현하면서 정해야 했던 것들. 되돌릴 수 있지만 지금은 이렇게 돼 있다.

1. **L0 우선순위**: Master 퇴각 조건 > 기억에서 파생된 목표 > 방어 명령+충성.
   즉 **캐릭터의 목표는 Master의 퇴각 조건을 넘지 못한다.** 넘게 하려면
   "명령에 비용"(신뢰 소모) 개념이 필요하다 — 미결.
2. **ReasonCode에 효용 점수를 넣지 않는다.** 플레이어에게 `rescue=71.0`은 의미가 없다.
   입력 값(trust/fear/self_risk)만 싣고, 점수는 디버거 전용으로 분리했다.
3. **AgentState는 복사본이다.** Instance의 배열을 참조로 들면 행동 후 변화가
   "판단 시점 State"에 비쳐 디버거가 거짓 근거를 보여준다. 실제로 한 번 발생했고
   회귀 테스트로 고정했다.
4. **이름은 유일하다.** 규칙 8이 "완전히 다른 이름"을 요구하므로 사용 중인 이름
   (죽은 캐릭터 포함)을 피해서 뽑는다. 풀이 소진되면 서수를 붙인다.
5. **양방향 신뢰 변화.** 구조하면 구조된 쪽(+18)과 구조한 쪽(+8) 모두 오른다.
6. **ID·난수·tick이 전부 결정론적이다.** Snapshot에 난수 상태와 ID 카운터를 저장하므로
   복원 후 이어서 소환해도 저장 전과 같은 결과가 나온다.

## 다음 단계 (브리핑 5절, 지금 만들지 않음)

캐릭터 State 4명 → L2 GOAP → Memory/Relationship 비교표 → 10층 미션 → 첫 사망 →
History → Legacy → 소환 확장 → 30분 플레이 시나리오 → LLM 서술 연동.
