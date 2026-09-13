# A. 제품 정의와 경험

## 1. Executive Summary

이 게임은 플레이어가 Master가 되어 캐릭터 집단, 원정 파티, 길드와 세력을 관리하면서 살아있는 세계에 개입하는 모바일 온라인 전략 RPG다. 핵심 기술은 LLM 자체가 아니라 지속되는 Agent State, Memory, Goal, Relationship, World Event의 폐루프다.

모든 중요 캐릭터는 영속적인 Identity를 가지고, 플레이어가 로그아웃한 뒤에도 저해상도 시뮬레이션을 통해 상태가 변한다. 다시 로그인하면 그 결과가 기억, 관계, 성장, 경제, 역사로 돌아온다.

최종 플랫폼은 Android와 iOS다. PC는 출시 대상이 아니라 개발 클라이언트, 서버 디버깅, 에셋 검수, 자동화 테스트, 운영 도구 전용이다. 모바일의 GPU/CPU/RAM/열/배터리/네트워크 제약은 기획의 최상위 제약조건이다. UE 5.8은 모바일용 렌더링 경로, Device Profiles, Animation Budget Allocator, PSO Cache 등 모바일 최적화 도구를 제공한다. [R1][R2]

## 2. Elevator Pitch

한 문장: "플레이어가 모든 행동을 직접 조종하는 대신, 하나의 살아있는 세계에 목표와 전략을 내리고 자율적인 캐릭터들이 그 결과를 역사로 만들어가는 모바일 온라인 RPG."

차별화 문장: "AI NPC와 대화하는 게임"이 아니라 "과거의 나와 연결된 캐릭터가 다음 행동을 결정하는 게임"이다.

## 3. Product Pillars

| Pillar | Player Value | Must Ship | Cut First |
|---|---|---|---|
| Persistent Identity | 캐릭터 애착 | Save + Memory + Relationship | 고급 감정 물리 |
| Autonomous Agency | 예측 불가능한 전략 | Utility + GOAP | 상시 LLM |
| Consequential World | 행동의 역사성 | Event + World State | 장식성 월드 디테일 |
| Strategic Mastery | 준비와 판단 | Mission + Formation | 마이크로 조작 |
| Scalable Simulation | 큰 세계의 느낌 | Tiered Simulation | 모든 NPC 실시간 Actor |
| Mobile First | 언제 어디서나 플레이 | Touch + Performance Budget | PC 전용 고품질 효과 |
| Human Attachment | 관계/죽음의 의미 | Legacy + Social | 복잡한 사회법칙 초기 도입 |

## 4. Target Player

| Segment | Needs | Primary Experience |
|---|---|---|
| Collector | 캐릭터/에셋 수집 | 가챠, 도감, 스킨 |
| Strategist | 최적화와 조합 | Skill Build, Formation, Mission |
| Narrative Player | 관계와 사건 | Memory, Relationship, History |
| Social Player | 길드/친구 | Guild, Party, Trade, War |
| Explorer | 새 지역 발견 | Expedition, Dungeon, World Event |
| Creator/Operator | 세계에 영향 | Faction, Economy, Future UGC |

## 5. Non-Goals / Scope Protection

- 초기부터 MMO 규모의 1만 Actor를 실시간 렌더링하지 않는다.
- 모든 NPC에 LLM을 붙이지 않는다.
- PC 고사양을 기준으로 에셋을 만든 뒤 모바일에 축소하지 않는다.
- 서비스 초기부터 마이크로서비스를 무조건 분리하지 않는다.
- 콘텐츠를 AI 생성만으로 대체하지 않는다.
- 가챠를 캐릭터 전투력의 유일한 원천으로 만들지 않는다.
