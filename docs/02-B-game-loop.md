# B. 전체 게임 루프와 메타 구조

## 6. Core Loop

```
WORLD OBSERVE -> MASTER GOAL -> FORMATION -> PREPARE -> EXPEDITION / MISSION -> AGENT DECISION -> EVENT -> REWARD / LOSS -> MEMORY / GROWTH -> WORLD CHANGE -> NEW GOAL
```

## 7. Session Flow

```
BOOT -> AUTH -> PROFILE LOAD -> LOBBY -> SOCIAL / GACHA / SYNTHESIS / LOADOUT -> MISSION PREP -> MATCHMAKING -> GAME SERVER -> WORLD LOAD -> SPAWN -> GAMEPLAY -> COMPLETE / FAIL -> EVENTS -> SAVE -> RETURN LOBBY
```

## 8. Lobby

Lobby는 실제 Simulation World와 분리된 메타 공간이다. 로그인 후 대부분의 경제/수집/성장/사회 활동은 Lobby에서 처리하고, 실시간 전투 및 탐험은 Dedicated Game Server 세션에서 처리한다.

- Master Dashboard
- Character Collection
- Gacha
- Synthesis/Crafting
- Equipment
- Skill Build
- Guild/Social
- Mail
- Market
- Mission Planner
- World Map
- Event/News
- Settings/Accessibility

## 9. Master Command Model

| Input | Meaning |
|---|---|
| Goal | 달성해야 할 상태 |
| Priority | 여러 목표 간 우선순위 |
| Constraints | 금지 행동/최대 손실 |
| Risk Policy | 위험 허용도 |
| Fallback | 실패/부상 시 대체 행동 |
| Information Policy | 정찰/탐색 수준 |
| Formation | 파티 구성/역할 |
| Resource Budget | 소모 허용량 |
