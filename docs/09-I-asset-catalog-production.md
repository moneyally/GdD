# I. Asset Master Catalog / Production

## 45. Asset Master Catalog

| Category | Subcategories | MVP Qty | Launch Target | Long-term |
|---|---|---|---|---|
| Character | Hero/NPC/Enemy/Boss/Mount | 10/10/8/1/0 | 30/100/50/8/3 | 300+/500+/200+/50+/20+ |
| Character Parts | Hair/Face/Costume/Armor/Accessory | 20 | 100+ | 500+ |
| Weapons | Sword/Bow/Staff/Shield/etc. | 15 | 150 | 500+ |
| Environment | City/Dungeon/Nature/Props | 1 kit | 8 kits | 30+ kits |
| Animation | Locomotion/Combat/Interaction | 80 | 500 | 2,000+ |
| VFX | Skill/Hit/World/UI | 20 | 250 | 1,000+ |
| Audio | BGM/SFX/Ambient/Voice | 100 SFX/5 BGM | 1,000+/40 | 5,000+/150 |
| UI | HUD/Lobby/Gacha/Social/Admin | 1 system | full product | future platform variants |

수량은 초기 가설이며 실제 Vertical Slice의 제작 속도와 메모리 예산을 측정한 뒤 재산정한다.

## 46. Asset ID / Naming Convention

| Type | Prefix | Example |
|---|---|---|
| Skeletal Mesh | SK_ | SK_Hero_Raon |
| Static Mesh | SM_ | SM_City_Wall_A |
| Material | M_ | M_Character_Master |
| Material Instance | MI_ | MI_Raon_Body |
| Texture | T_ | T_Raon_Body_BC |
| Animation | A_ | A_Raon_Run |
| Anim Blueprint | ABP_ | ABP_Humanoid |
| Niagara | NS_ | NS_Fireball |
| Sound | SFX_/MUS_/AMB_/VO_ | SFX_Sword_Hit_01 |
| Data Asset | DA_ | DA_Character_Raon |
| Data Table | DT_ | DT_GachaPool_001 |
| Widget | WBP_ | WBP_Gacha_Result |
| Level | L_ | L_MainWorld |
| Control Rig | CR_ | CR_Humanoid |
| IK Rig | IKR_ | IKR_Humanoid |
| Retargeter | RTG_ | RTG_Humanoid |

Naming은 유형 + 기능 + 변형 + 버전의 순서로 유지하며 공백/한글/특수문자는 자산 파일명에서 사용하지 않는다. UE의 권장 명명 관행을 프로젝트 규칙으로 고정한다. [R9]

## 47. Character Asset Pipeline

```
CONCEPT -> APPROVAL -> BLOCKOUT -> HIGH/LOW POLY -> UV -> TEXTURE -> MATERIAL -> RIG/SKIN -> IK/RETARGET -> ANIMATION -> PHYSICS -> LOD -> UE IMPORT -> VALIDATION -> PERFORMANCE -> QA -> RELEASE
```

## 48. Environment Asset Pipeline

```
KIT DESIGN -> MODULAR GRID -> MODEL -> UV/MATERIAL -> COLLISION -> LIGHTING TEST -> LOD/HLOD -> PCG/PLACEMENT -> WORLD PARTITION TEST -> MOBILE PERF -> QA -> RELEASE
```

## 49. Weapon / Item Pipeline

```
DESIGN DATA -> CONCEPT -> MODEL -> TEXTURE -> MATERIAL -> COLLISION -> SOCKET -> ANIMATION HOOK -> VFX/SFX -> ItemDefinition -> Gameplay Validation -> QA -> RELEASE
```

## 50. Animation Pipeline

```
MOTION LIST -> REFERENCE -> RIG -> KEY/RETARGET -> CLEANUP -> ROOT MOTION POLICY -> NOTIFY -> MONTAGE -> ABP INTEGRATION -> MOBILE BUDGET -> QA
```

## 51. VFX Pipeline

```
EFFECT SPEC -> NIAGARA -> MOBILE OVERDRAW CHECK -> PARTICLE BUDGET -> LOD/CULL -> NETWORK POLICY -> SOUND HOOK -> QA -> RELEASE
```

## 52. Audio Pipeline

```
AUDIO BRIEF -> RECORD/COMPOSE -> EDIT -> MIX -> LOOP/VARIATION -> MOBILE COMPRESSION -> LOUDNESS QA -> LOCALIZATION -> UE INTEGRATION -> QA
```

## 53. UI Asset Pipeline

```
UX FLOW -> WIREFRAME -> VISUAL -> COMPONENT -> DATA BINDING -> TOUCH TEST -> LOCALIZATION TEST -> ACCESSIBILITY -> DEVICE QA -> RELEASE
```

## 54. Asset License Registry

| Field | Required |
|---|---|
| AssetId | Yes |
| Source | In-house / Fab / Outsource / Licensed / Procedural / AI |
| Creator | Yes |
| License Type | Yes |
| Commercial Use | Yes |
| Modification | Yes |
| Redistribution | Yes/No |
| Territory | If limited |
| Evidence | Receipt/License/Contract reference |
| Expiration | If any |
| Replacement Plan | Required for third-party dependency |

## 55. DCC -> UE5 Import Contract

| Asset | Required Contract |
|---|---|
| Character | Scale, axes, skeleton, material slots, skin weights, physics, LOD, texture sets |
| Static Mesh | Pivot, collision, lightmap/UV policy, LOD, Nanite/mobile policy |
| Animation | Skeleton ID, frame rate, root motion, notify naming |
| VFX | Niagara system, bounds, cull distance, particle budget |
| Audio | Sample rate, loudness target, loop rules, localization tags |
| UI | Widget size classes, safe area, text auto-expand, localization keys |

## 56. Asset Validation / QA

| Gate | Check |
|---|---|
| Structural | Naming, folder, dependency, missing references |
| Visual | Silhouette, clipping, UV, material, lighting |
| Technical | Collision, socket, skeleton, animation, physics |
| Mobile | Memory, draw calls, overdraw, shader count, texture size |
| Network | Replication requirement, bandwidth impact |
| Localization | Text keys, overflow, CJK/RTL if supported |
| Legal | License record exists |
| Release | Cook/package succeeds, no unexpected dependency |
