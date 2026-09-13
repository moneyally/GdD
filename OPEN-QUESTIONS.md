# 미해결 / 확인 필요 항목

문서를 읽으면서 발견한 **결정이 필요한 것들**. 해결되면 해당 절에 반영하고 여기서 지운다.
`[의도적 보류]`는 문서가 스스로 "나중에 확정한다"고 명시한 항목이라 문제가 아니다.

---

## 1. 기술 스택이 v3.0에서 빠졌다 — **중요**

v1-22절에 있던 스택 지정이 v3.0 본문에 없다. 지금은 UE 5.8 레퍼런스([R1][R2][R5]–[R8])만 남아
"클라이언트/게임서버는 UE5"만 간접적으로 확인된다. 백엔드·AI·DB는 문서상 미지정 상태다.

v1 기준:

| 레이어 | v1-22 지정 |
|---|---|
| 게임 클라이언트 / 게임 서버 | Unreal Engine 5 + C++ / Blueprint |
| Backend | TypeScript 또는 C++ |
| AI / ML | Python |
| DB | PostgreSQL |
| Cache | Redis |
| Analytics | ClickHouse 계열 |

v3.0의 H-39절 Database Domains는 PostgreSQL / Redis / ClickHouse / Object Storage를 그대로
쓰고 있어 DB 쪽은 사실상 유지된 것으로 보인다. **결정이 필요한 것은 Backend 언어다** —
"TypeScript 또는 C++"는 둘 중 하나를 고르라는 미결 상태이며, 조직 계획(M-72)은
Backend Engineers와 AI/Simulation Engineer를 별도 역할로 분리하고 있다.

→ **할 일**: 챕터 H에 `기술 스택` 절을 추가하고 Backend 언어를 확정한다.

## 2. IP 원칙이 v3.0에서 빠졌다 — **중요**

v1-34절의 IP 원칙(독자 세계관 구축 / 기존 작품 고유 자산 복제 금지)이 v3.0에 없다.
양산 문서에는 이것이 **더** 필요하다. v3.0은 외주(M-73)와 AI 생성 에셋(I-54의 Source에
`AI` 항목 존재)을 전제하므로, 원칙이 명문화되지 않으면 외주 계약서와 에셋 검수 게이트에
근거가 없다.

→ **할 일**: 챕터 I 또는 M에 `IP / 콘텐츠 원칙` 절을 추가하고, I-54 라이선스 레지스트리와
I-56 Legal 검수 게이트가 이 절을 참조하게 한다.

## 3. 성공 지표 / 개발 순서 누락

- v1-32 **성공 지표** 8개(NPC 장기 일관성, Player Authorship, Emergent Event Rate, Memory
  Relevance, Simulation Cost, LLM Cost per Active Player, Retention, Death Meaningfulness).
  v3.0에는 L-67 AI Evaluation과 L-68 Analytics가 있으나 이건 *측정 항목*이고, v1-32는
  *제품 성공 판정 기준*이라 층이 다르다. N-83 Acceptance Gates와 연결되어야 한다.
- v1-31 **개발 순서**는 N-76~80 Phase 정의로 대체된 것으로 보인다. 다만 v1-31은 모듈
  구현 순서까지 지정하므로 Phase 1 착수 시 참고 가치가 있다.

→ **할 일**: 성공 지표를 챕터 N(또는 A)에 복원. 개발 순서는 legacy 참조로 충분한지 판단.

## 4. 영구 사망(Permadeath)의 MVP 포함 여부 — 스코프 충돌

- v1-29절 MVP 범위: **"영구 사망"을 명시적으로 포함**
- v3.0 N-77 Phase 1 / N-78 Phase 2: 영구 사망 언급 없음. Legacy는 C-11 State Contract의
  `Legacy (DeathState, Heir, Relics, Reputation)` 필드와 N-81 확장 트리
  (`Generation, heirs, memory inheritance`)에만 등장 — 즉 **후반 확장 항목으로 밀려 있다**

이건 단순 누락이 아니라 설계 판단 문제다. Pillar `Human Attachment`의 Must Ship이
"Legacy + Social"이므로 **기둥은 Legacy를 필수로 요구하는데 Phase 계획은 확장으로 미룬다**.
죽음이 의미를 갖지 않으면 A-3의 기둥과 v1-32의 Death Meaningfulness 지표가 둘 다 검증 불가다.

→ **결정 필요**: 영구 사망을 Phase 2에 넣을지, 아니면 Pillar의 Must Ship을 "Social"만으로
축소할지. 둘 중 하나는 고쳐야 한다.

## 5. 문서 구조 목차가 실제 챕터와 어긋난다 — 경미

`docs/00-front-matter.md`의 목차는 A–P 16챕터를 선언하지만 실제 본문은 A–O 15챕터다.
목차에서 챕터 I로 잡혀 있던 `Content Delivery & Ownership Architecture`가 본문에서는
챕터 H의 41절로 들어갔고, 그 결과 I 이후가 한 칸씩 밀렸다.

| 목차 선언 | 실제 본문 |
|---|---|
| I. Content Delivery & Ownership | (H-41로 흡수) |
| J. Asset Master Catalog | I. Asset Master Catalog |
| K. Mobile-First | J. Mobile-First |
| L. UI/UX | K. UI/UX |
| M. QA | L. QA |
| N. Staffing | M. Staffing |
| O. 개발 단계 | N. 개발 단계 |
| P. 부록 | O. 부록 |

또한 88절 Final Design Thesis는 O 챕터 소속이어야 하나 Heading 1로 잡혀 있다.

→ **할 일**: 원본 DOCX의 목차를 실제 구조에 맞게 수정. 이 레포의 `docs/` 파일명은 실제
본문 구조(A–O)를 따랐다.

---

## 6. CORE GAMEPLAY 구현에서 새로 생긴 결정 항목

브리핑(`CORE.md`)대로 구현하면서 실제로 정해야 했던 것들. 지금은 임시 결정 상태다.

### 6-1. 소유권이 Definition에 귀속된다는 명시가 없다

브리핑 규칙 7(죽음은 최종) + 규칙 8(중복은 새 Instance)의 조합은 **소유권이
Definition(혈통)에 붙고 Instance는 소모된다**는 구조를 만든다. 이 구조 덕분에
영구사망과 유료 소환이 공존할 수 있다 — 위 4번의 모순이 해소된 경로다.

그런데 브리핑에 그 문장이 없다. MVP에 과금이 없으니 지금 문제는 아니지만,
스토어 심사·환불 정책의 근거가 되므로 CORE CONTRACT에 한 줄 추가를 권한다.

### 6-2. 캐릭터의 목표가 Master 명령을 넘어설 수 있는가

현재 L0 우선순위: **Master 퇴각 조건 > 기억에서 파생된 목표 > 방어 명령+충성.**

즉 기억이 만든 `never_abandon_ally` 목표는 퇴각 조건을 넘지 못한다. 플레이어 통제감을
우선한 선택이다. 반대로 하면 "캐릭터가 명령을 거스른다"는 드라마가 생기지만,
통제 불능처럼 느껴지지 않으려면 **명령에 비용**(신뢰·권한 소모) 개념이 필요하다.

### 6-3. History 단조 증가

규칙 7+8 조합이면 죽은 Instance가 계속 쌓인다. 현재는 Instance 전문이 Snapshot에
남는다. MVP 규모에선 문제없지만 보존 정책(요약 레코드로 압축하는 시점)을 정해야 한다.

실측: 10층 등반 1회를 끝낸 세이브가 **4명 33KB — 1명당 약 8.2KB**
(`golden/tower-snapshot.json`). 기억과 이벤트가 쌓이면 1명당 값도 같이 는다.
100명이면 0.8MB 수준이라 당장은 여유가 있지만, 죽은 Instance를
"이름·성격·마지막 기억 3개"로 압축하는 시점을 정해두는 편이 낫다.

---

## 의도적 보류 (문제 아님)

문서가 스스로 "Vertical Slice 이후 확정"이라고 명시한 항목들. 지금 채우려 하면 안 된다.

- **기기별 해상도 / RAM / GPU 예산** — J-58: "실제 대표기기군을 벤치마크한 뒤 확정"
- **에셋 물량** — I-45: "초기 가설이며 Vertical Slice의 제작 속도와 메모리 예산 측정 후 재산정"
- **런타임 예산 수치** — J-59는 정책만 정의, 숫자는 없음
- **전투 공식** — D-17 SkillDefinition에 `Formula` 필드만 정의, 실제 수식 없음
- **가격 / 수익화 수치** — L-71 LiveOps에 Pricing 항목만 존재
- **Skill Variant 생성 규칙** — D-19: "초기에는 단순 Tier/Level, 장기적으로 변형 생성"
