# G. 월드 / 세력 / 퀘스트 / 원정

## 31. World Architecture

World Partition은 대규모 월드를 Grid Cell로 스트리밍하는 기반이며 Data Layers는 퀘스트/진행/이벤트에 따라 환경과 Gameplay Actor를 런타임에서 교체할 수 있다. HLOD는 비활성 셀의 대규모 정적 메시를 Proxy로 표현해 드로 콜과 로딩 부담을 줄이는 데 사용한다. [R5][R6][R7]

## 32. Simulation Entity vs Physical Actor

```
SIMULATION ENTITY -> Interest Scheduler -> Physical Spawn -> Runtime Actor -> Despawn -> State Snapshot -> Simulation Entity
```

모바일에서 가장 중요한 확장 전략이다. NPC 10,000명이 존재해도 10,000개 Actor가 동시에 존재하는 것이 아니다.

## 33. Faction System

| Domain | State |
|---|---|
| Power | Territory, Military, Wealth, Information |
| Goals | Expansion, Survival, Profit, Revenge |
| Diplomacy | Alliance, Neutral, Trade, War |
| Internal | Leader, Factions, Succession, Revolt |
| Assets | Cities, Facilities, Troops, Treasury |
| History | War, Treaty, Betrayal, Discovery |

## 34. Quest System

고정 퀘스트와 시뮬레이션 파생 퀘스트를 혼합한다. NPC Goal, Faction Conflict, Economic Event, World Discovery, Player Action, Historical Event가 생성 소스다.

## 35. Expedition / Dungeon

원정은 Master 명령과 Agent 자율성의 결합 콘텐츠다. 정보 부족이 위험을 높이고, 정찰과 실패가 다음 탐험의 난이도와 목표를 바꾼다.

## 36. World Event / History

모든 주요 변화는 Event ID를 갖는다. World History는 플레이어가 만든 전쟁, 사망, 도시 성장, 발견, 길드 사건을 장기 기록한다. History는 UI/퀘스트/후계/Memory/Analytics의 공통 데이터가 된다.
