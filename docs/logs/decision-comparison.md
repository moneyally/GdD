# 비교표 — Memory / Relationship이 판단을 바꾸는가

`npm run compare`로 생성. 성격은 고정(risk=50, loyalty=70, aggression=55)하고
상황도 고정(위협도 70, 명령 goal=advance,
퇴각조건 체력 0.3 미만)했다.
즉 아래 표에서 결과를 가르는 것은 **감정 · 관계 · 기억 · 체력뿐**이다.

### fear × trust (건강한 상태)

기억이 없으면 **신뢰와 침착이 둘 다 있어야** 구하러 간다. 하나라도 부족하면 물러선다.
기억이 생기면 네 경우 모두 구하러 간다 — 단, L1 효용이 아니라 L2 계획으로 간다.

| fear | trust(동료) | 체력 | 기억 없음 | 기억 있음 (`ally_died_by_my_retreat` 90 + 목표) |
|---|---|---|---|---|
| 20 | 80 | 1.00 | RESCUE `L1` | RESCUE `L2` RESCUE→FALL_BACK |
| 80 | 20 | 1.00 | RETREAT `L1` | RESCUE `L2` SUPPRESS→RESCUE→FALL_BACK |
| 80 | 80 | 1.00 | RETREAT `L1` | RESCUE `L2` SUPPRESS→RESCUE→FALL_BACK |
| 20 | 20 | 1.00 | RETREAT `L1` | RESCUE `L2` RESCUE→FALL_BACK |

### 체력 × 기억 (fear=20 고정)

기억이 있으면 방법을 찾는다. 몸이 상하면 계획에 연막이 들어오고,
더 상하면 계획 자체가 사라진다. 계획이 사라져도 기억은 L1 효용에 남아 있으므로
체력 0.50에서는 **계획 없이 감정만으로** 뛰어들고, 0.40에서는 결국 물러선다.
기억은 캐릭터를 무적으로 만들지 않는다.

| fear | trust(동료) | 체력 | 기억 없음 | 기억 있음 (`ally_died_by_my_retreat` 90 + 목표) |
|---|---|---|---|---|
| 20 | 20 | 1.00 | RETREAT `L1` | RESCUE `L2` RESCUE→FALL_BACK |
| 20 | 20 | 0.80 | RETREAT `L1` | RESCUE `L2` SUPPRESS→RESCUE→FALL_BACK |
| 20 | 20 | 0.60 | RETREAT `L1` | RESCUE `L2` SUPPRESS→RESCUE→FALL_BACK |
| 20 | 20 | 0.50 | RETREAT `L1` | RESCUE `L1` |
| 20 | 20 | 0.40 | RETREAT `L1` | RETREAT `L1` |

### 계획 가능 경계 — 부상과 공포가 계획을 바꾸는 지점

부상은 두 방향으로 작용한다. 체감 위협(`self_risk`)을 올리고, 동시에 감당하겠다고
판단하는 상한(`tolerable`)을 내린다. 공포는 상한만 내린다.
둘이 교차하면 맨몸 구조가 불가능해져 연막이 계획에 들어오고, 더 벌어지면 계획이 사라진다.

아래는 기억(목표)을 가진 상태에서 체력과 공포만 바꾼 결과다.

| 체력 | self_risk | tolerable (fear=20) | 계획 (fear=20) | tolerable (fear=80) | 계획 (fear=80) |
|---|---|---|---|---|---|
| 1.00 | 70 | 75 | RESCUE→FALL_BACK | 60 | SUPPRESS→RESCUE→FALL_BACK |
| 0.80 | 78 | 67 | SUPPRESS→RESCUE→FALL_BACK | 52 | SUPPRESS→RESCUE→FALL_BACK |
| 0.60 | 87 | 59 | SUPPRESS→RESCUE→FALL_BACK | 44 | 없음 → 포기 |
| 0.50 | 91 | 55 | 없음 → 포기 | 40 | 없음 → 포기 |
| 0.40 | 95 | 51 | 없음 → 포기 | 36 | 없음 → 포기 |

### ReasonCode 샘플

- 신뢰 높고 침착 · 기억 없음
  ```
  RESCUE(target=CHR_9001,trust=80,fear=20,self_risk=70)
  ```
- 겁많고 불신 · 기억 없음
  ```
  RETREAT(fear=80,self_risk=70,trust=20)
  ```
- 겁많고 불신 · **기억 있음**
  ```
  RESCUE(goal=never_abandon_ally,plan=SUPPRESS→RESCUE→FALL_BACK,cost=6.6,source=MEM_9001 overrides fear=80)
  ```
- 부상 · **기억 있음** (연막이 계획에 들어온다)
  ```
  RESCUE(goal=never_abandon_ally,plan=SUPPRESS→RESCUE→FALL_BACK,cost=7.3,source=MEM_9001 overrides fear=20)
  ```
- 중상 · **기억 있음** (계획 불가 → 목표 포기)
  ```
  RETREAT(fear=20,self_risk=95,trust=20,memory=ally_died_by_my_retreat)
  ```

---

## 읽는 법

- `L1` — 단일 행동의 효용 비교로 결정. 감정과 관계가 직접 작용한다
- `L2` — 기억에서 나온 목표가 있어 계획을 세웠다. 화살표가 계획의 순서다
- `L0` — 하드 규칙(Master 퇴각 조건 등)이 판단을 확정했다

기억 열은 **한 칸만 다르다**. 같은 감정, 같은 관계, 같은 체력, 같은 명령에서
기억 하나가 행동을 바꾸는 것이 이 표의 주장이다.

