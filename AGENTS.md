# live2d-web — Agent Guide

Live2D Cubism 모델을 바닐라 JavaScript와 React에서 다루는 **오픈소스
브라우저 runtime**. 현재 headless controller, React binding, 자동 품질,
source/driver 립싱크, 선택형 MediaPipe 얼굴 트래킹, pixi-v6 비교 백엔드와
Hiyori Playground가 구현됐다.
공식 Framework 5-r.5 WebGL2 백엔드가 기본으로
통합됐다. `v<version>` 태그 푸시가 발행을 실행하며, 릴리스 워크플로가 태그와
package version의 일치를 검사한다. 발행은 npm Trusted Publishing(OIDC)이라
토큰이 없고, npm에 등록된 trusted publisher가 `release.yml`을 지목하므로 이
워크플로 파일명을 바꾸면 발행이 깨진다. 계약은
`docs/`가 단일 기준이다. 루트 `CLAUDE.md`는 `@AGENTS.md` 한 줄짜리 포인터다.

## Tech Stack

- pnpm workspace(catalog 버전 관리) — **npm 퍼블리시는 `live2d-web` 하나** +
  `.`, `/react`, `/backends/cubism-webgl`, `/tracking/mediapipe` 서브패스.
  pixi-v6는 workspace
  안에서만 소스로 resolve되고 발행하지 않는다(0.2.0에서 제외)
- 퍼블리시 라이브러리 — tsdown 빌드(ESM + d.ts). 개발 중엔 소스-export + Next `transpilePackages`, 퍼블리시 시 `publishConfig.exports`가 dist로 전환
- 바닐라 root: React 없는 `createLive2D()`와 backend-neutral 계약
- React binding: `/react`, React optional peer
- 비교 어댑터: `pixi-live2d-display@0.4` + PIXI v6 모듈러(`@pixi/*`)
- 기본 어댑터: 공식 Cubism Web Framework 5-r.5 + WebGL2
- 립싱크: wlipsync (모음 분류, RMS 아님)
- ESLint(@antfu/eslint-config)가 린트+포맷 담당. Prettier 없음. 테스트는 vitest(node/jsdom) + Playwright(Chromium/WebKit)
- 문서: `docs/` 한국어 · README는 영어/한국어/일본어 3종 · API 레퍼런스 영어

## 구조와 책임

| 경로                         | 패키지                         | 책임                                                                      |
| ---------------------------- | ------------------------------ | ------------------------------------------------------------------------- |
| `packages/live2d-web`        | `live2d-web`                   | 유일한 퍼블리시 패키지. runtime/core·React·립싱크·어댑터                  |
| `packages/live2d-web/vendor` | —                              | Cubism Web Framework 5-r.5 단일 소스(별도 typecheck·라이선스 유지)        |
| `apps/playground`            | `@live2d-web/playground`       | Next 개발장. `/` React, `/vanilla` controller API                         |
| `apps/vanilla-consumer`      | `@live2d-web/vanilla-consumer` | React dependency 없는 Vite 소비자 fixture                                 |
| `scripts/`                   | —                              | 공식 배포처 fetch-assets(Core + Hiyori, 약관 확인 후 ignored 경로에 준비) |
| `docs/`                      | —                              | 설계 계약 SSOT — [문서 지도](docs/README.md)                              |
| `README.md`                  | —                              | 공개용(영어). 설치법·기능 가이드·React 레퍼런스 포함                      |

의존 방향은 `React/backends → core` 단방향이다. `src/index.ts`에 React, PIXI,
Framework import나 `"use client"`가 생기면 root 계약 위반이다.

## Key Path Index

- `docs/README.md` — 문서 지도 + 확정된 결정 목록
- `docs/roadmap.md` — 성장 목표·고도화 축·버전 순서 (기능 추가 전 여기서 소비자를 확인)
- `private/docs/ecosystem-survey.md` — npm 실측 + 이름 결정 기록 (로컬 전용, 미추적)
- `docs/architecture.md` — 구현된 어댑터·프레임·생명주기·품질 계약
- `docs/api-design.md` — 컴포넌트·훅 시그니처 + per-frame 규약 + 에러 모델
- `private/docs/extraction-map.md` — 선행 참조 구현 이관 기록 (로컬 전용, 미추적)
- `docs/licensing.md` — Cubism Core 비동봉 인과, 상표 고지, 선행 코드 크레딧
- `private/docs/cubism-webgl-plan.md` — WebGL 백엔드 구현·성능 계획 (로컬 전용, 미추적)
- `private/docs/roadmap.md` — 지나온 마일스톤 M0~M5 이력 (로컬 전용, 미추적)
- `packages/live2d-web/src/core/contract.ts` — 백엔드 계약 타입(architecture.md의 코드화)
- `packages/live2d-web/src/react/` — headless runtime binding, Store, hooks
- `packages/live2d-web/src/core/runtime.ts` — 바닐라 API와 공유 생명주기 controller
- `packages/live2d-web/src/core/` — 계약·Core 로더·품질·프레이밍
- `packages/live2d-web/src/features/lipsync/` — 순수 mouth controller와 wLipSync source 연결
- `packages/live2d-web/src/tracking/mediapipe/` — 선택형 Face Landmarker 상태·매핑·생명주기
- `packages/live2d-web/src/react/LipSync.tsx` — source/driver React 생명주기
- `packages/live2d-web/src/backends/pixi-v6/index.ts` — 단일 티커 PIXI v6 어댑터
- `packages/live2d-web/src/backends/cubism-webgl/` — 기본 Framework/WebGL2 어댑터
- `apps/playground/src/app/page.tsx` — React Hiyori 데모
- `apps/playground/src/app/vanilla/page.tsx` — `createLive2D()` Hiyori 데모
- `apps/vanilla-consumer/` — React 없는 import/build/browser 실행 검증
- `e2e/playground.spec.ts` — Chromium/WebKit 실제 WebGL 검증
- `scripts/fetch-assets.mjs` — Core + Hiyori 다운로드(멱등, sharp 없음)

## Commands

```bash
pnpm dev            # apps/playground dev 서버
pnpm build          # live2d-web 패키지 tsdown 빌드 (dist/)
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets # 공식 Core + Hiyori(최초 1회, ignored)
pnpm fetch-mediapipe-assets # 공식 WASM + Face Landmarker + portrait(ignored)
pnpm lint / lint:fix
pnpm typecheck
pnpm test
pnpm test:e2e       # 실제 Core/Hiyori + Chromium/WebKit/Firefox
pnpm test:tracking:e2e # MediaPipe portrait + Chromium/WebKit/Firefox
pnpm verify:package # tarball 내용물 + React 없는 소비자 번들 검증
pnpm verify:packed-consumers # 실제 tarball 설치: vanilla/React/Next SSR + prod audit
LIVE2D_SOAK_MINUTES=120 pnpm test:soak # 선택적인 Chromium 장시간 게이트
LIVE2D_TRACKING_SOAK_MINUTES=5 pnpm test:tracking:soak # 선택적인 MediaPipe 안정성 smoke
pnpm benchmark:backends # 기본 5분씩 cubism-webgl/pixi-v6 비교
pnpm up             # taze 일괄 업데이트 + prune + dedupe
```

## 함정 (하루씩 아끼는 지식)

1. **Cubism Core는 패키지에 동봉하지 않는다.** 사용자가 `coreUrl` 또는 선행
   `<script>`로 공급한다. `ensureCubismCore()`는 부재·로드 실패를
   `core-missing`으로 명확히 표면화하고 동일 URL의 동시 로드를 합친다.
2. **pixi-v6는 저장소 전용이다.** 0.2.0부터 발행하지 않는다(`tsdown.config.ts` entry와 `publishConfig.exports`에 없음). 벤치마크 비교 대상으로만 남으며 `pixi-live2d-display@0.4` + PIXI v6 전용(v7/v8 미지원)이다. dev `exports`에는 남아 있어 playground가 소스로 import한다. 다시 발행하려면 세 곳(entry, publishConfig.exports, peerDependencies)을 함께 되돌려야 한다.
3. **모듈러 PIXI v6는 수동 등록 필수.** `extensions.add(TickerPlugin, BatchRenderer)` 없으면 `renderer.plugins.batch`가 undefined로 터진다. `createStage()` 시점 idempotency 가드와 함께 어댑터 책임.
4. **dispose 순서: 기능(시선 → 립싱크) → model → stage.** 역순이면 WebGL 에러. 이 순서를 코어가 보장하는 것이 제품 약속이다.
5. **립싱크는 RMS가 아니라 wlipsync**(모음 분류). 반드시 메인 export만 — 워클렛·WASM이 data:URL 인라인이라 addModule 불필요. `wlipsync/wlipsync.js` 서브패스 금지.
6. **SDK 모션 커브가 파라미터를 덮어쓴다.** 립싱크 값은 SDK update 이후에 써야 한다 — v0.1은 `internalModel.afterMotionUpdate` 이벤트를 어댑터 안에서 사용한다. 표정·블링크를 코드로 소유하려면 `motionManager.expressionManager = null`, `internalModel.eyeBlink = null`.
7. **per-frame 값(mouthOpen 등)은 절대 React state 금지.** getter 콜백으로 엔진에 주입한다.
8. **`setupLive2DModel`의 source는 URL 문자열만.** `{url, id}` 객체는 "Unknown settings format".
9. **SDK의 now 단위(초/ms)를 신뢰하지 마라.** 델타는 `performance.now()`로 직접 잰다.
10. **텍스처는 `baseTexture.valid` 대기 후 Sprite 생성.** 반쯤 로드된 텍스처가 화면에 플래시된다.
11. **Node 24 필수(.nvmrc).** nvm 기본이 20이면 eslint-plugin-unicorn이 `mapTypes.union is not a function`으로 죽는다.
12. **`Cannot find native binding`(rolldown/vitest)** — pnpm optional deps 누락. `pnpm install --force`로 해결(darwin 바인딩을 devDep으로 명시하는 방법도 있다).
13. **trustPolicy 위양성** — provenance 도입(2023) 이전 구버전(semver@6.3.1 등)이 걸리면 `pnpm-workspace.yaml`의 `trustPolicyExclude`에 추가.
14. **dev 서버 포트** — 3000이 다른 프로젝트에 점유되면 Next가 3001+로 자동 이동. 검증 시 실제 포트를 로그에서 확인할 것.

15. **SSR-safe 어댑터 import.** `pixi-live2d-display`는 모듈 평가 때 `window`를 읽으므로 정적 import 금지. `loadModel()` 안에서 dynamic import한다.
16. **wLipSync도 browser-effect dynamic import만.** 메인 export는 AudioWorkletNode와 인라인 WASM을 평가한다. root 모듈에서 정적 runtime import하지 않는다. type-only import는 가능하다.
17. **오디오 소유권을 넘지 않는다.** LipSync source 모드는 사용자의 AudioNode/AudioContext를 close·suspend·전체 disconnect하지 않는다. 만든 분석 edge와 node/port만 정리한다.
18. **립싱크 실패는 비치명적.** `lipsync-error`는 현재 기능만 중단하고 Stage/Model ready 상태를 유지한다.
19. **cubism-webgl은 기본 backend다.** Core를 먼저 준비한 뒤 backend와
    Framework를 동적 import한다. Framework·셰이더는 backend chunk에만 두고
    Core·모델·profile은 절대 패키지에 포함하지 않는다. 이 포함 형태는
    Live2D에 서면 확인을 받았다(docs/licensing.md). 형태가 크게 바뀌면 다시
    확인한다.
20. **Core 버전을 섞지 않는다.** Framework 5-r.5에는 Cubism 5.3
    `core/06`을 사용한다. fetch script는 파일이 있어도 5.3 기능이 없으면
    새로 받는다. `core/05`는 실제 Hiyori moc 로드에서 실패했다.
21. **resolver 경로는 segment별 encode/decode한다.** `resolveAsset`이 있으면
    에셋은 `https://live2d-web.invalid/` 가상 origin에 대해 해석된다. `new
URL()` 전에 raw segment를 encode하지 않으면 `%`, `#`, `?`가 escape/query/
    fragment로 오해되고, 해석 뒤 decode하지 않으면 CJK 키가 빗나간다. `/`,
    `./`, `../`만 path 의미를 유지한다. `assets.ts`가 이 계약의 단일 지점이다.
22. **Pixi 비교는 Core를 분리한다.** `pixi-live2d-display@0.4`의 구형
    Framework는 Core 5.3 blend-mode 구조와 호환되지 않는다. `/compare`는
    backend 변경 시 페이지를 다시 로드하며 pixi-v6에 `core/05`를 사용한다.
    한 페이지에서 process-global Core를 교체하지 않는다.
23. **MediaPipe는 선택형 서브패스다.** `@mediapipe/tasks-vision`은 optional
    peer이며 `/tracking/mediapipe`에서만 동적 import한다. root에 정적 import,
    기본 CDN, WASM·task 모델 동봉을 추가하지 않는다. 카메라·video·rAF·track은
    앱이 소유하고 tracker는 task와 Live2D parameter driver만 정리한다.

## 규칙

- 결정은 해당 주제 문서에 날짜 붙은 섹션으로 기록한다: 결정문 → 근거 → 포기와 대체 → 재검토 조건. 별도 adr/ 폴더를 만들지 않는다
- 생태계 수치를 인용할 때는 측정일을 함께 적는다
- AIRI(MIT) 코드 패턴은 차용 가능, **캐릭터 에셋은 사용 금지**(라이선스 불명)
- git init·커밋은 사용자 지시가 있을 때만
