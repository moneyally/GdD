# O. 부록 - Data / ID / Risk / Reference

## 84. Core ID Scheme

```
ACC_ = Account
MST_ = Master
CHR_ = Character Instance
CHD_ = Character Definition
SKL_ = Skill
ITM_ = Item Instance
ITD_ = Item Definition
GIL_ = Guild
QST_ = Quest
MSN_ = Mission
EVT_ = World Event
MEM_ = Memory
FCT_ = Faction
AST_ = Asset Record
BAN_ = Gacha Banner
TXN_ = Transaction
LED_ = Ledger Entry
```

## 85. Transaction Patterns

```
Purchase: Receipt -> Entitlement -> Wallet -> Reward -> Ledger
Gacha: RequestId -> RNG -> Reward -> Ownership -> Ledger
Synthesis: Lock Inputs -> Validate -> Consume -> Create -> Ledger
Trade: Lock Seller Item -> Buyer Payment -> Swap -> Ledger
Guild Vault: Permission -> Lock -> Transfer -> Guild Ledger
```

## 86. Risk Register

| Risk | Impact | Early Signal | Response |
|---|---|---|---|
| AI cost explosion | High | LLM calls spike | Budget + cache + planner |
| Scope explosion | High | Sprint slips | Cut list |
| NPC inconsistency | High | Memory ignored | State pipeline audit |
| Economy inflation | High | Currency concentration | Source/Sink rebalance |
| Mobile thermal | High | FPS drops after long session | Tiering + throttling |
| Asset bloat | High | Package/RAM growth | Bundle/LOD/content packs |
| Gacha/store rejection | High | Review feedback | Probability/IAP compliance |
| Duplication exploit | Critical | Impossible balance delta | Ledger + idempotency |
| Guild abuse | High | Vault theft reports | Role permissions + audit |
| Backend outage | Critical | Auth/session failures | Graceful degradation + fallback |

## 87. Research References

R1. Epic Games, Unreal Engine 5.8 - Performance and Optimization for Mobile. https://dev.epicgames.com/documentation/unreal-engine/performance-and-optimization-for-mobile-in-unreal-engine

R2. Epic Games, Getting Started with Mobile Development in Unreal Engine 5.8. https://dev.epicgames.com/documentation/unreal-engine/getting-started-with-mobile-development-in-unreal-engine

R3. Apple Developer, App Review Guidelines, Section 3.1 / loot box probability disclosure. https://developer.apple.com/app-store/review/guidelines/

R4. Google Play Console Help, Payments and randomized virtual items / odds disclosure. https://support.google.com/googleplay/android-developer/answer/9858738

R5. Epic Games, World Partition. https://dev.epicgames.com/documentation/unreal-engine/world-partition-in-unreal-engine

R6. Epic Games, World Partition - Data Layers. https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---data-layers-in-unreal-engine

R7. Epic Games, World Partition - HLOD. https://dev.epicgames.com/documentation/en-us/unreal-engine/world-partition---hierarchical-level-of-detail-in-unreal-engine

R8. Epic Games, Data Assets / Primary Data Asset / Asset Bundles. https://dev.epicgames.com/documentation/en-us/unreal-engine/data-assets-in-unreal-engine

R9. Epic Games, Recommended Asset Naming Conventions in Unreal Engine Projects. https://dev.epicgames.com/documentation/en-us/unreal-engine/recommended-asset-naming-conventions-in-unreal-engine-projects
