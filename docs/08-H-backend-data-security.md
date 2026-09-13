# H. 백엔드 / 게임 서버 / 데이터 / 보안

## 37. Service Boundary

```
MOBILE CLIENT
|
+-- Backend API: Auth / Profile / Social / Economy / Gacha / Inventory / LiveOps
|
+-- Matchmaking
|
+-- Dedicated Game Server: World / Combat / Agent / Mission
|
+-- AI Services: Memory Retrieval / LLM Gateway / Evaluation
|
+-- Data: PostgreSQL / Redis / Event Store / Analytics / Object Storage / CDN
```

초기에는 Modular Monolith + Dedicated Game Server로 시작하고 실제 병목이 확인된 영역만 서비스로 분리한다.

## 38. Backend Modules

- Auth / Account
- Profile / Master
- Character Service
- Inventory / Ownership
- Gacha / Reward
- Synthesis / Craft
- Equipment
- Quest / Mission
- Guild / Social
- Trade / Market
- Payment / Entitlement
- Matchmaking / Session
- LiveOps / Config
- Notification
- Analytics
- Admin / GM
- Audit / Compliance

## 39. Database Domains

| Domain | Store |
|---|---|
| Transactional State | PostgreSQL |
| Cache / Session | Redis |
| Event / History | Append-only Event Store or PostgreSQL partitioning |
| Analytics | ClickHouse 계열 |
| Assets / Patches | Object Storage + CDN |
| AI Retrieval | Vector index as optional subsystem |

## 40. Ownership Architecture

가챠·합성·거래·우편·보상·길드 창고의 핵심은 Ownership Ledger다. CharacterInstanceId, ItemInstanceId, CurrencyWalletId, GuildVaultId 각각의 소유권 도메인을 분리한다.

```
REQUEST -> AUTH -> OWNERSHIP CHECK -> IDEMPOTENCY CHECK -> LOCK -> TRANSACTION -> LEDGER EVENT -> RESPONSE
```

## 41. Content Delivery & Ownership Architecture

서버가 전달하는 것은 Definition/Ownership/State이고, 실제 3D/애니메이션/VFX/오디오 등 Physical Asset은 클라이언트가 버전별 Content Bundle에서 필요 시 비동기로 로드한다. UE 5.8의 Primary Data Asset은 Primary Asset ID와 Asset Bundle 지원을 제공하여 Asset Manager에서 수동 로드/언로드할 수 있다. [R8]

```
GACHA RESULT -> CharacterDefinitionId -> Ownership/Instance -> Client Asset Registry -> Core Bundle / Lobby Bundle / Gameplay Bundle / Combat Bundle / Voice Bundle
```

## 42. Content Bundle Strategy

| Bundle | Loaded When | Contents |
|---|---|---|
| Core | Login/Collection | Metadata, portrait, lightweight icon |
| Lobby | Character detail | 3D preview, portrait, UI VFX, preview animation |
| Gameplay | World spawn | Skeletal Mesh, materials, AnimBP, locomotion |
| Combat | Combat starts | Skill Anim, VFX, SFX, hit reaction |
| Voice | Voice line required | Localized voice assets |
| Event | Special event | Limited-time cosmetics/content |

## 43. Security / Anti-Cheat

- Server authoritative economy and combat
- Request signing / session tokens
- Idempotency keys for purchases/rewards
- Rate limiting
- Inventory and guild vault audit
- Admin action audit
- AI output validation
- Client integrity / jailbreak-resistant assumptions
- Replay/rollback procedures

## 44. Payment / Entitlement

구매 기록과 게임 내 지급을 분리한다. Store purchase receipt는 결제 플랫폼의 사실이고, Entitlement Service가 게임 내 상품 지급 여부를 결정한다. 모든 지급은 idempotent 해야 한다.

Apple은 디지털 상품과 기능 해금에 In-App Purchase를 요구하며, Google Play도 일반적으로 Play Billing 사용을 요구한다. 랜덤 가상 아이템 구매에는 각 유형의 확률 공개가 필요하다. [R3][R4]
