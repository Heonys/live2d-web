# 아키텍처

live2d-jsx의 기술 계약 SSOT다. 상태 기준일 **2026-07-29** — 전부 설계 단계이며 코드는 없다. 결정은 이 문서에 날짜 붙은 섹션으로 기록한다(결정문 → 근거 → 포기와 대체 → 재검토 조건).

## 계층

```
사용자 코드 (JSX)
  └─ live2d-jsx 코어           컴포넌트·훅·기능(립싱크·시선)·에러 모델
       └─ Live2DBackend         어댑터 계약 (이 문서가 정의)
            ├─ adapters/pixi-v6      pixi-live2d-display@0.4 + PIXI v6 모듈러  ← v0.1
            ├─ (v2 후보) adapters/native  공식 Cubism SDK 직결 — PIXI 미의존
            └─ (미래) adapters/pixi-v8 등
```

## 어댑터 결정 (2026-07-29)

렌더링 백엔드를 어댑터 계약 뒤에 숨기고, v0.1은 `pixi-live2d-display@0.4`(+PIXI v6 모듈러) 어댑터 하나만 구현한다.

- **근거**: 하부 생태계가 방치된 원본 + 포크 4개로 파편화돼 있고([생태계 조사](ecosystem-survey.md)) 어느 것도 표준이 될 조짐이 없다. 특정 백엔드와 결혼하면 그 백엔드의 운명에 종속된다. aizuchi의 `packages/stage`가 이미 "React import 금지" 프레임워크 불가지 층으로 검증돼 있어 어댑터화 비용이 낮다.
- **포기와 대체**: 단일 백엔드 밀착 최적화(내부 API 직접 사용)를 포기한다. 대신 백엔드 내부 접근이 필요한 지점은 전부 계약의 훅으로 승격한다(아래 `onAfterMotionUpdate`).
- **재검토 조건**: 어댑터 계약이 두 번째 백엔드에서 성립하지 않는 시점. 또는 특정 포크가 표준화(주간 5,000+)되어 어댑터 층의 존재 이유가 약해지는 시점.

## 패키지 형태 결정 (2026-07-29)

`@live2d-jsx/*` 모노레포가 아니라 **단일 패키지 + 서브패스 export**로 시작한다.

```
live2d-jsx                    # 코어 — 컴포넌트·훅·계약·기능
live2d-jsx/adapters/pixi-v6   # 서브패스 export — 하부 peerDeps는 optional
```

- **근거**: aizuchi의 규칙 "패키지 분리는 두 번째 소비자가 생길 때만"(AIRI의 42개 패키지 분할이 반면교사). 어댑터가 하나뿐인 시점의 모노레포는 관리 비용만 만든다.
- **포기와 대체**: 어댑터별 독립 버저닝을 포기한다. 서브패스 export + optional `peerDependencies`로 트리셰이킹과 의존 격리는 유지한다.
- **재검토 조건**: 두 번째 어댑터가 실제로 착지해 어댑터별 릴리스 주기가 갈라질 때.

같은 결정의 일부로 — **aizuchi의 "dist를 만들지 마라" 규칙은 이 저장소에서 반전된다.** 그 규칙은 모노레포 내부 소스-export 패키지용이었고, npm 퍼블리시 라이브러리는 빌드 산출물(ESM + `.d.ts`)과 exports map이 필수다.

## 저장소 구조 결정 (2026-07-29)

퍼블리시 패키지 1개 + 플레이그라운드의 **미니 워크스페이스**로 간다. npm에 올라가는 것은 여전히 `live2d-jsx` 하나 — 워크스페이스는 플레이그라운드가 라이브러리를 실제 의존성(`workspace:^`)으로 소비하기 위해서만 존재한다.

```
packages/live2d-jsx/          # 유일한 퍼블리시 패키지
  src/
    index.ts                  # 코어 배럴 — pixi import 금지
    core/                     # 계약 타입·생명주기·ensureCubismCore·Live2DError
    components/               # Live2DStage · Live2DModel · LipSync · IdleGaze · PointerTracking
    hooks/
    features/                 # 백엔드 무관 로직 — lipsync(mouthDriver)·gaze·fit
    adapters/pixi-v6/         # 서브패스 export — pixi 의존은 전부 이 안에만
  test/conformance/           # 어댑터 적합성 스위트
apps/playground/              # Next.js 개발장(비퍼블리시) — SSR·StrictMode 약속을 매일 검증
```

- **의존 방향 단방향**: `adapters → core`만 허용. `src/index.ts`에 pixi 관련 import가 생기면 계약 순수성 위반 신호.
- **exports map이 경계 강제**: `.`과 `./adapters/pixi-v6` 두 진입점. pixi 계열은 **optional peerDependencies** — 코어만 쓰는 소비자는 설치 불필요.
- **플레이그라운드가 Next인 근거**: 이 라이브러리의 가장 어려운 약속(SSR-safe·StrictMode-safe)이 Next 모양의 문제라, 개발 환경 자체가 그 약속을 상시 검증하게 한다. v0.1 완료 정의와도 일치.
- **도구** (2026-07-29 스캐폴딩에서 확정): tsdown(ESM 전용 + d.ts), vitest(`*.test.ts` node / `*.browser.test.ts` 추후), pnpm catalog, @antfu/eslint-config, GitHub Actions(lint/typecheck/test+build), 릴리스는 초기 수동 publish.
- **exports 전략** (2026-07-29): 개발 중엔 소스 exports(`./src/index.ts`) + Next `transpilePackages`, 퍼블리시 시엔 `publishConfig.exports`가 dist로 전환한다 — 빌드 없이 플레이그라운드가 돌고, npm 소비자는 dist를 받는다.
- **버전 전략** (2026-07-29): 공유 의존은 aizuchi catalog의 검증 조합을 이식(TS ^5.9.3 유지 — 7.x는 생태계 호환 확인 후). 신규는 tsdown뿐.
- **하지 않는 것**: 패키지 쪼개기(두 번째 어댑터 착지 전 금지 — 패키지 형태 결정 참조), 문서 사이트(사용자 생긴 뒤), CJS 듀얼(요구가 실재할 때).

## 백엔드 계약 (초안)

```ts
interface Live2DBackend {
  /** Cubism Core 존재 검증 포함 — 없으면 명확한 에러로 즉시 실패 */
  createStage(el: HTMLElement, opts: StageOptions): StageHandle
  loadModel(stage: StageHandle, url: string): Promise<ModelHandle>
}

interface StageOptions {
  width: number
  height: number
  /** 슈퍼샘플 배율. 기본 2 — 버퍼를 2배로 만들고 CSS로 축소(autoDensity 미사용) */
  resolution?: number
  maxFps?: number
}

interface StageHandle {
  resize(width: number, height: number): void
  /** 페이지 좌표 → 렌더러 버퍼 좌표. focus()가 소비한다 */
  toWorld(clientX: number, clientY: number): { x: number; y: number }
  dispose(): void
}

interface ModelHandle {
  setParameter(id: string, value: number): void
  focus(x: number, y: number): void
  motion(group: string, index?: number): Promise<void>
  expression(id?: string): Promise<void>
  /**
   * SDK 모션 업데이트 직후에 콜백을 실행한다. 립싱크 등 파라미터를 "최종 확정"
   * 하는 코드의 유일한 진입점. 반환값은 해제 함수.
   * 이 훅이 어댑터 계약의 핵심이자 가장 깨지기 쉬운 부분이다 (아래 참조).
   */
  onAfterMotionUpdate(cb: (deltaMs: number) => void): () => void
  dispose(): void
}
```

## 핵심 난제: onAfterMotionUpdate (M0 스파이크 대상)

Cubism SDK의 모션 커브는 매 프레임 `ParamMouthOpenY` 같은 파라미터를 덮어쓴다. aizuchi의 mouthDriver는 이를 `model.internalModel.motionManager.update` **몽키패치**로 우회했다 — SDK 업데이트가 끝난 직후에 립싱크 값을 다시 쓰는 방식.

몽키패치는 백엔드 사유 API 침범이므로 라이브러리 코어에 둘 수 없다. 대신:

- 코어는 `onAfterMotionUpdate`라는 **계약**만 안다.
- pixi-v6 어댑터가 내부에서 몽키패치로 이 계약을 **구현**한다 — 침범을 어댑터 안에 격리.
- 미래의 백엔드가 공식 훅을 제공하면 어댑터만 바뀐다.

**이 계약이 pixi-live2d-display@0.4에서 실제로 성립하는지가 v0.1 전체의 전제**이므로, 코드 착수 전 [로드맵](roadmap.md)의 M0 스파이크로 검증한다. 성립 기준: 패치가 어댑터 안에 격리된 상태로, idle 모션이 도는 중에 립싱크 파라미터가 덮이지 않을 것. 결과(성립/불성립/조건부)는 이 섹션에 날짜 붙여 추기한다.

**불성립 시 대안 경로**: 프로젝트 중단이 아니라 native 어댑터(아래 결정)의 조기 착수로 전환한다. 자체 업데이트 루프를 소유하는 native 백엔드에서는 이 난제가 문제 자체로 소멸한다 — 몽키패치가 필요한 이유가 남의 루프에 끼어드는 것이기 때문이다.

## 백엔드 교체 가능성 결정 (2026-07-29)

v0.x는 pixi-v6 어댑터로 출시하고, **v2 후보로 공식 Cubism SDK 직결 native 어댑터**를 둔다. 교체가 아니라 병존이다 — 사용자는 import 한 줄로 백엔드를 선택하고, JSX·훅·앱 코드는 그대로다.

- **근거**: 코어의 자산(React 층·mouthDriver·gaze·fitModel)은 계약만 보므로 백엔드와 무관하게 살아남는다. native에서는 업데이트 루프를 직접 소유하므로 `onAfterMotionUpdate` 난제가 문제 자체로 소멸한다. 렌더러를 0부터 쓰는 것도 아니다 — 공식 Framework의 `CubismRenderer_WebGL`(마스킹 구현 포함)을 감싸는 것부터 시작할 수 있다.
- **전제**: 공식 Framework의 라이선스(Live2D Open Software License) 검토 — [라이선스](licensing.md) 미결 항목.
- **교체 가능성을 지키는 규칙 3개**:
  1. **계약 순수성** — 계약은 Cubism 도메인 언어(`setParameter`·`motion`·`focus`)로만 쓴다. PIXI 개념(DisplayObject, PIXI 좌표계 가정)의 유입 금지.
  2. **탈출구 격리** — 어댑터 내부 객체 접근을 열 경우 `unstable_` 표시로 "계약 밖"임을 명시한다. 탈출구에 의존한 코드는 백엔드 교체 시 깨질 수 있음을 문서화한다.
  3. **적합성 스위트** — v0.1에서 "어댑터라면 통과해야 하는 공용 테스트"를 구축한다. 이후 모든 어댑터는 같은 스위트로 계약 준수를 증명한다.
- **비보장**: 백엔드 간 픽셀 단위 동일 렌더링은 약속하지 않는다(마스킹·안티앨리어싱·슈퍼샘플 구현 차).
- **재검토 조건**: v0.x에서 수요가 실증되지 않으면 native는 착수하지 않는다([로드맵](roadmap.md)).

## 부수 결정 (2026-07-29)

- **슈퍼샘플 캔버스**: 버퍼를 `resolution`배로 만들고 stage scale로 논리 좌표를 유지, CSS로 표시 크기를 잡는다(`autoDensity` 미사용). aizuchi `createStage.ts`에서 검증된 패턴. 어댑터 내부 구현으로 흡수한다.
- **가드 티커**: 렌더 에러 발생 시 콘솔 무한 스팸 대신 티커를 정지하고 에러 모델로 표면화한다.
- **모듈러 PIXI v6 초기화**: `extensions.add(TickerPlugin, BatchRenderer)` 수동 등록 + 모듈 레벨 idempotency 가드는 어댑터 책임. `InteractionManager`는 등록하지 않는다 — 시선은 `focus()` 직접 구동.
- **Cubism Core 로딩**: 재배포 금지라 번들 불가([라이선스](licensing.md)). `ensureCubismCore()`가 전역 존재를 검증하고, 없으면 로드 방법을 담은 명확한 에러를 던진다.
- **동시 로드 보호**: 원본(aizuchi)에 없어 신규 설계 대상([추출 지도](extraction-map.md)의 불일치 항목). 같은 스테이지에 대한 `loadModel` 중복 호출의 직렬화 여부는 v0.1 구현에서 결정하고 여기 추기한다.
- **SSR**: 전면 클라이언트 온리. Next.js 사용 패턴은 [API 설계](api-design.md)에 둔다.

## 생명주기 계약

```
mount:   ensureCubismCore → backend.createStage → backend.loadModel → 기능 부착(립싱크·시선)
unmount: 기능 해제(시선 → 립싱크) → model.dispose() → stage.dispose()
```

- **해제 순서는 코어가 보장한다.** 역순이면 WebGL 에러(aizuchi에서 실측된 함정). 사용자 API에는 dispose가 없다 — 언마운트가 dispose다.
- **StrictMode 대응**: 모든 `await` 뒤 `disposed` 가드 + 이미 생성된 리소스의 인라인 폐기. 참조 구현은 aizuchi `StageView.tsx`의 boot/cleanup 패턴.
