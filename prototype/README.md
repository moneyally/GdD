# prototype/ — 웹 프로토타입

## `holo-gates.html` + `engine.js`

차원문 등반 서바이벌. 브라우저에서 `holo-gates.html`을 열면 바로 돌아간다.
`engine.js`가 옆에 있어야 한다 (같은 폴더).

아티팩트로도 배포되어 있다. 소스를 여기 두는 이유는 **버전 관리와 diff**다.

### 구조 — 규칙은 한 곳에만 있다

```
src/            ← 규칙 (판단·피해·죽음·기억·잔상·캠프)
  web/api.ts    ← 화면이 쓰는 파사드. 뷰 모델만 내보낸다
     │ npm run prototype:build  (esbuild 번들)
     ▼
prototype/engine.js       ← 생성물. 전역 `LivingWorld`
prototype/holo-gates.html ← 그리기만 한다. 규칙 0줄
```

**HTML에는 게임 규칙이 한 줄도 없다.** 판단·피해·죽음·기억은 전부 엔진이 하고,
화면은 받은 결과를 홀로그램으로 그린다.

이전 버전은 판단 로직을 손으로 복사해 갖고 있었다. 그러면 `npm run gates:stats`로
측정한 게임과 여기서 눌러보는 게임이 **서로 다른 게임**이 된다 — 한쪽만 고쳐도
아무도 눈치채지 못한다. 그래서 없앴다.

### 규칙을 바꿨다면

```bash
npm run check              # 엔진 테스트
npm run prototype:build    # engine.js 재생성   ← 잊으면 화면만 옛 규칙으로 돈다
```

`engine.js`는 생성물이지만 커밋한다 — 빌드 없이 파일을 열 수 있어야 하고,
아티팩트 배포에도 이 파일이 그대로 올라간다.

### 세이브

브라우저 `localStorage`에 저장되며, 안에 든 `snapshot`은 **Unity/C#이 읽는 것과 같은 형식**이다
(`golden/tower-snapshot.json` 바이트 대조로 검증됨).

**저장 시점은 캠프 한 곳뿐이다.** 등반 중간에 저장하면 새로고침이 무료 회복이 된다 —
복원할 때 캠프를 거치기 때문이다. 죽음이 최종이려면 되감기 수단이 없어야 한다.
