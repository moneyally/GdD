# N. 개발 단계 / Acceptance Gates / 확장

## 76. Phase 0 - Preproduction

- World concept
- Master loop
- Agent state schema
- Backend domain model
- Asset naming
- Mobile device matrix
- First 3D asset
- Technical spike

## 77. Phase 1 - Agent Vertical Slice

실제 3D 캐릭터 1종이 게임 서버에 Spawn되고, 명령을 받고, 자신의 State/Memory/Goal에 따라 행동하며, 이벤트를 만들고, 성장하고, 저장 후 재접속해 같은 상태로 복원된다.

## 78. Phase 2 - Small World

지역 1개, 일반 NPC 50~100명, 캐릭터 10~20명, 원정 1종, 던전 1개, 경제 최소 모델, 길드 최소 모델을 구현한다.

## 79. Phase 3 - Alpha

동시 다중 Master, 길드, 거래, 시장, 가챠, 합성, LiveOps config, Mobile Tier QA를 연결한다.

## 80. Phase 4 - Scale

100 -> 500 -> 1,000+ active/abstract NPC로 Simulation Scheduler를 확장하고, 지역/세력/경제를 단계적으로 추가한다.

## 81. Expansion Tree

| Existing System | Expansion |
|---|---|
| Character/Agent | Generation, heirs, memory inheritance, advanced social |
| Skill | Variants, combos, team synergy |
| Gacha | Collections, cosmetics, pity, seasonal banners |
| Synthesis | Crafting, dismantling, reroll, set effects |
| Guild | Research, guild boss, war, territory |
| Economy | Auction, trade routes, regional markets |
| World | New regions, continents, eras, disasters |
| Faction | Diplomacy, politics, civil wars |
| Social | Mentor, friendship, marriage if appropriate |
| UGC | Player-authored quests/regions with moderation |

## 82. Scale Strategy

| Scale | Simulation | Physical |
|---|---|---|
| 100 NPC | Mostly active | Many allowed |
| 1,000 | Tiered | Interest-based |
| 10,000 | Abstract + Scheduler | Small active subset |
| 100,000+ | Regional aggregates | Rarely materialized |

## 83. Acceptance Gates

| Gate | Pass | Stop/Reduce |
|---|---|---|
| Agent Prototype | Behavior driven by state | State has no causal effect |
| Vertical Slice | Same character returns with history | Persistence fails |
| Small World | Events create repeatable narratives | Only scripted |
| Alpha | Economy/Guild/Save stable | Duplication exploits |
| Beta | Retention/Crash/Performance acceptable | Core loop weak |
| Launch | Ops/Security/Store ready | Severe exploit / store risk |
