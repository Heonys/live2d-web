# live2d-web — Agent Guide

Live2D Cubism 모델을 바닐라 JavaScript와 React에서 다루는 오픈소스 브라우저
runtime. 공식 Framework 5-r.5 WebGL2 백엔드가 기본이고, headless controller +
React binding + 자동 품질 + 립싱크 + 선택형 MediaPipe 트래킹 + pixi-v6 비교
백엔드로 구성된다.

`v<version>` 태그 푸시가 발행이다. npm Trusted Publishing(OIDC)이라 토큰이
없고 trusted publisher가 `release.yml`을 지목하므로 **이 워크플로 파일명을
바꾸면 발행이 깨진다.**

## Tech Stack

- pnpm workspace(catalog) — **발행 패키지는 `live2d-web` 하나** + `.`,
  `/react`, `/backends/cubism-webgl`, `/tracking/mediapipe`,
  `/tracking/mediapipe/worker`, `/inspect`, `/devtools` 서브패스
- tsdown 빌드(ESM + d.ts). 개발 중엔 소스 export + Next `transpilePackages`,
  발행 시 `publishConfig.exports`가 dist로 전환
- 립싱크는 wlipsync(모음 분류, RMS 아님)
- ESLint(@antfu/eslint-config)가 린트+포맷. Prettier 없음
- 테스트는 vitest(node/jsdom) + Playwright(Chromium/WebKit/Firefox)
- 공개 문서는 `apps/playground/content/docs/{en,ko,ja}` 3개 언어. 루트
  `docs/`는 호환성 표와 라이선스만 둔다

## 구조와 책임

| 경로                         | 책임                                                           |
| ---------------------------- | -------------------------------------------------------------- |
| `packages/live2d-web`        | 유일한 발행 패키지. runtime/core·React·립싱크·백엔드           |
| `packages/live2d-web/vendor` | Cubism Web Framework 5-r.5 단일 소스(별도 typecheck·라이선스)  |
| `apps/playground`            | Next 개발장 + 공개 사이트(문서·Playground·Inspector)           |
| `apps/vanilla-consumer`      | React dependency 없는 Vite 소비자 fixture                      |
| `scripts/`                   | 공식 배포처 자산 fetch, 패키지·소비자 검증, 벤치마크 리포트    |
| `docs/`                      | 공개 호환성 표와 라이선스                                      |
| `private/docs/`              | 설계·로드맵·결정 기록·릴리스 절차·벤치마크 (로컬 전용, 미추적) |

의존 방향은 `React/backends → core` 단방향이다. `src/index.ts`에 React, PIXI,
Framework import나 `"use client"`가 생기면 root 계약 위반이다.

## Key Path Index

- `packages/live2d-web/src/core/runtime.ts` — 바닐라 API와 공유 생명주기 controller
- `packages/live2d-web/src/core/contract.ts` — 백엔드 계약 타입
- `packages/live2d-web/src/react/` — headless runtime binding, Store, hooks
- `packages/live2d-web/src/features/lipsync/` — 순수 mouth controller와 wLipSync 연결
- `packages/live2d-web/src/tracking/mediapipe/` — Face Landmarker 상태·매핑·생명주기
- `packages/live2d-web/src/backends/cubism-webgl/` — 기본 Framework/WebGL2 어댑터
- `packages/live2d-web/src/backends/pixi-v6/` — 단일 티커 PIXI v6 비교 어댑터
- `apps/playground/content/docs/` — 공개 문서 3개 언어 원본
- `e2e/playground.spec.ts` — 실제 Core/Hiyori 3엔진 검증
- `e2e/tracking/mediapipe.spec.ts` — 모델 없는 정지 초상으로 추론 경로만 검증
- `private/docs/architecture.md` — 어댑터·프레임 순서·생명주기·품질 계약
- `private/docs/decisions.md` — 확정된 결정과 날짜별 결정 기록
- `private/docs/roadmap.md` — 성장 목표·버전 순서
- `private/docs/release-checklist.md` — 발행 절차

## Commands

```bash
pnpm dev            # apps/playground dev 서버
pnpm build          # 패키지 tsdown 빌드
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets # 공식 Core + Hiyori(최초 1회, ignored)
pnpm fetch-mediapipe-assets             # WASM + Face Landmarker + portrait(ignored)
pnpm lint / typecheck / test
pnpm test:e2e / test:tracking:e2e
pnpm api:check      # etc/api 계약 비교. 의도된 변경은 api:update + 같은 커밋
pnpm verify:package # tarball 내용물 + React 없는 소비자 번들
pnpm verify:packed-consumers # 실제 tarball 설치: vanilla/React/Next SSR + audit
pnpm up             # taze 일괄 업데이트 + prune + dedupe
```

## 함정

**패키징 경계**

1. **Cubism Core는 동봉하지 않는다.** 사용자가 `coreUrl`이나 선행 `<script>`로
   공급한다. 부재·로드 실패는 `core-missing`으로 표면화한다. Framework·셰이더는
   백엔드 chunk에만 두고 Core·모델·profile은 절대 패키지에 넣지 않는다. 이
   포함 형태는 Live2D에 서면 확인을 받았다(`docs/licensing.md`). 크게 바뀌면
   다시 확인한다.
2. **pixi-v6는 저장소 전용이다.** 0.2.0부터 발행하지 않는다. 다시 발행하려면
   entry·`publishConfig.exports`·`peerDependencies` 셋을 함께 되돌린다.
3. **MediaPipe는 선택형 서브패스다.** `@mediapipe/tasks-vision`은 optional peer,
   `/tracking/mediapipe`에서만 동적 import. root 정적 import, 기본 CDN,
   WASM·task 동봉을 추가하지 않는다. 카메라·video·rAF·track은 앱이 소유한다.

**Core와 자산**

4. **Core 버전을 섞지 않는다.** Framework 5-r.5에는 Cubism 5.3 `core/06`을
   쓴다. `core/05`는 실제 moc 로드에서 실패한다.
5. **resolver 경로는 segment별로 encode/decode한다.** `new URL()` 전에 encode
   하지 않으면 `%`, `#`, `?`가 escape/query/fragment로 오해되고, 해석 뒤 decode
   하지 않으면 CJK 키가 빗나간다. `assets.ts`가 이 계약의 단일 지점이다.
6. **자산 스크립트는 둘이고 배포는 둘 다 불러야 한다.** `fetch-assets`는
   Core·Hiyori를, `fetch-mediapipe-assets`는 `.task`와 WASM을 가져온다.
   `public/assets/`는 gitignore이므로 부르지 않은 쪽은 배포에 존재하지 않는다.
   **CI 초록은 배포 정상을 뜻하지 않는다** — CI는 둘 다 부르지만 배포본을
   검사하는 게이트는 없다.
7. **`/assets/`의 404는 1년 캐시된다.** `next.config.ts`의 규칙이 파일 존재와
   무관하게 적용되어 404에도 `immutable`이 붙는다. 재현 확인은 시크릿 탭이나
   사이트 데이터 삭제 후에 한다.

**렌더링과 생명주기**

8. **dispose 순서: 기능(시선 → 립싱크) → model → stage.** 역순이면 WebGL
   에러다. 이 순서 보장이 제품 약속이다.
9. **SDK의 now 단위를 신뢰하지 않는다.** 델타는 `performance.now()`로 잰다.
10. **per-frame 값(mouthOpen 등)은 React state 금지.** getter 콜백으로 주입한다.
11. **SSR-safe 동적 import.** `pixi-live2d-display`는 모듈 평가 때 `window`를
    읽고, wLipSync 메인 export는 AudioWorkletNode와 인라인 WASM을 평가한다. 둘 다
    사용 시점에 동적 import한다. type-only import는 가능하다.
12. **모듈러 PIXI v6는 수동 등록 필수.** `extensions.add(TickerPlugin,
BatchRenderer)` 없으면 `renderer.plugins.batch`가 undefined다. Pixi 비교는
    Core도 분리한다(구형 Framework가 Core 5.3 blend-mode와 비호환).

**립싱크**

13. **wlipsync는 메인 export만.** 워클렛·WASM이 data:URL 인라인이라 addModule이
    필요 없다. `wlipsync/wlipsync.js` 서브패스 금지.
14. **SDK 모션 커브가 파라미터를 덮어쓴다.** 립싱크 값은 SDK update 이후에 쓴다.
15. **오디오 소유권을 넘지 않는다.** 사용자의 AudioNode/AudioContext를
    close·suspend·전체 disconnect하지 않는다. 실패는 `lipsync-error`로 기능만
    중단하고 Stage/Model은 유지한다.

**트래킹**

16. **파라미터의 중립은 `minimum`이 아니라 `defaultValue`다.** 공식 샘플 중에도
    `ParamEyeLOpen` 최대값이 1.0을 넘는 리그가 있다. 테스트가 `getModelInfo()`를
    `parameters` 없이 넘기면 폴백 표로 떨어지는데, 그 표는 기본값이 늘 구동 방향
    끝에 있어 **이 계열 결함이 드러날 수 없는 유일한 형태**다. 실제 리그 범위를
    쓰는 픽스처를 함께 둔다.
17. **Perfect Sync 집합은 ARKit 기준이고 MediaPipe와 다르다.** MediaPipe는
    `_neutral`이 있고 `tongueOut`이 없다. `_neutral`은 입력 정규화에만 쓰고,
    판정은 ARKit 52개 중 45개 이상. 픽스처는 `PERFECT_SYNC_PARAMETER_IDS`로
    생성하지 말고 손으로 적는다(자기 검증 방지).
18. **정지 초상 게이트는 품질을 판정하지 못한다.** `tracking-e2e`는 초기화·52개
    출력·loss·dispose만 증명한다. 각도의 부호·크기는 합성 행렬 단위 테스트
    (`state.test.ts`)로 잠갔고, 얼굴 놓침 경계와 자세 유지는 사람이 카메라
    앞에서 본다.
19. **`peak`만 보면 오진한다.** 얼굴을 놓치는 순간의 한 프레임 튐이 최대값으로
    남는다. 자세를 몇 초 유지한 상태의 값을 본다.
20. **MediaPipe Worker는 앱 엔트리에서 시작한다.** 앱의 Worker 파일이
    `startMediaPipeFaceTrackerWorker()`를 한 번 부르고 factory를 넘긴다. main이
    기본이며 조용한 fallback은 없다. Vite는 module WASM loader를 쓰지만
    Next/Turbopack은 classic bootstrap으로 바꿀 수 있어 runner가 환경을 감지한다.

**환경과 발행**

21. **Node 24 필수(.nvmrc).** 20이면 eslint-plugin-unicorn이
    `mapTypes.union is not a function`으로 죽는다.
22. **`Cannot find native binding`** — pnpm optional deps 누락.
    `pnpm install --force`.
23. **trustPolicy 위양성** — provenance 이전 구버전이 걸리면
    `pnpm-workspace.yaml`의 `trustPolicyExclude`에 추가한다.
24. **dev 서버 포트** — 3000이 점유되면 Next가 3001+로 옮긴다. 검증 시 로그에서
    실제 포트를 확인한다.
25. **릴리스 전 CHANGELOG 헤더.** `release.yml`은 첫 `## ` 절을 릴리스 노트로
    쓴다. `## Unreleased`를 `## <version> - <date>`로 바꾸지 않으면 제목 없는
    노트가 올라간다.
26. **배포 빌드 환경은 `apps/playground/vercel.json`에 적는다.** `fetch-assets`가
    `LIVE2D_ACCEPT_TERMS=1` 없이 throw하므로 이 변수가 없으면 빌드가 첫 줄에서
    죽는다. TypeDoc·Shiki 때문에 `NODE_OPTIONS=--max-old-space-size=4096`도
    필요하다. 대시보드가 아니라 파일에 둔다.

## 규칙

- 결정은 `private/docs/decisions.md`에 날짜 붙은 절로 기록한다:
  결정문 → 근거 → 포기와 대체 → 재검토 조건. 기존 결정을 지우지 않는다
- 생태계 수치를 인용할 때는 측정일을 함께 적는다
- 공개 문서 3개 언어를 함께 고친다. `pnpm docs:check`가 누락 slug를 막는다
- AIRI(MIT) 코드 패턴은 차용 가능, **캐릭터 에셋은 사용 금지**(라이선스 불명)
- 커밋은 사용자 지시가 있을 때만. 커밋 메시지는 영어
