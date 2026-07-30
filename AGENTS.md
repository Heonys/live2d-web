# live2d-jsx — Agent Guide

Live2D Cubism 모델을 React에서 JSX로 선언적으로 다루는 **오픈소스 라이브러리**. 현재 **v0.1 alpha 구현 완료·npm 공개 전 단계**다. React Stage/Model, 자동 품질, pixi-v6 어댑터와 실제 Hiyori Playground가 있다. 계약은 `docs/`가 단일 기준이다. 루트 `CLAUDE.md`는 `@AGENTS.md` 한 줄짜리 포인터로, 지침은 이 파일에만 쓴다(두 벌 관리 금지).

## Tech Stack

- pnpm workspace(catalog 버전 관리) — 단, **npm 퍼블리시는 `live2d-jsx` 패키지 하나** + 서브패스 export(`live2d-jsx/adapters/pixi-v6`)
- 퍼블리시 라이브러리 — tsdown 빌드(ESM + d.ts). 개발 중엔 소스-export + Next `transpilePackages`, 퍼블리시 시 `publishConfig.exports`가 dist로 전환
- v0.1 어댑터: `pixi-live2d-display@0.4` + PIXI v6 모듈러(`@pixi/*`)
- 립싱크(v0.2): wlipsync (모음 분류, RMS 아님)
- ESLint(@antfu/eslint-config)가 린트+포맷 담당. Prettier 없음. 테스트는 vitest(node/jsdom) + Playwright(Chromium/WebKit)
- 문서: `docs/` 한국어 · `README.md`와 API 레퍼런스 영어 · 일본어 콘텐츠는 Zenn

## 구조와 책임

| 경로                  | 패키지                   | 책임                                                                        |
| --------------------- | ------------------------ | --------------------------------------------------------------------------- |
| `packages/live2d-jsx` | `live2d-jsx`             | 유일한 퍼블리시 패키지. 계약(core/)·기능(features/, 예정)·어댑터(adapters/) |
| `apps/playground`     | `@live2d-jsx/playground` | Next 개발장(비퍼블리시). SSR·StrictMode 약속을 상시 검증                    |
| `scripts/`            | —                        | 공식 배포처 fetch-assets(Core + Hiyori, 약관 확인 후 ignored 경로에 준비)   |
| `docs/`               | —                        | 설계 계약 SSOT — [문서 지도](docs/README.md)                                |
| `README.md`           | —                        | 공개용(영어). 코드가 완성되기 전까지 배지·설치법 없음                       |

의존 방향은 `adapters → core` 단방향. `src/index.ts`에 pixi import가 생기면 계약 순수성 위반이다.

## Key Path Index

- `docs/README.md` — 문서 지도 + 확정된 결정 목록
- `docs/ecosystem-survey.md` — npm 실측(2026-07-29) + 이름 결정 기록. 첫 Zenn 글의 원본
- `docs/architecture.md` — 구현된 어댑터·프레임·생명주기·품질 계약
- `docs/api-design.md` — 컴포넌트·훅 시그니처 + per-frame 규약 + 에러 모델
- `docs/extraction-map.md` — aizuchi `packages/stage` → live2d-jsx 이관 지도
- `docs/licensing.md` — Cubism Core 비동봉 인과, 상표 고지, 선행 코드 크레딧
- `docs/roadmap.md` — v0.1 공개 게이트 → v0.2 AIZUCHI → 후속 백엔드 계획
- `packages/live2d-jsx/src/core/contract.ts` — 어댑터 계약 타입(architecture.md의 코드화)
- `packages/live2d-jsx/src/react/` — Stage/Model 컴포넌트, Store, hooks
- `packages/live2d-jsx/src/core/` — 계약·Core 로더·품질·프레이밍·생명주기
- `packages/live2d-jsx/src/adapters/pixi-v6/index.ts` — 단일 티커 PIXI v6 어댑터
- `apps/playground/src/app/page.tsx` — 실제 Hiyori와 품질/프레이밍/파라미터 데모
- `e2e/playground.spec.ts` — Chromium/WebKit 실제 WebGL 검증
- `scripts/fetch-assets.mjs` — Core + Hiyori 다운로드(멱등, sharp 없음)
- `../aizuchi/packages/stage/` — 추출 원본(약 450줄, React import 금지 층)
- `../aizuchi/apps/web/src/components/stage/StageView.tsx` — React 글루 참조 구현

## Commands

```bash
pnpm dev            # apps/playground dev 서버
pnpm build          # live2d-jsx 패키지 tsdown 빌드 (dist/)
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets # 공식 Core + Hiyori(최초 1회, ignored)
pnpm lint / lint:fix
pnpm typecheck
pnpm test
pnpm test:e2e       # 실제 Core/Hiyori + Chromium/WebKit
pnpm up             # taze 일괄 업데이트 + prune + dedupe
```

## 함정 (하루씩 아끼는 지식 — aizuchi 실서비스에서 이관)

1. **Cubism Core는 패키지에 동봉하지 않는다.** 사용자가 `coreUrl` 또는 선행
   `<script>`로 공급한다. `ensureCubismCore()`는 부재·로드 실패를
   `core-missing`으로 명확히 표면화하고 동일 URL의 동시 로드를 합친다.
2. **어댑터별 하부 버전 고정.** pixi-v6 어댑터는 `pixi-live2d-display@0.4` + PIXI v6 전용(v7/v8 미지원). 업그레이드가 아니라 새 어댑터로 대응한다.
3. **모듈러 PIXI v6는 수동 등록 필수.** `extensions.add(TickerPlugin, BatchRenderer)` 없으면 `renderer.plugins.batch`가 undefined로 터진다. `createStage()` 시점 idempotency 가드와 함께 어댑터 책임.
4. **dispose 순서: 기능(시선 → 립싱크) → model → stage.** 역순이면 WebGL 에러. 이 순서를 코어가 보장하는 것이 제품 약속이다.
5. **립싱크는 RMS가 아니라 wlipsync**(모음 분류). 반드시 메인 export만 — 워클렛·WASM이 data:URL 인라인이라 addModule 불필요. `wlipsync/wlipsync.js` 서브패스 금지.
6. **SDK 모션 커브가 파라미터를 덮어쓴다.** 립싱크 값은 SDK update 이후에 써야 한다 — v0.1은 `internalModel.afterMotionUpdate` 이벤트를 어댑터 안에서 사용한다. 표정·블링크를 코드로 소유하려면 `motionManager.expressionManager = null`, `internalModel.eyeBlink = null`.
7. **per-frame 값(mouthOpen 등)은 절대 React state 금지.** getter 콜백으로 엔진에 주입한다.
8. **`setupLive2DModel`의 source는 URL 문자열만.** `{url, id}` 객체는 "Unknown settings format".
9. **SDK의 now 단위(초/ms)를 신뢰하지 마라.** 델타는 `performance.now()`로 직접 잰다.
10. **텍스처는 `baseTexture.valid` 대기 후 Sprite 생성.** 반쯤 로드된 텍스처가 화면에 플래시된다.
11. **Node 24 필수(.nvmrc).** nvm 기본이 20이면 eslint-plugin-unicorn이 `mapTypes.union is not a function`으로 죽는다.
12. **`Cannot find native binding`(rolldown/vitest)** — pnpm optional deps 누락. `pnpm install --force`로 해결(optiq는 darwin 바인딩 devDep 명시로 해결했었다).
13. **trustPolicy 위양성** — provenance 도입(2023) 이전 구버전(semver@6.3.1 등)이 걸리면 `pnpm-workspace.yaml`의 `trustPolicyExclude`에 추가.
14. **dev 서버 포트** — 3000이 다른 프로젝트(optiq 등)에 점유되면 Next가 3001+로 자동 이동. 검증 시 실제 포트를 로그에서 확인할 것.

15. **SSR-safe 어댑터 import.** `pixi-live2d-display`는 모듈 평가 때 `window`를 읽으므로 정적 import 금지. `loadModel()` 안에서 dynamic import한다.

## 규칙

- 결정은 해당 주제 문서에 날짜 붙은 섹션으로 기록한다: 결정문 → 근거 → 포기와 대체 → 재검토 조건. 별도 adr/ 폴더를 만들지 않는다
- 생태계 수치를 인용할 때는 측정일을 함께 적는다
- AIRI(MIT) 코드 패턴은 차용 가능, **캐릭터 에셋은 사용 금지**(라이선스 불명)
- git init·커밋은 사용자 지시가 있을 때만
