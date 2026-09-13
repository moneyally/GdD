# E. 가챠 / 소유권 / 합성 / 제작

## 20. Gacha Principle

가챠가 주는 것은 .uasset 파일이 아니라 Ownership + DefinitionId + CharacterInstance 또는 ItemInstance다. 서버가 확률과 보상결정을 담당하고 클라이언트는 결과에 맞는 Asset Bundle을 로드한다.

```
CLIENT REQUEST -> SERVER RNG -> REWARD RESOLVER -> OWNERSHIP TRANSACTION -> INVENTORY UPDATE -> EVENT LOG -> CLIENT REVEAL
```

Apple은 구매형 랜덤 가상 아이템의 유형별 확률을 구매 전에 공개하도록 요구하고 있으며, Google Play도 구매 전 및 구매와 가까운 위치에서 확률 공개를 요구한다. 결제 방식과 환불/복원 정책도 플랫폼 정책에 맞춰 설계해야 한다. [R3][R4]

## 21. Gacha Data Model

| Object | Key Data |
|---|---|
| GachaBanner | BannerId, StartAt, EndAt, PoolId, Currency, PityRule, DuplicateRule |
| GachaPool | PoolId, RewardWeights, GuaranteedRules, Eligibility |
| GachaTransaction | TxnId, AccountId, BannerId, RequestId, ResultId, Cost, Timestamp |
| ProbabilityDisclosure | RewardType, Weight, DisplayProbability, Revision |
| PityState | Account/Pool Key, Count, GuaranteedTier, ResetRule |

## 22. Duplicate Resolution

같은 캐릭터를 다시 얻었을 때는 단순 +1만 하는 대신 Duplicate Resolver를 통한다. 기본 정책은 Character Shard 또는 Ascension Material이며 장기적으로 Skill Mastery, Trait Potential, Legacy/Collection progression으로 확장한다.

```
FIRST COPY -> CHARACTER INSTANCE
DUPLICATE -> DUPLICATE RESOLVER -> SHARD / ASCENSION / MASTERY MATERIAL / TRAIT POTENTIAL
```

## 23. Synthesis / 합성 시스템

합성은 단순 메뉴가 아니라 소유권과 소모 트랜잭션을 서버에서 원자적으로 처리하는 경제 시스템이다.

| Recipe | Input | Output | Use |
|---|---|---|---|
| Character Ascension | Duplicate/Shard + Gold + Catalyst | Ascension Level | Character Growth |
| Skill Upgrade | Skill Material + Gold | Skill Level | Power/Behavior |
| Skill Variant | Rare Catalyst + Mastery + Base Skill | Variant Skill | Build Diversity |
| Equipment Enhance | Equipment + Material + Gold | Level/Grade | Gear Growth |
| Equipment Craft | Recipe + Materials | New Item | Production |
| Cosmetic Fusion | Cosmetics + Token | New Variant | Collection |
| Resource Conversion | Lower Material xN | Higher Material | Inventory Compression |

합성의 모든 입력은 서버에서 Ownership 검사 -> Lock -> Consume -> Create -> Audit Event 순서로 처리한다. 실패 시 전체 트랜잭션을 롤백한다.

## 24. Crafting / Production

생산은 NPC 경제와 플레이어 경제를 연결한다. Recipe에는 재료, 생산시간, 생산시설, 직업/스킬 조건, 성공률, 부산물, 시장가치가 포함된다.

## 25. Equipment / Item System

| Layer | Example |
|---|---|
| ItemDefinition | 아이템 기본 규칙/에셋 |
| ItemInstance | 내가 소유한 개별 아이템 |
| EquipmentSlot | Weapon, Armor, Accessory |
| Affix | 생성형 옵션 |
| Durability | 내구도 |
| Binding | Tradeable/Bound |
| Provenance | 생성 이벤트/소유 이력 |
