# F. 길드 / 소셜 / 거래 / 경제

## 26. Social Graph

친구, 차단, 팔로우, 파티, 길드, 우편, 채팅, 신고를 단일 Social Identity 위에서 구현한다. Presence와 Social Graph를 분리하여 서비스 장애 시 게임 세션 자체가 멈추지 않게 한다.

## 27. Guild System

| System | Core Features |
|---|---|
| Guild Core | Create, Invite, Join, Leave, Disband |
| Roles | Owner, Officer, Member, Recruit |
| Permissions | Invite, Kick, Storage, Research, War, Treasury |
| Guild Level | XP, Capacity, Unlocks |
| Guild Research | Shared upgrades / policies |
| Guild Quest | Weekly/daily shared goals |
| Guild Boss | Cooperative content |
| Guild War | Faction-based PvP/PvE future |
| Guild Storage | Shared but audited inventory |
| Guild Treasury | Server-authoritative wallet |
| Guild Log | Join/leave/withdraw/donate/war audit |

길드 창고와 길드 재화는 특히 치팅/권한 남용을 막기 위해 모든 변동을 Event Ledger로 기록한다. 개인 인벤토리와 길드 인벤토리는 서로 다른 Ownership Domain으로 본다.

## 28. Party / Matchmaking

```
Party Create -> Invite -> Ready -> Mission Type -> Matchmaking Rule -> Server Allocation -> Session Token -> Game Server
```

## 29. Trade / Market

거래 가능한 아이템은 Bound/Tradable 상태를 명시한다. 플레이어간 직접 거래와 Auction/Market을 분리하고, 경제에서 Source/Sink와 가격 조작을 모니터링한다.

## 30. Economy

| Resource | Sources | Sinks | Failure Signal |
|---|---|---|---|
| Soft Currency | Quest, Trade, Events | Upgrade, Craft, Tax | Inflation |
| Premium Currency | IAP, Events | Gacha, Cosmetics | Paywall pressure |
| Food | Production, Trade | Consumption, Expedition | Scarcity |
| Materials | Gather, Dungeon | Craft, Synthesis | Oversupply |
| Information | Explore, Spy | Contract, Trade | Monopoly |
| Guild Resource | Quest, Donation | Research, War | Guild concentration |
