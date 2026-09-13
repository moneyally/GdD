# L. QA / Analytics / LiveOps / Admin

## 66. QA Matrix

| Area | Tests |
|---|---|
| Gameplay | Combat, Mission, Quest, Save/Load |
| Agent | State consistency, memory relevance, goal persistence |
| Economy | Inflation, duplication exploit, source/sink |
| Social | Guild, Trade, Mail, Chat |
| Gacha | Odds, pity, duplicate resolution, receipt replay |
| Content | Asset dependency, missing reference, cook |
| Mobile | Device tier, thermal, battery, background/foreground |
| Network | Reconnect, packet loss, server migration |
| Security | Unauthorized reward/item changes |
| Store | IAP/restore/refund flows |

## 67. AI Evaluation

- State Consistency
- Memory Relevance
- Goal Persistence
- Behavior Diversity
- Safety/Rule Compliance
- Simulation Cost
- LLM Escalation Rate
- Human-perceived Plausibility

## 68. Analytics / Telemetry

| Event | Examples |
|---|---|
| Session | login, lobby_enter, mission_start |
| Character | level_up, death, growth_change |
| Memory | memory_created, recalled, summarized |
| Gacha | banner_view, pull, pity, duplicate |
| Synthesis | recipe_start, success, failure |
| Guild | create, join, donate, withdraw, war |
| Economy | price_change, currency_sink/source |
| AI | decision_tier, LLM_call, latency |
| Server | tick, CPU, memory, crash |
| Mobile | FPS, frame time, thermal, battery |
| Store | purchase, restore, refund |

## 69. Admin / GM Tools

- Player search
- Character inspection
- Inventory/ownership audit
- Gacha configuration
- Quest reset
- Mission cancel
- Guild management
- Economy dashboards
- World event controls
- AI debugger
- Memory debugger
- Event timeline
- Ban/Unban
- Compensation tool
- Rollback tools
- Server health

## 70. NPC/Agent Debugger

```
NPC ID
Current Goal
Top Memories
Relationship Summary
Emotion
Needs
Decision Layer
Candidate Actions
Selected Action
Reason Codes
Recent Events
Growth Delta
```

이 화면은 개발/QA에서 필수다. Agent 행동이 이상할 때 모델/LLM을 먼저 의심하지 않고 State -> Retrieval -> Goal -> Utility -> Planner의 각 층을 관찰할 수 있어야 한다.

## 71. LiveOps

- Banner/Gacha schedules
- Event rotation
- Guild seasons
- World events
- Limited quests
- Reward tables
- Pricing
- Localization content
- Server notices
- Compensation
- AB experiments
