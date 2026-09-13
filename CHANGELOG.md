# 변경 이력

## v3.0 Production Baseline — `source/Living_World_Mobile_Production_GDD_v3.3.docx`

초기 설계 문서(v1)를 **모바일 양산·운영 기준 문서**로 확장. 88개 절 / A–O 15챕터.

### 추가된 영역 (v1에 없던 것)

| 영역 | 내용 | 위치 |
|---|---|---|
| 플랫폼 확정 | Android + iOS 출시, PC는 개발·QA·툴 전용으로 명문화 | A-1, J-57 |
| Product Pillars | 7개 기둥에 각각 **Must Ship / Cut First** 지정 | A-3 |
| Non-Goals | 스코프 보호 6개 항목 | A-5 |
| 가챠 데이터 모델 | Banner / Pool / Transaction / ProbabilityDisclosure / PityState | E-21 |
| Duplicate Resolver | 중복 획득을 Shard / Ascension / Mastery로 해소 | E-22 |
| 합성 경제 | 7종 레시피 + 서버 원자적 트랜잭션 규약 | E-23 |
| 스토어 컴플라이언스 | Apple·Google 확률 공개 의무, IAP/Play Billing, Entitlement 분리 | E-20, H-44 |
| Ownership Ledger | 소유권 도메인 분리 + 멱등성 + 감사 이벤트 | H-40, O-85 |
| Content Bundle 전략 | Core / Lobby / Gameplay / Combat / Voice / Event 6단 번들 | H-41, H-42 |
| Asset Master Catalog | MVP / Launch / 장기 물량 가설 + 카테고리별 수량 | I-45 |
| 에셋 파이프라인 | Character / Environment / Weapon / Animation / VFX / Audio / UI 7종 | I-47–53 |
| 에셋 라이선스 레지스트리 | 출처·상용 가능 여부·증빙·교체 계획 필수 기록 | I-54 |
| DCC → UE5 임포트 계약 | 에셋 유형별 필수 계약 항목 | I-55 |
| 모바일 성능 Tier | Low / Mid / High / Flagship + FPS 목표 + 정책 | J-58 |
| 런타임 예산 | CPU·GPU·RAM·스토리지·배터리·네트워크·애니메이션·Actor 수 | J-59 |
| CDN / 패치 | Manifest + Hash + Delta/Chunk, On-Demand Content Pack | J-60 |
| 빌드 파이프라인 | Commit → CI → Cook → Device Test → Store → Telemetry → Rollback | J-61 |
| 접근성 | 10개 항목 (텍스트 크기, 색약, 플래시, 터치 최소 크기 등) | K-65 |
| QA Matrix | 10개 영역별 테스트 정의 | L-66 |
| Agent 디버거 | Goal / Memory / Emotion / Decision Layer / Reason Code 관찰 화면 | L-70 |
| LiveOps | 배너·이벤트·시즌·보상·가격·공지·보상지급·AB | L-71 |
| 조직 / 외주 | 17개 역할의 초기·확장 인원, 외주 분담 모델 | M-72, M-73 |
| 피처 거버넌스 | 7개 게이트 + 각 게이트의 Cut Rule | M-75 |
| Acceptance Gates | Phase별 통과/중단 기준 | N-83 |
| 리스크 레지스터 | 10개 리스크 + 조기 신호 + 대응 | O-86 |
| 레퍼런스 | R1–R9 (UE 5.8 문서, Apple/Google 정책) | O-87 |

### 유지된 핵심 (v1 → v3.0 불변)

- 폐루프 명제: 상태 → 판단 → 행동 → 세계 변화 → 기억/성장
- 4층 분리: CharacterDefinition / CharacterInstance / AgentState / PhysicalActor
- 계층형 의사결정: L0 Rule → L1 Utility → L2 GOAP → L3 Tactical → L4 LLM
- LLM은 게임 상태의 진실 원천이 아니며 재화·아이템·피해량·사망·보상을 직접 변경하지 않음
- Tiered Simulation: NPC 10,000 ≠ Actor 10,000, Interest Scheduler로 승격/강등
- 6종 메모리 분리 + Recency / Importance / Relevance / Emotion / Relationship 가중 top-K 검색
- 서버 권위 경제 / 전투

### v3.0에서 사라진 것 (→ `OPEN-QUESTIONS.md`)

v1에는 있었으나 v3.0 본문에 대응 절이 없는 항목. 의도적 삭제인지 누락인지 확인이 필요하다.

- **기술 스택 명시** (v1-22): UE5 + C++/Blueprint, Backend TypeScript 또는 C++, AI/ML Python, PostgreSQL, Redis, ClickHouse 계열
- **성공 지표** (v1-32): NPC 장기 일관성, Player Authorship, Emergent Event Rate, Memory Relevance, Simulation Cost, LLM Cost per Active Player, Retention, Death Meaningfulness
- **개발 순서** (v1-31): UE5 프로젝트 → Git → 모듈 경계 → 에셋 임포트 → Definition → State → Agent → Memory → Personality → Goal → Utility → GOAP → Event → DB → Lobby → Dedicated Server → 자율성장 → 가챠 → 선택적 LLM
- **IP 원칙** (v1-34): 독자 세계관·명칭·캐릭터·지역·스토리·수치·아트 스타일 구축, 기존 작품 고유 자산 복제 금지
- **Death / Legacy 상세** (v1-12): 죽음을 세계 이벤트로 처리, 재산·장비·명성·관계·기록의 부분 상속. v3.0은 State Contract의 `Legacy` 필드와 확장 트리 언급만 남음

---

## v1 Initial Design — `source/Living_World_Game_Design_v1.pdf`

초기 통합 설계 문서. 37절 / 6페이지. 시스템 철학 + 기술 설계 중심.
변환본: [`docs/legacy/v1-initial-design.md`](docs/legacy/v1-initial-design.md)
