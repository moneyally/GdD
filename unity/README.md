# unity/ — Unity 이식

판단 엔진을 C#으로 옮긴 것과, Unity에 붙이는 최소 브리지.

## 구성

```
unity/
├── LivingWorld.Core/          순수 C#. UnityEngine 참조 0개
│   └── Persistence/           세이브 직렬화 (TS와 바이트 동일)
├── LivingWorld.Core.Tests/    NUnit. dotnet test로 검증됨 (24개 통과)
└── LivingWorld.Unity/         UnityEngine 의존. 표현 층 + 세이브 경로
```

**이 분리가 CORE CONTRACT 규칙 1이다.** `LivingWorld.Core`는 게임 엔진을 모른다.
그래서 여기서 `dotnet test`로 검증되고, 엔진을 갈아끼워도 판단은 그대로 남는다.
계약 테스트가 이걸 어셈블리 수준에서 검사한다 —
`Rule1_core_has_no_dependency_on_a_game_engine`.

## 검증 상태

```bash
# 레포 루트에서
npm run golden                                          # TS로 정답지 생성
cd unity && dotnet test LivingWorld.Core.Tests/LivingWorld.Core.Tests.csproj
```

테스트 32개 통과. 그중 **골든 대조**가 TypeScript 구현과 C# 구현이 같은 시드에서
같은 결과를 내는지 확인한다:

| 대조 항목 | 결과 |
|---|---|
| 난수 스트림 (mulberry32) | 일치 |
| 소환된 이름·성격 roll | 일치 |
| 10층 전체의 행동·판단 계층·ReasonCode 문자열·계획·피해 | 일치 |
| 이벤트 100건의 순서와 종류 | 일치 |
| 생존자의 기억(importance 포함)과 목표 | 일치 |
| **세이브 파일 1498줄 전체** (`golden/tower-snapshot.json`) | **바이트 일치** |

두 언어로 같은 규칙을 구현했다는 주장은 코드를 눈으로 비교해서는 증명되지 않는다.
같은 입력에서 같은 관측 결과가 나오는 것이 증명이다.

마지막 줄이 따로 있는 이유: **판단이 같은 것과 세이브 형식이 같은 것은 다른 주장이다.**
두 언어가 같은 판단을 내려도 저장 스키마가 어긋나면 한쪽에서 만든 세이브를 다른 쪽이
못 읽는다 — 그건 포팅을 한 게 아니다. 그래서 TS가 쓴 세이브 파일을 C#이 읽고,
다시 저장해서 같은 바이트가 나오는지까지 본다 (`SnapshotTests`).

`Math.Round` 하나가 이 대조를 깨뜨릴 수 있다 — C#의 기본은 은행가 반올림이라
JS의 `Math.round`와 다르다. `JsMath.Round`가 그 차이를 흡수한다.

> 브리지(`LivingWorld.Unity/`)는 UnityEngine이 필요하므로 여기서는 컴파일되지 않는다.
> `dotnet test`가 검증하는 것은 코어뿐이다 — 브리지의 첫 컴파일은 Unity 에디터에서 일어난다.

## 세이브

```csharp
SaveFile.Save(world);                 // persistentDataPath/living-world.save.json
World restored = SaveFile.Load();     // 없으면 null, 깨져 있으면 예외
```

직렬화는 코어(`SnapshotJson`)가, 경로는 브리지(`SaveFile`)가 담당한다 —
`Application.persistentDataPath`는 엔진 API라서 코어에 둘 수 없다 (규칙 1).

Definition은 세이브에 들어가지 않는다. 밸런스를 고쳐도 기존 세이브가 열려야 하기 때문이다.
대신 **Definition을 삭제하거나 ID를 바꾸면 세이브가 깨진다** — 이건 의도된 실패다.

## Unity 프로젝트에 넣는 방법

1. Unity 프로젝트를 만든다 (2021.2 이상. URP 권장 — 홀로그램 셰이더를 쓸 것이므로)
2. `LivingWorld.Core/` 폴더를 `Assets/LivingWorld/Core/` 로 복사
   - `.csproj`는 복사하지 않는다. Unity가 자체적으로 컴파일한다
3. `LivingWorld.Unity/` 폴더를 `Assets/LivingWorld/Bridge/` 로 복사
4. 씬에 빈 GameObject를 만들고 `TowerDirector` + `DecisionLogger` 를 붙인다
5. `characterPrefab` 에 걷는 캐릭터 프리팹을 넣는다
6. 재생 → 콘솔에 판단 근거가 흐르고 캐릭터가 그에 맞게 움직인다

### Assembly Definition (권장)

`Assets/LivingWorld/Core/` 에 `LivingWorld.Core.asmdef` 를 만들고 아무 참조도 넣지 않으면,
**코어가 UnityEngine을 참조하는 순간 Unity가 컴파일 에러를 낸다.** 규칙 1을 에디터가
지켜주게 되는 셈이다. 권장 설정:

```json
{
  "name": "LivingWorld.Core",
  "references": [],
  "noEngineReferences": true
}
```

브리지 쪽은 `Assets/LivingWorld/Bridge/LivingWorld.Bridge.asmdef` 로 만들고
`references: ["LivingWorld.Core"]` 를 넣는다. 방향은 **브리지 → 코어** 한쪽뿐이다.

## 지금 없는 것

- **차원문 선택**: 웹 프로토타입에만 있다. `Tower`는 아직 선형 등반이다
  (`docs/proposal/holo-gates.md` 참조). 역이식이 다음 작업이다
- **홀로그램 셰이더**: Shader Graph 작업. 코드로 만들 것이 아니다
- **ScriptableObject Definition**: 지금은 `Data/Definitions.cs` 에 코드로 박혀 있다.
  골든 대조를 위해 의도한 것이고, 검증이 끝났으니 이제 옮겨도 된다
