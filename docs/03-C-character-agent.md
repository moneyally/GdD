# C. 캐릭터 / Self Model / Agent

## 10. Character Definition vs Instance

```
CharacterDefinition = 개발자가 정의하는 정적 설계
CharacterInstance = 플레이어가 소유하는 영속 개체
AgentState = 현재 판단에 사용하는 상태
PhysicalActor = 현재 월드에 렌더링되는 실체
```

## 11. Character State Contract

| Domain | Fields |
|---|---|
| Identity | CharacterId, DefinitionId, Name, Origin, Age, BodyProfile |
| Personality | Risk, Loyalty, Sociability, Aggression, Honesty, Curiosity |
| Needs | Health, Hunger, Fatigue, Safety, Social, Money |
| Emotion | CurrentEmotion, Intensity, Cause, Decay |
| Memory | MemoryRefs, SemanticBeliefs, ImportantEvents |
| Relationship | TargetId, Trust, Affection, Fear, Respect, Hatred, Debt, Loyalty |
| Goals | GoalId, Priority, Progress, FailureCondition |
| Experience | Combat, Profession, Exploration, Social, Knowledge |
| Inventory | Items, Equipment, CurrencyRefs |
| Mission | CurrentMission, FormationRole, Orders |
| Legacy | DeathState, Heir, Relics, Reputation |

## 12. Self Model

Self Model은 단일 AI 모델이 아니라 Identity + Memory + Personality + Relationship + Emotion + Goal + Experience + Body + World Perception의 지속 상태 조합이다.

```
PERCEPTION -> MEMORY RETRIEVAL -> NEEDS -> GOAL EVALUATION -> DECISION -> ACTION -> WORLD EVENT -> EXPERIENCE -> MEMORY UPDATE
```

## 13. Memory Architecture

| Type | Purpose | Retention |
|---|---|---|
| Episodic | 사건/경험 | 중요도 기반 장기 보존 |
| Semantic | 일반화된 지식 | 요약/갱신 |
| Social | 사람/세력 관계 | 관계와 연결 |
| Emotional | 감정적으로 강한 사건 | 강도에 따른 감쇠 |
| Procedural | 숙련/전술 | 능력치/정책으로 압축 |
| World | 세계에 남는 사건 | History/Event Store |

Memory Retrieval은 Recency, Importance, Relevance, Emotion, Relationship를 가중해 top-K를 반환한다. 원문 대화 전체를 무한 저장하지 않고 Event + Summary + Embedding/Index를 선택적으로 보존한다.

## 14. Decision Stack

| Layer | Use | LLM |
|---|---|---|
| L0 Rule/State | 이동/휴식/기본 상호작용 | No |
| L1 Utility | 욕구/위협/타깃/행동 우선순위 | No |
| L2 GOAP | 다단계 목표 | Optional |
| L3 Tactical | 파티 전술/위험 대응 | Rare |
| L4 LLM/Model | 복합 추론/대화/요약 | Selective |

## 15. Autonomous Growth

경험은 단순 XP가 아니라 행동 정책과 선호를 바꾼다. 전투가 반복되면 숙련도가 증가하고, 특정 실패가 반복되면 위험 회피·전술 선호가 변하며, 중요한 관계 사건은 목표와 행동 가중치를 바꾼다.

```
EXPERIENCE -> OUTCOME -> LEARNING SIGNAL -> PREFERENCE / SKILL UPDATE -> NEW BEHAVIOR -> NEW OUTCOME
```
