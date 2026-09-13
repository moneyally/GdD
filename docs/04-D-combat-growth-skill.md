# D. 전투 / 성장 / 스킬

## 16. Combat Model

모바일을 고려해 기본 전투는 실시간 전투 + 상위 전략 명령으로 설계한다. 플레이어는 이동/공격을 직접 마이크로 컨트롤하기보다 파티 Formation, Focus, Retreat, Skill Policy, Target Priority를 지정한다.

- Threat evaluation
- Target selection
- Positioning
- Ability selection
- Rescue
- Retreat
- Risk handling
- Formation cohesion

## 17. Skill Definition

| Field | Description |
|---|---|
| SkillId | 영구 식별자 |
| SkillType | Active/Passive/Trait/Ultimate |
| Cost | Mana/Stamina/Charge 등 |
| Cooldown | 재사용 시간 |
| TargetRule | Target selection rule |
| Formula | 게임 서버 계산식 |
| AIUtility | AI에서의 효용 |
| AnimationRef | 애니메이션 |
| VFXRef | 이펙트 |
| SFXRef | 사운드 |
| IconRef | UI |
| Version | 데이터 버전 |

## 18. Skill Ownership / Mastery

스킬 에셋과 캐릭터의 스킬 숙련을 분리한다. CharacterInstance는 SkillLoadout과 SkillMastery를 가지고, SkillDefinition은 공통 규칙과 에셋 참조를 가진다.

```
SkillDefinition -> Skill Asset Bundle
CharacterInstance -> SkillLoadout -> SkillMastery -> Growth/Evolution
```

## 19. Skill Evolution

동일 스킬도 사용 경험에 따라 Mastery가 달라질 수 있다. 초기에는 단순 Tier/Level로 구현하고, 장기적으로 행동 패턴에 의해 변형된 Skill Variant를 생성한다.

- Mastery Level
- Trait branch
- Cooldown reduction
- Pattern modification
- Combo unlock
- AI preference shift
