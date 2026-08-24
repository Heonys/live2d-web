# API Reference

Status: 2026-08-24. The package is ESM-only, versioned `0.3.1`. The root
entry has no React dependency;
React 18.2 and React 19 are supported through `live2d-web/react`.

## Vanilla API

```ts
import { createLive2D } from 'live2d-web'

const character = await createLive2D({
  container,
  coreUrl: '/live2dcubismcore.min.js',
  fit: 'upper-body',
  quality: 'auto',
  src: '/models/hiyori.model3.json',
})
```

```ts
type CreateLive2DOptions = {
  container: HTMLElement
  src: string
  backend?: Live2DBackend
  coreUrl?: string
  fit?: ModelFit
  followPointer?: boolean
  idleMotion?: string | false
  maxFps?: number
  pauseWhenOffscreen?: boolean
  retries?: number
  signal?: AbortSignal
  onError?: (error: Live2DError) => void
} & (
  | { quality?: 'auto' | AutoQualityPolicy; resolution?: never }
  | { quality?: never; resolution: number }
)

interface Live2DInstance {
  getState(): Live2DRuntimeState
  subscribe(listener: () => void): () => void
  motion(group: string, index?: number, options?: MotionOptions): Promise<void>
  isMotionPlaying(): boolean
  expression(id?: string): Promise<void>
  clearExpression(): void
  getModelInfo(): ModelInfo
  focus(x: number, y: number): void
  focusAt(clientX: number, clientY: number): void
  hitTest(clientX: number, clientY: number): string[]
  getParameter(id: string): number
  setParameter(id: string, value: number): void
  clearParameter(id: string): void
  setFit(fit: ModelFit): void
  addParameterDriver(id: string, driver: ParameterDriver): () => void
  addLipSync(options: RuntimeLipSyncOptions): () => void
  pause(): void
  resume(): void
  retry(): Promise<void>
  dispose(): void
}

interface MotionOptions {
  priority?: 'force' | 'idle' | 'normal' // default 'force'
  fadeInMs?: number
  fadeOutMs?: number
}

interface ModelInfo {
  expressions: string[]
  hitAreas: string[]
  motions: Record<string, number> // group name -> motion count
}
```

`motion()` resolves when playback finishes (or is interrupted), so sequencing
is a plain `await`. It resolves on dispose, and rejects with the stage error if
a render error (such as WebGL context loss) stops the frame loop; motions
started after that error reject immediately. `focusAt`/`hitTest` take viewport
client coordinates; `focus` takes stage-local CSS pixels.

`fadeInMs` and `fadeOutMs` are optional, finite, non-negative millisecond
overrides for one playback. `0` disables that motion-wide fade; omitting a
field keeps the authored value. Resolution order is the call option, the
model3 motion entry, motion3 `Meta`, then the Framework default. A motion3
parameter curve's own fade remains in force for that parameter. `fadeOutMs`
applies both at natural completion and when another motion interrupts it.
Invalid values reject with `invalid-props`.

The default `cubism-webgl` backend implements these overrides. The
repository-only `pixi-v6` comparison backend rejects a supplied fade option
with `invalid-props` instead of silently ignoring it. A custom backend must
likewise either implement a public option or reject it explicitly.

`setParameter()` is a persistent per-frame override that is re-applied after
every SDK update until `clearParameter()` removes it. `pauseWhenOffscreen`
defaults to `true`: an IntersectionObserver pauses rendering while the
container is outside the viewport. Pause sources (user `pause()`, hidden tab,
offscreen container) are tracked separately, and the stage resumes only when
none remains, so a tab switch no longer overrides an explicit user pause. A
user pause survives `retry()`; hidden/offscreen reasons are re-derived by the
new generation's observers.

The promise resolves after Core, Stage and model setup. An initial failure
rejects and disposes partial resources. Runtime errors after readiness update
the subscribed state and call `onError`. `retry()` recreates the whole Stage.

Omitting `backend` loads Cubism Core first and then dynamically imports the
default `cubism-webgl` backend. WebGL2 absence reports `webgl-unsupported`; the
runtime never falls back to Pixi or WebGL1.

Explicit selection is available from the backend subpaths:

```ts
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/backends/cubism-webgl'
```

`createCubismWebGLBackend({ shaderBaseUrl })` is only needed to serve shaders
from a custom URL. `pixiV6` is not published as of 0.2.0; it resolves from
source inside this workspace for the benchmarks only.

`addParameterDriver()` and `addLipSync()` return idempotent cleanup functions.
Registered features survive `retry()` and attach to the new model generation.

## Model sources (0.3.0)

```ts
type Live2DAssetResolver = (
  path: string,
  signal?: AbortSignal,
) => Promise<Blob | ArrayBuffer | undefined> | Blob | ArrayBuffer | undefined
```

`resolveAsset` is accepted by `createLive2D()`, `<Live2DModel>` and the
backend contract's `LoadModelOptions`. Without it `src` is a URL and assets are
fetched relative to it, exactly as before.

With it, `src` names a path inside the caller's source and every asset the
model declares is requested from the resolver instead. Returning `undefined`
raises `model-load-failed` naming that path, with `httpStatus: 404` in the
details so the runtime's retry policy treats it as final: a file the source
does not have will not appear on a second attempt.

Two decisions are worth recording.

**Paths resolve against a reserved origin.** A resolver-backed model has no
origin, so `assets.ts` resolves its assets against `https://live2d-web.invalid/`
and keeps using `new URL()`. Relative paths, nested directories and `./`/`../`
therefore keep the semantics browsers already define, `../` cannot climb above
the source root, and an absolute URL a model declares falls out of the virtual
origin and is fetched as the author intended. `.invalid` can never resolve in
DNS, so a request escaping to fetch fails instead of reaching a real host.

**Resolver keys are encoded by segment and decoded before the resolver sees
them.** `new URL()` gives queries and fragments special meaning, so a raw
archive filename such as `표정 50%/웃음#강함?.exp3.json` must be encoded before
resolution and decoded afterwards. `/`, `./` and `../` retain URL path
semantics; CJK, spaces and literal `%`, `#`, `?` retain filename semantics.

**Absolute URLs are a deliberate network escape.** A model can declare an
absolute URL and it will use `fetch` rather than `resolveAsset`. Applications
that open untrusted archives should inspect model3.json first and reject those
references when local-only or no-network behavior is required. The resolver
cannot enforce that policy because an application may intentionally mix local
and CDN-hosted assets.

Archive handling stays out of the package. A resolver is a plain function, so
unpacking, filename recovery and storage belong to the application and no
archive dependency is imposed on someone who only wants a character on a page.

### ensureCubismCore

```ts
ensureCubismCore(coreUrl?: string, options?: { signal?: AbortSignal }): Promise<void>
```

Exported from both entries. Loads the Cubism Core script when the global is
not present, deduplicating concurrent calls per URL. It always creates its own
`<script>` element (a page-owned tag with the same URL is ignored, because its
one-shot load/error events may already have fired), gives up with
`core-missing` after 30 seconds, and rejects with the signal's reason on
abort; aborting one caller never cancels the shared load for others.
`createLive2D()` calls this internally, so direct use is only needed to
preload Core ahead of time.

## React components

```tsx
import { LipSync, Live2DModel, Live2DCanvas } from 'live2d-web/react'

<Live2DCanvas coreUrl="/live2dcubismcore.min.js">
  <Live2DModel src="/models/hiyori.model3.json">
    <LipSync driver={driver} />
  </Live2DModel>
</Live2DCanvas>
```

`Live2DCanvasProps` contains the same backend/Core/quality controls plus
`pauseWhenOffscreen`, `className`, `style`, loading/error fallbacks and
`onError`.

`Live2DModelProps` provides `src`, `fit`, `followPointer`, `idleMotion`,
`paused`, `retries`, `onLoad`, `onError`, `onTap` and children. Only one model
is allowed per Canvas. `src` changes and StrictMode effect replays dispose the
old headless runtime generation; toggling `followPointer`/`paused`/`onTap`
never does.

`onLoad` receives the same React-only controller returned by
`useLive2DModel()`. It deliberately excludes renderer and lifecycle methods:

```ts
interface Live2DModelController {
  motion(group: string, index?: number, options?: MotionOptions): Promise<void>
  isMotionPlaying(): boolean
  expression(id?: string): Promise<void>
  clearExpression(): void
  getModelInfo(): ModelInfo
  focus(x: number, y: number): void
  getParameter(id: string): number
  setParameter(id: string, value: number): void
  clearParameter(id: string): void
}
```

There is no React ref API. Use `onLoad` when the controller must be handed to a
parent and `useLive2DModel()` from descendants. A controller is invalidated
when its model generation is disposed; later calls fail with `invalid-props`
instead of touching a released renderer handle.

`backend` is optional and follows the same default as `createLive2D()`.

## Lip sync

```ts
interface LipSyncDriver {
  getMouthOpen(): number
  isSpeaking(): boolean
}

interface VolumeLipSyncDriver {
  sample(rms: number, elapsedMs: number): void
  getMouthOpen(): number
  isSpeaking(): boolean
}

function createVolumeLipSync(): VolumeLipSyncDriver

type RuntimeLipSyncOptions =
  { parameterId?: string } & (
    | { driver: LipSyncDriver }
    | {
        source: AudioNode
        profile: string | URL | ArrayBuffer | LipSyncProfile
        isSpeaking: () => boolean
      }
  )
```

React `<LipSync>` accepts the same driver mode, `source + active + profile`,
or plain `mouthOpen + speaking` values when a stable driver reference is
inconvenient. Source mode dynamically imports wLipSync. The caller owns the
`AudioNode` and `AudioContext`; cleanup removes only the analysis edge and
node owned by this feature. `parameterId` retargets models that do not use
`ParamMouthOpenY`.

`createVolumeLipSync()` is a React-free helper for driver mode. The caller
samples non-negative RMS once per capture frame and passes the time since
capture started. The helper performs a fixed 1.5 second noise-floor
calibration, freezes the floor while speaking after calibration, and applies
attack/release smoothing plus on/off hysteresis. Invalid RMS becomes zero;
invalid or decreasing elapsed time never moves its internal clock backward.
It owns no `AudioNode`, microphone permission, `AudioContext`, analyser, timer
or browser global. The first API has no options or reset method.

Mouth values are clamped to 0–1. `ParamMouthOpenY`, a 200 ms smoothstep release
and a 500 ms closed-mouth hold are fixed in v0.1.

Lip-sync and parameter-driver writes are transient: each frame's value is
written after the SDK update and cleared immediately, so it never persists as a
manual override. When speech ends, the release/hold sequence finishes and
motion curves regain the mouth parameter automatically.

## Decisions on 2026-08-18 (defect round)

공개 전 감사에서 확인된 결함을 고치며 정해진 계약이다.

- **사용자 pause는 `retry()`를 넘어 유지된다**: `hidden`/`offscreen`은 관찰자가
  매 세대 다시 보고하지만 `user`는 pause 이유 집합 말고 진실 소스가 없다.
  React의 `paused` effect는 `retry()`로 재실행되지 않으므로, 버리면 컨텍스트
  복구 때마다 `paused`가 조용히 풀린다. 스테이지 생성 전에 요청된 pause도
  생성 직후 적용된다.
- **`motion()`은 렌더 에러 시 reject한다**: 렌더 에러 뒤에는 프레임 루프가
  다시 돌지 않아 재생이 끝날 수 없다. dispose 시에는 기존대로 resolve한다.
  이미 `void controller.motion(...)`을 catch 없이 쓰는 코드가 많고, pixi
  어댑터도 destroy 시 resolve하므로 두 backend를 같게 유지한다.
- **`ensureCubismCore()`는 페이지가 먼저 넣은 `<script>`를 채택하지 않는다**:
  `load`/`error`는 일회성이라 이미 발화한 엘리먼트에 리스너를 달면 promise가
  영원히 미결이 된다. 중복 제거는 `pendingLoads`가 담당한다. 30초 타임아웃과
  `AbortSignal`을 추가했고, 한 호출자의 abort는 공유 로드를 오염시키지 않는다.
- **pixi-v6 어댑터의 좌표계는 CSS 픽셀이다**: `toWorld`가 CSS 픽셀을 돌려주고
  `focus`/`hitTest`가 내부에서 PIXI global 공간으로 환산한다. 이전에는 계약대로
  CSS 픽셀을 넘기는 `instance.focus()`가 고DPI에서 어긋났다.
- **pixi-v6의 `setParameter`도 지속 오버라이드다**: 어댑터가 값을 기록해 매
  motion 업데이트 뒤 다시 적용한다. 다만 pixi 파이프라인에서 expression과
  physics/pose는 그 뒤에 실행되므로, 그 둘이 구동하는 파라미터에 대해서는 기본
  어댑터만큼의 우선순위를 보장하지 않는다.

## Decisions on 2026-08-18 (interaction round)

- **motion() resolves at playback end, not start**: sequencing ("say the next
  line when the motion ends") was impossible; the queue-entry handle the
  Framework already returns is now polled by the frame loop. Interruption also
  resolves. Priority ('idle'|'normal'|'force') is exposed; default stays force.
- **One coordinate system for users**: `focusAt`/`hitTest` take viewport
  client coordinates only. pixi-live2d-display exposes three coordinate
  spaces; we deliberately do not. Contract-level `focus`/`hitTest` use
  stage-local CSS pixels; the runtime converts.
- **Hit testing is AABB per hit-area drawable** (official sample semantics)
  via the inverse of the adapter's own MVP matrix; the vendor `isHit` is not
  used because this adapter does not populate `_modelMatrix`.
- **Metadata is one normalized shape** (`getModelInfo()`); unknown
  motion/expression errors list the available names.
- **followPointer/onTap/paused live outside CreateLive2DOptions in React** so
  toggling them never recreates the runtime.
- **useLive2DParameter now clears its override on unmount/id change** — the
  previous behavior left the parameter pinned forever (bug).
- **HTTP 4xx never retries**; retries are for transient failures only.

## Decisions on 2026-08-18

- **Transient feature writes + `clearParameter()`**: lip sync previously wrote
  through the persistent override path, which pinned `ParamMouthOpenY` at 0
  after speech and made the release crossfade read its own previous output
  instead of the motion value. Feature writes are now write-then-clear, and
  `clearParameter()` is public API. Rejected alternative: reordering feature
  callbacks before manual re-application, which would have inverted the
  documented override priority. Revisit if a feature ever needs a persistent
  override on purpose.
- **`pauseWhenOffscreen` default true**: rendering while scrolled out of view
  wastes GPU and battery in the primary chat-page use case. Opt out per
  instance for capture or measurement scenarios. Pause reasons are a set
  (user/hidden/offscreen); resume requires the set to be empty.
- **Idle motion prefetch**: after the model is ready, the Idle motion group is
  fetched in the background through the regular motion cache, removing the
  visible motionless gap after load. Failures are silent; playback surfaces
  real errors. Revisit the fixed group name when motion groups become
  configurable.

## React hooks

```ts
useLive2DCanvas(): {
  status: 'loading' | 'ready' | 'error'
  loadingStage?: 'core' | 'stage' | 'model'
  error?: Live2DError
  render?: {
    width: number
    height: number
    resolution: number
    bufferPixels: number
  }
  retry(): void
}

useLive2DModel(): Live2DModelController | null
useLive2DParameter(id: string, value: number): void
useParameterDriver(id: string, getter: () => number): void
useLive2D(options): { instance, state, error, retry }
```

`useLive2DParameter` is for discrete changes and clears its override on
unmount or id change. `useParameterDriver` reads the latest getter after SDK
motion update without causing React renders. `useLive2D` owns a vanilla
instance from React (StrictMode-safe) for apps that want the full
`Live2DInstance` instead of the declarative components.

## Errors

`Live2DError.code` is one of:

- `browser-only`
- `core-missing`
- `webgl-unsupported`
- `invalid-props`
- `invalid-tree`
- `lipsync-error`
- `model-load-failed`
- `render-error`
- `adapter-error`

The cubism-webgl backend uses `webgl-unsupported` when WebGL2 is unavailable.
It does not fall back to WebGL1 or Pixi.

`Live2DError.details` is a frozen, read-only diagnostic object. Depending on
the failure it contains `assetType`, `backend`, the final absolute `url` and
`httpStatus`. `cause` is preserved separately.

```ts
type Live2DAssetType =
  | 'core' | 'model3' | 'moc3' | 'texture' | 'physics' | 'pose'
  | 'user-data' | 'motion' | 'expression' | 'shader'

interface Live2DErrorDetails {
  readonly assetType?: Live2DAssetType
  readonly backend?: string
  readonly url?: string
  readonly httpStatus?: number
}
```

Browsers do not always expose an HTTP status for a failed cross-origin script
load. In that case Core errors still include the final URL and asset type.

## Next.js and SSR

The root, cubism-webgl and pixi entries are SSR-evaluation safe. The React
entry is a client entry. Framework, renderer and wLipSync runtime modules load
only in browser lifecycle code.
