# J. Mobile-First 기술 규격 / 성능 / 플랫폼

## 57. Platform Matrix

| Dimension | Android | iOS/iPadOS | PC Dev |
|---|---|---|---|
| Release | Yes | Yes | No |
| Input | Touch / optional controller | Touch / optional controller | Keyboard/mouse/controller |
| Renderer | Mobile path | Mobile path | Editor/Desktop for debug |
| QA | Real devices mandatory | Real devices mandatory | Functional test |
| Store | Google Play | App Store | Internal only |

UE 5.8 문서는 모바일에 별도의 렌더링 경로와 Device Profile/Scalability 설정을 제공하며, 고급 기능도 지원 기기에서 선택적으로 사용할 수 있음을 명시한다. 따라서 단일 최고사양 기준이 아니라 기기 Tier를 정의한다. [R1][R2]

## 58. Mobile Performance Tiers

| Tier | Target | FPS Goal | Policy |
|---|---|---|---|
| Low | 보급형 | 30 | Low resolution, reduced effects, low AI activity |
| Mid | 주력 | 30/45 | Balanced |
| High | 상위 | 60 preferred | Higher resolution/effects |
| Flagship | 최상위 | 60 | Optional higher fidelity |

정확한 기기별 해상도·RAM·GPU budget은 Vertical Slice에서 실제 대표기기군을 벤치마크한 뒤 확정한다. 모바일은 기능 수보다 예산 관리가 우선이다.

## 59. Mobile Runtime Budgets

| Budget | Initial Policy |
|---|---|
| CPU | Simulation tick budget first; render thread monitored |
| GPU | Effect overdraw + material/shader complexity capped |
| RAM | Resident content budget by scene/tier |
| Storage | Base app + optional content packs |
| Battery | Thermal-aware simulation/render throttling |
| Network | Delta updates, compression, reconnect strategy |
| Animation | Animation Budget Allocator / distance-based ticking |
| World | Physical Actor count capped by interest management |

## 60. CDN / Patch / Content Delivery

```
Asset Source -> Cook/Chunk -> Manifest -> Object Storage -> CDN -> Client Download -> Hash Verify -> Install -> Asset Registry Update
```

Base install에는 필수 코어 에셋을 포함하고, 지역/이벤트/언어/고용량 음성 등의 선택 콘텐츠는 On-Demand Content Pack으로 분리한다. 패치에는 Manifest + Hash + Delta/Chunk 정책을 사용한다.

## 61. Build / Cook / Release Pipeline

```
Git Commit -> CI Build -> Unit Tests -> Asset Validation -> Cook -> Package -> Device Test -> Automated Smoke -> Staging -> Store Submission -> Production -> Telemetry -> Rollback/Hotfix
```
