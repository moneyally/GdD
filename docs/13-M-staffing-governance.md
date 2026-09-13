# M. Staffing / Production / Outsourcing / Governance

## 72. Core Team

| Role | Initial | Scale | Responsibilities |
|---|---|---|---|
| Game Director / Lead | 1 | 1 | Vision, scope, pillars |
| Technical Director | 1 | 1 | Architecture, performance |
| Gameplay Engineers | 2-3 | 6-10 | Combat, systems, UE |
| Backend Engineers | 1-2 | 4-7 | Services, DB, economy |
| AI/Simulation Engineer | 1-2 | 4-8 | Agent, memory, simulation |
| Client/UI Engineer | 1 | 3-5 | Mobile UX/UI |
| Server/Network Engineer | 1 | 2-4 | Dedicated server, networking |
| Game Designer | 1-2 | 4-6 | Systems/content |
| Technical Artist | 1 | 2-4 | Pipeline/optimization |
| Character Artist | 1-2 | 4-8 | Characters/cosmetics |
| Environment Artist | 1-2 | 3-6 | World kits |
| Animator | 1-2 | 4-7 | Animation |
| VFX Artist | 1 | 2-4 | VFX |
| Audio | 0.5-1 | 2-3 | Sound/music/voice |
| QA | 1-2 | 5-10 | Functional/mobile/performance |
| Producer | 1 | 2-4 | Schedule/vendor |
| LiveOps/Data | 0-1 | 2-4 | Events/economy/analytics |

초기 프로토타입은 8~15명 수준에서도 가능하지만, 런치 품질의 모바일 온라인 서비스는 아트/QA/운영을 포함하면 규모가 크게 증가한다. 채용은 기능 검증 뒤 단계적으로 확장한다.

## 73. Outsourcing Model

| Work | Internal | Outsource |
|---|---|---|
| Character core style | Direction/hero | Base production/variants |
| Environment modular kit | Direction/key assets | Repetition/prop sets |
| Animation | Gameplay hooks | Bulk loops/variants |
| VFX | Signature effects | Bulk supporting effects |
| Voice | Direction/key cast | Localization recording |
| Localization | Terminology/QA | Translation/voice services |

## 74. Content Review Gates

```
DESIGN APPROVAL -> ART APPROVAL -> TECH APPROVAL -> GAMEPLAY INTEGRATION -> MOBILE PERF -> QA -> LOCALIZATION -> LEGAL/LICENSE -> RELEASE
```

## 75. Feature Governance

| Gate | Question | Cut Rule |
|---|---|---|
| Pillar Fit | 핵심 경험 강화? | No -> Cut |
| Player Value | 유저가 체감? | Low -> Delay |
| System Cost | 서버/클라 비용? | High -> Re-scope |
| Content Cost | 에셋/운영량? | High -> Modularize |
| QA Cost | 검증 가능한가? | High -> Simplify |
| Monetization Risk | 공정성/스토어 리스크? | High -> Redesign |
| Mobile Risk | 성능/배터리 영향? | High -> Cut or Tier |
