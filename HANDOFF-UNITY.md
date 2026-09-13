# 집에서 이어받기 — Unity

집의 Claude Code에게 이 파일을 읽히면 바로 이어서 작업할 수 있다.

```
이 레포 클론하고 HANDOFF-UNITY.md 읽고 시작해
```

---

## 1. 지금 상태 (한 문단)

기획 문서(GDD v3.0)를 마크다운 레포로 정리했고, **판단 엔진이 실제로 돌아간다.**
캐릭터가 자기 공포·신뢰·기억으로 판단하고, 그 판단이 세계에 사건을 남기고, 그 사건이
다음 판단을 바꾼다 — 이걸 테스트로 고정해뒀다. TypeScript 58개 + C# 24개 통과.
**아직 없는 것은 게임 엔진, 3D, 그리고 "재미있는가"에 대한 답이다.**

| 있는 것 | 위치 |
|---|---|
| 기획 문서 (88절, 챕터별 분해) | `docs/` |
| 판단 엔진 (TypeScript, 원본) | `src/` — `npm run check` |
| 판단 엔진 (C#, Unity용) | `unity/LivingWorld.Core/` — 골든 대조로 검증됨 |
| Unity 브리지 (MonoBehaviour) | `unity/LivingWorld.Unity/` |
| 웹 프로토타입 (차원문 서바이벌) | 아티팩트로 배포됨. 소스는 대화에만 있다 |
| 설계 결정 기록 | `CORE.md`, `docs/proposal/holo-gates.md`, `OPEN-QUESTIONS.md` |

**읽는 순서: `CORE.md` → `docs/proposal/holo-gates.md` → `OPEN-QUESTIONS.md`.**
이 세 개가 "왜 이렇게 되어 있는가"를 전부 담고 있다.

## 2. 확정된 설계 결정

되돌릴 수 있지만 이유가 있어서 이렇게 되어 있다. 바꾸려면 `CORE.md`의 "설계 판단 기록"을 먼저 볼 것.

1. **탑은 홀로그램이고, 등반은 차원문 선택이다.** 계단이 아니다.
   에셋 예산을 근본적으로 바꾸는 결정 → `docs/proposal/holo-gates.md`
2. **판단 순서는 L0 → L2 → L1.** 규칙 5의 나열 순서와 다르다. 이유는 `CORE.md`
3. **기억에서 나온 목표는 L2가 계획으로 푼다.** L0에서 강제하면 부상자가 준비 없이 뛰어들어 죽는다
4. **ATTACK은 동료를 구하지 않는다.** 구했던 시절엔 관계가 판단에 영향을 주지 않았다 (실측 93% 대 92%)
5. **회복은 체력으로, 한계는 피로로.** 회복이 없으면 10층이 도달 불가였다 (실측 200회 전부 8층 미달)
6. **피해를 인원수로 나누지 않는다.** 나누면 ReasonCode의 self_risk가 거짓이 된다
7. **판단 로직은 렌더 코드에 두지 않는다.** `LivingWorld.Core`가 UnityEngine을 참조하면 테스트가 깨진다
8. **캠페인 구조는 선택이 아니라 필수다.** 한 번의 등반만으로는 "기억이 판단을 바꾼다"가
   **코드상 한 번도 실행되지 않는다** (600개 좌표에서 0회). 생존자를 데려가고 캠프에서
   쉬게 해야 열린다 (0 → 122회). 근거와 수치는 `docs/proposal/holo-gates.md`

## 3. 오늘 밤 첫 작업 — 걷는 캐릭터 + 우리 뇌

목표: **4명이 화면에서 움직이고, 콘솔에 그들이 왜 그렇게 움직였는지 흐른다.**
30~60분. 3D 모델링 0개.

### 3-1. 프로젝트

- Unity **6** 또는 2022.3 LTS, **URP** 템플릿 (홀로그램 셰이더를 쓸 것이므로 Built-in은 피한다)
- 프로젝트 이름은 무엇이든. 이 레포와 별도 폴더여도 된다

### 3-2. 무료 에셋 (전부 무료)

| 용도 | 출처 | 비고 |
|---|---|---|
| 리깅된 캐릭터 + 걷기/뛰기/쓰러지기 애니메이션 | **Mixamo** (Adobe 계정 무료) | FBX 다운로드, In Place 옵션 켜기 |
| 3인칭 컨트롤러 · Animator 셋업 참고 | **Unity Starter Assets** (Package Manager / Asset Store) | 우리는 AI가 움직이므로 입력 부분은 안 쓴다 |
| 저폴리 환경·프롭 (필요하면) | **Kenney.nl** (CC0) | 홀로그램 룩이면 거의 필요 없다 |

Mixamo 임포트 시 주의: FBX의 Animation Type을 **Humanoid**로, Avatar는 첫 모델에서 만들고
나머지 애니메이션은 **Copy From Other Avatar**로 붙인다.

### 3-3. 코드 넣기

```
Assets/LivingWorld/Core/     ← unity/LivingWorld.Core/ 의 .cs 전부 (.csproj는 제외)
Assets/LivingWorld/Bridge/   ← unity/LivingWorld.Unity/ 의 .cs 전부
```

`Assets/LivingWorld/Core/LivingWorld.Core.asmdef` 를 만들고 `noEngineReferences: true`.
그러면 **코어가 UnityEngine을 참조하는 순간 에디터가 에러를 낸다** — 규칙 1을 Unity가 지켜준다.
자세한 건 `unity/README.md`.

### 3-4. 씬

1. 바닥(Plane) + 카메라
2. 캐릭터 프리팹 하나 만들기: Mixamo 모델 + Animator
   - Animator에 `Speed` (float), `Downed` (bool) 파라미터
   - Idle ↔ Walk 를 `Speed` 로 블렌드, `Downed` 로 쓰러지는 상태 전환
   - 이 파라미터 이름은 `AgentBrain` 인스펙터에서 바꿀 수 있다
3. 빈 GameObject에 `TowerDirector` + `DecisionLogger` 붙이기
4. `characterPrefab` 에 프리팹 넣기
5. **재생**

콘솔에 이렇게 나오면 성공:

```
[탑] 파티 편성: 세인, 라온, 이린, 세라
[탑] 1층 · 위협 25 · 최초 도달 — 이린이 쓰러졌다
    세인  이린을 끌어내려 들어갔다.
        RESCUE(target=CHR_0003,trust=50,fear=0,self_risk=25)
```

`seed`를 그대로 두면 **위 순서가 매번 똑같이 재현된다.** 콘솔 출력이 `unity/README.md`의
골든 대조 결과와 같아야 한다 — 다르면 코드 복사가 잘못된 것이다.

### 3-5. 그 다음 (급하지 않음)

- 홀로그램 셰이더: Shader Graph에서 Fresnel + 스캔라인 + Emission. 캐릭터 머티리얼에 적용
- 차원문: 회전하는 발광 링 2~3개 + 파티클. 모델링 아님

## 4. Unity MCP 연결 (Claude가 에디터를 직접 조작)

Unity가 **2026-09-10에 공식 Claude Code 플러그인**을 냈다. 29개 Unity 스킬 + Unity CLI +
MCP 서버가 한 번에 들어온다.

집의 Claude Code에서:

```
유니티 공식 플러그인 깔아줘
```

또는 `/plugin` 에서 Unity를 찾아 설치. 그 다음 Unity 에디터를 열어두면 연결된다.
자세한 절차는 플러그인이 안내한다.

**언리얼로 갈 경우**: UE 5.8은 `Unreal MCP` + `Editor Toolset` 플러그인이 엔진에 내장돼 있다
(experimental). Editor Preferences에서 **Auto Start Server** 켜고, 콘솔에
`ModelContextProtocol.GenerateClientConfig ClaudeCode` 실행 후 프로젝트 루트에서 Claude Code 실행.

## 5. 클라우드 세션에서 에디터를 조작하려면 (터널)

원래 요청했던 방식이다. **가능하지만 권하지 않는다.**

Unity/Unreal MCP는 에디터 프로세스 안에서 `127.0.0.1`에 뜨고, 클라우드 세션의 localhost는
다른 기계다. 터널로 노출하면 닿는다:

```bash
# Cloudflare Tunnel (계정 없이 임시 URL)
cloudflared tunnel --url http://127.0.0.1:8090

# 또는 ngrok
ngrok http 8090
```

포트는 쓰는 MCP 서버에 따라 다르다 (UE 5.8 공식은 8000). 나온 공개 URL을 클라우드 세션의
Claude에게 주면 원격 MCP 서버로 붙일 수 있다.

**리스크 (읽고 결정할 것):**

- Unity/Unreal MCP는 **로컬 전용을 전제로 만들어져서 인증이 거의 없다**
- 노출되는 것은 "에디터에서 스크립트를 실행하고 프로젝트 파일을 읽고 쓰는 권한"이다
- 임시 URL이라도 스캐너에 걸린다. 그 URL을 아는 누구든 프로젝트를 조작할 수 있다

**쓸 거면 최소한:** 작업하는 동안만 켜고 끝나면 즉시 끈다. 민감한 것이 없는
프로젝트에서만. 상시로 두지 않는다.

**대안이 더 낫다:** 집에서 Claude Code를 직접 돌리면 터널이 필요 없고, 이 레포가
컨텍스트를 옮겨준다. 그게 이 문서가 존재하는 이유다.

## 6. 답을 기다리는 질문

`OPEN-QUESTIONS.md`에 전체가 있다. 지금 막고 있는 것만:

1. **엔진 확정** — Unity로 간다면 C# 포팅이 이미 검증돼 있다. 언리얼이면 C++로 다시 옮긴다
2. **차원문 서바이벌이 MVP 본체인가, GDD 대작으로 가는 검증물인가** — 작업 방향이 갈린다
3. **소유권이 Definition(혈통)에 귀속된다** — 영구사망 + 유료 소환이 공존하려면 필요한 한 줄
4. **`main` 머지** — 지금 전부 브랜치에 있고 `main`은 초기 README뿐이다

## 7. 명령어

```bash
# TypeScript (원본 구현)
npm install
npm run check          # 타입 검사 + 테스트 58개
npm run tower          # 탑 등반 로그
npm run tower:stats    # 명령별 결과 분포 (밸런스 도구)
npm run compare        # 판단 비교표
npm run gates:stats    # 차원문 전략별 결과 분포 + 캠페인 효과 측정
npm run golden         # C# 대조용 정답지 재생성

# C# (Unity용)
cd unity
dotnet test LivingWorld.Core.Tests/LivingWorld.Core.Tests.csproj    # 24개
```

`npm run golden`을 다시 돌렸다면 C# 테스트도 다시 돌려야 한다 — 규칙을 바꿨는데
한쪽만 고쳤다면 거기서 잡힌다.
