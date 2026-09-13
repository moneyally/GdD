# Living World — Game Design Document

> 플레이어가 세계를 소비하는 것이 아니라, 자신의 행동으로 세계의 역사를 만든다.

**Persistent Agent World / Master Strategy RPG / Online Simulation**

| | |
|---|---|
| 현행 기준 문서 | **v3.0 Production Baseline** (`docs/`) |
| 출시 플랫폼 | Android + iOS |
| PC | 출시 대상 아님 — 개발 클라이언트 / 서버 QA / 에셋 검수 / 툴링 전용 |
| 문서 범위 | Game Design + System Design + Content Production + Live Service Operations |

이 레포는 기획 문서의 **단일 진실 원천(SSOT)** 이다. 원본 파일은 `source/`에 보존하고,
읽고 리뷰하고 diff를 볼 대상은 `docs/`의 마크다운이다.

---

## 핵심 명제

이 프로젝트의 경쟁력은 LLM·가챠·그래픽 중 하나가 아니다. 핵심은 **폐루프**다.

```
소유권 있는 캐릭터 → 지속 상태 → 판단 → 행동 → 세계 변화 → 기억/성장 → 다시 상태
```

최종 경험의 판정 기준: *"내가 이 게임을 플레이했다"가 아니라 "내가 이 세계에 내 역사를 남겼다."*

## 설계 기둥

| Pillar | Must Ship | Cut First |
|---|---|---|
| Persistent Identity | Save + Memory + Relationship | 고급 감정 물리 |
| Autonomous Agency | Utility + GOAP | 상시 LLM |
| Consequential World | Event + World State | 장식성 월드 디테일 |
| Strategic Mastery | Mission + Formation | 마이크로 조작 |
| Scalable Simulation | Tiered Simulation | 모든 NPC 실시간 Actor |
| Mobile First | Touch + Performance Budget | PC 전용 고품질 효과 |
| Human Attachment | Legacy + Social | 복잡한 사회법칙 초기 도입 |

---

## 문서 색인

| 챕터 | 내용 | 절 |
|---|---|---|
| [00 Front Matter](docs/00-front-matter.md) | 문서 정보 / 버전 / 핵심 명제 | — |
| [A. 제품 정의와 경험](docs/01-A-product-definition.md) | Executive Summary, Pitch, Pillars, Target, Non-Goals | 1–5 |
| [B. 게임 루프와 메타 구조](docs/02-B-game-loop.md) | Core Loop, Session Flow, Lobby, Master Command | 6–9 |
| [C. 캐릭터 / Self Model / Agent](docs/03-C-character-agent.md) | State Contract, Memory, Decision Stack, 자율성장 | 10–15 |
| [D. 전투 / 성장 / 스킬](docs/04-D-combat-growth-skill.md) | Combat Model, Skill Definition / Mastery / Evolution | 16–19 |
| [E. 가챠 / 소유권 / 합성 / 제작](docs/05-E-gacha-ownership-synthesis.md) | Gacha, Duplicate Resolver, Synthesis, Item | 20–25 |
| [F. 길드 / 소셜 / 거래 / 경제](docs/06-F-guild-social-economy.md) | Social Graph, Guild, Matchmaking, Market, Economy | 26–30 |
| [G. 월드 / 세력 / 퀘스트 / 원정](docs/07-G-world-faction-quest.md) | World Partition, Sim Entity vs Actor, Faction, Quest | 31–36 |
| [H. 백엔드 / 서버 / 데이터 / 보안](docs/08-H-backend-data-security.md) | Service Boundary, Ownership Ledger, Bundle, Payment | 37–44 |
| [I. Asset Master Catalog / Production](docs/09-I-asset-catalog-production.md) | 물량, 네이밍, 파이프라인, 라이선스, 검수 | 45–56 |
| [J. Mobile-First 기술 규격](docs/10-J-mobile-tech-spec.md) | Platform Matrix, Tier, Runtime Budget, CDN, Build | 57–61 |
| [K. UI/UX / Localization / A11y](docs/11-K-ui-localization-accessibility.md) | 모바일 UI 원칙, 화면 목록, 로컬라이즈, 접근성 | 62–65 |
| [L. QA / Analytics / LiveOps / Admin](docs/12-L-qa-analytics-liveops.md) | QA Matrix, AI 평가, 텔레메트리, GM 툴, Agent 디버거 | 66–71 |
| [M. Staffing / Production / Governance](docs/13-M-staffing-governance.md) | 조직, 외주, 리뷰 게이트, 피처 거버넌스 | 72–75 |
| [N. 개발 단계 / Acceptance Gates](docs/14-N-phases-acceptance-gates.md) | Phase 0–4, 확장 트리, 스케일 전략, 합격 기준 | 76–83 |
| [O. 부록 — Data / ID / Risk / Ref](docs/15-O-appendix-data-id-risk.md) | ID 규칙, 트랜잭션 패턴, 리스크 레지스터, 레퍼런스 | 84–87 |
| [최종 설계 명제](docs/16-final-design-thesis.md) | Final Design Thesis | 88 |

### 그 외

- [`CORE.md`](CORE.md) — **CORE GAMEPLAY 구현 현황** (증명 결과, 구조, 계약 매핑)
- [`docs/logs/core-gameplay-sample.txt`](docs/logs/core-gameplay-sample.txt) — 실행 로그 샘플 (4명)
- [`docs/logs/decision-comparison.md`](docs/logs/decision-comparison.md) — **판단 비교표** (기억/관계가 행동을 바꾸는 표)
- [`docs/logs/tower-climb-sample.txt`](docs/logs/tower-climb-sample.txt) — 탑 10층 등반 로그
- [`docs/logs/tower-balance.txt`](docs/logs/tower-balance.txt) — Master 명령별 결과 분포
- [`CHANGELOG.md`](CHANGELOG.md) — v1 → v3.0 변경 이력
- [`OPEN-QUESTIONS.md`](OPEN-QUESTIONS.md) — **미해결 / 확인 필요 항목** (v3.0에서 누락되거나 충돌하는 내용)
- [`docs/legacy/v1-initial-design.md`](docs/legacy/v1-initial-design.md) — 초기 설계 문서 37절 (참조용)
- [`source/`](source/) — 원본 DOCX / PDF

---

## 지금 어디까지 왔나

문서 기준 단계는 **Phase 0 — Preproduction**이다. 구현물은 아직 없다.

| Phase | 합격 기준 | 상태 |
|---|---|---|
| 0 Preproduction | 스키마·명명·기기 매트릭스·기술 스파이크 | 진행 중 (문서화 완료) |
| CORE GAMEPLAY 증명 | 상태가 판단을 바꾸고, 그 결과가 다음 판단을 바꾸는가 | **통과** — [`CORE.md`](CORE.md) |
| 4명 State / L2 GOAP / 비교표 | 계층형 판단(L0→L2→L1)과 다단계 계획 | **통과** |
| 탑 10층 미션 | 파티 등반, 첫 사망, Master 명령이 결과를 바꾸는가 | **통과** — 테스트 58개 |
| 1 Agent Vertical Slice | 캐릭터 1종이 Spawn → 판단 → 성장 → 저장 → **재접속 후 동일 존재로 복원** | 저장/복원 검증 완료, 나머지 미착수 |
| 2 Small World | 지역 1개 / NPC 50–100 / 원정 1 / 던전 1 / 최소 경제·길드 | 미착수 |
| 3 Alpha | 다중 Master, 길드, 거래, 시장, 가챠, 합성, LiveOps | 미착수 |
| 4 Scale | 100 → 500 → 1,000+ NPC Simulation Scheduler 확장 | 미착수 |

Phase 1의 합격 기준이 이 프로젝트의 **첫 번째 진짜 증명**이다.

---

## 문서 작업 방법

`docs/`는 `source/`의 DOCX에서 생성된다. 원본을 갱신했다면:

```bash
python3 tools/split_chapters.py          # source/*.docx -> docs/*.md 재생성
python3 tools/docx_to_md.py --outline    # 챕터/절 구조만 확인
```

마크다운을 직접 고친 경우에는 원본 DOCX에도 같은 변경을 반영해야 한다.
두 쪽이 갈라지면 `docs/`를 기준으로 삼고 DOCX를 다시 내보낸다.

## 규칙

- 문자열 하드코딩 금지 — 모든 텍스트는 Localization Key 기반
- 에셋 파일명에 공백·한글·특수문자 금지 (`docs/09` 46절 명명 규칙)
- 서버가 게임 상태의 권위를 가진다. LLM은 재화·아이템·피해량·사망·보상을 직접 변경하지 않는다
- 독자적 세계관·명칭·캐릭터·지역·스토리·아트 스타일을 구축한다. 기존 작품의 고유 자산을 복제하지 않는다
