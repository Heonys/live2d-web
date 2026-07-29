# API 설계

공개 API 계약이다. [아키텍처](architecture.md)의 백엔드 계약 위에 선다. 기준일 **2026-07-29** — 시그니처는 M0 스파이크와 v0.1 구현에서 조정될 수 있고, 조정할 때는 이 문서를 먼저 고친다(문서가 계약, 코드가 구현).

## 목표 형태

```tsx
'use client'
import { Live2DStage, Live2DModel, LipSync, IdleGaze, PointerTracking } from 'live2d-jsx'
import { pixiV6 } from 'live2d-jsx/adapters/pixi-v6'

export function Character({ audioNode }: { audioNode: AudioNode | null }) {
  return (
    <Live2DStage backend={pixiV6} resolution={2} maxFps={60}>
      <Live2DModel src="/models/hiyori.model3.json" fit="upper-body">
        <LipSync source={audioNode} />
        <IdleGaze suppressAfterPointerMs={4000} />
        <PointerTracking />
      </Live2DModel>
    </Live2DStage>
  )
}
```

비교 기준: 같은 일을 하는 aizuchi `StageView.tsx`는 약 250줄이다([추출 지도](extraction-map.md)).

## 컴포넌트 계약

### `<Live2DStage>`

캔버스 컨테이너를 렌더하고 스테이지 생명주기를 소유한다.

```ts
interface Live2DStageProps {
  backend: Live2DBackend
  /** 슈퍼샘플 배율. 기본 2 */
  resolution?: number
  maxFps?: number
  className?: string
  /** loading 동안 렌더. 단계를 받아 진행 UI를 만들 수 있다 */
  fallback?: (stage: LoadingStage) => ReactNode
  /** error 시 렌더. retry로 재시도 UI를 구성한다 */
  errorFallback?: (error: Live2DError, retry: () => void) => ReactNode
  onError?: (error: Live2DError) => void
  children?: ReactNode
}

type LoadingStage = 'core' | 'stage' | 'model'
```

- ResizeObserver로 컨테이너 크기를 관찰해 `stage.resize()`에 위임한다.
- 내부 상태는 `loading / ready / error` 3상태. `useStage()`로 노출.

### `<Live2DModel>`

```ts
interface Live2DModelProps {
  /** model3.json의 URL. 반드시 문자열 — 객체를 주면 하부에서 "Unknown settings format" */
  src: string
  /** 프레이밍. 기본 'upper-body'(반신) */
  fit?: 'upper-body' | 'full' | { scale: number; offsetY?: number }
  /** 일시 실패 재시도 횟수. 기본 2 (지수 백오프) — 모바일 회선 흡수용 */
  retries?: number
  onLoad?: (model: ModelHandle) => void
  children?: ReactNode
}
```

### `<LipSync>`

```ts
interface LipSyncProps {
  /** 내장 wlipsync 드라이버에 연결할 오디오 소스. null이면 대기 */
  source?: AudioNode | null
  /** 외부 드라이버 직접 주입 — source와 배타. per-frame getter 규약을 따른다 */
  driver?: { getMouthOpen: () => number; isSpeaking: () => boolean }
  /** 발화 종료 후 모션 커브로 crossfade하는 꼬리. 기본 200ms */
  releaseMs?: number
  /** crossfade 후 입을 0으로 강제 유지 — idle 모션의 입 재개방 방지. 기본 500ms */
  holdMs?: number
}
```

내장 드라이버는 wlipsync(모음 분류)다. RMS 볼륨 게이트가 아니다 — 오디오 출처와 무관하게 재사용된다.

### `<IdleGaze>` / `<PointerTracking>`

```ts
interface IdleGazeProps {
  minIntervalMs?: number       // 기본 1800
  maxIntervalMs?: number       // 기본 5200
  /** 포인터 활동 후 이 시간 동안 idle 시선 억제. 기본 4000 */
  suppressAfterPointerMs?: number
}
```

`<PointerTracking />`은 포인터 좌표를 `stage.toWorld()` 경유로 `model.focus()`에 흘린다. 두 컴포넌트는 같은 `focus()` 진입점을 쓰며, 우선순위 규칙(포인터 > idle)은 코어가 중재한다.

## 훅

```ts
/** Stage 상태 구독 */
function useStage(): {
  status: 'loading' | 'ready' | 'error'
  error?: Live2DError
  retry: () => void
}

/** 가장 가까운 <Live2DModel>의 핸들. 로드 전 null */
function useLive2DModel(): ModelHandle | null

/** 이산 값 바인딩 — value가 바뀔 때만 쓴다. per-frame 값 금지 */
function useLive2DParameter(id: string, value: number): void

/** per-frame 바인딩 — getter가 엔진 틱마다 호출된다. React 렌더와 무관 */
function useParameterDriver(id: string, getter: () => number): void

function useLive2DMotion(): {
  play(group: string, index?: number): Promise<void>
  setExpression(id?: string): Promise<void>
}
```

## 제품 약속의 API 반영

[제품 비전](product-vision.md)의 약속과 1:1이다.

1. **조용한 실패 없음 → `ensureCubismCore(url?)`.** 전역 `Live2DCubismCore` 존재를 검증하고, 없으면 로드 방법(공식 SDK 링크·`<script>` 예시)을 담은 `Live2DError('core-missing')`를 던진다. `<Live2DStage>`가 내부에서 먼저 호출하므로 대부분의 사용자는 직접 쓸 일이 없다.
2. **dispose 순서 자동 보장.** 언마운트 시 기능(시선 → 립싱크) → 모델 → 스테이지 순서를 코어가 실행한다. 사용자 API에 dispose가 없다 — 언마운트가 dispose다.
3. **StrictMode-safe.** 모든 `await` 뒤 disposed 가드 + 생성 리소스 인라인 폐기. v0.1 완료 정의에 "StrictMode 켠 Next.js에서 마운트/언마운트 반복" 테스트가 포함된다([로드맵](roadmap.md)).

## per-frame 규약 (강한 계약)

매 프레임 갱신되는 값(mouthOpen, speaking, 트래킹 좌표)은 **절대 React state·props로 흐르지 않는다.**

- **쓰기**: `useParameterDriver(id, getter)` 또는 `<LipSync driver={{ getMouthOpen, isSpeaking }}>` — getter 콜백을 엔진에 주입하고, 엔진이 자기 틱에서 호출한다.
- **읽기**: 필요 시 ref 기반 구독만 제공한다. state 스냅샷 API는 만들지 않는다.
- **근거**: 60fps state 갱신은 React 렌더 루프를 죽인다(aizuchi에서 규칙으로 확립).

## 에러 모델

```ts
class Live2DError extends Error {
  code: 'core-missing' | 'model-load-failed' | 'render-error' | 'adapter-error'
  cause?: unknown
}
```

- 렌더 중 에러(WebGL 컨텍스트 등)는 가드 티커가 잡아 티커 정지 + `onError` 통지한다 — 콘솔 무한 스팸 금지.
- 로드 실패는 `retries`(지수 백오프) 소진 후 error 상태로 전이한다.

## Next.js 사용 패턴 (문서화 대상)

```tsx
// app/layout.tsx — Cubism Core는 모델 로드 전에 전역으로 있어야 한다
<Script src="/assets/live2dcubismcore.min.js" strategy="beforeInteractive" />

// 사용처 — 전면 클라이언트 온리
const Character = dynamic(() => import('~/components/Character'), { ssr: false })
```

React 19 / Next.js App Router 기준으로 예시를 유지한다.
