# API Reference

Status: implemented locally on 2026-08-15. The package is ESM-only and remains
`0.1.0-alpha.0` until publication. The root entry has no React dependency;
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
  maxFps?: number
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
  motion(group: string, index?: number): Promise<void>
  expression(id?: string): Promise<void>
  focus(x: number, y: number): void
  getParameter(id: string): number
  setParameter(id: string, value: number): void
  setFit(fit: ModelFit): void
  addParameterDriver(id: string, driver: ParameterDriver): () => void
  addLipSync(options: RuntimeLipSyncOptions): () => void
  pause(): void
  resume(): void
  retry(): Promise<void>
  dispose(): void
}
```

The promise resolves after Core, Stage and model setup. An initial failure
rejects and disposes partial resources. Runtime errors after readiness update
the subscribed state and call `onError`. `retry()` recreates the whole Stage.

Omitting `backend` loads Cubism Core first and then dynamically imports the
default `cubism-webgl` adapter. WebGL2 absence reports `webgl-unsupported`; the
runtime never falls back to Pixi or WebGL1.

Explicit selection is available from the adapter subpaths:

```ts
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/adapters/cubism-webgl'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'
```

`createCubismWebGLBackend({ shaderBaseUrl })` is only needed to serve shaders
from a custom URL. `pixiV6` requires the optional Pixi peer dependencies.

`addParameterDriver()` and `addLipSync()` return idempotent cleanup functions.
Registered features survive `retry()` and attach to the new model generation.

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
`className`, `style`, loading/error fallbacks and `onError`.

`Live2DModelProps` provides `src`, `fit`, `retries`, `onLoad`, `onError` and
children. Only one model is allowed per Canvas. `src` changes and StrictMode
effect replays dispose the old headless runtime generation.

`onLoad` receives the same React-only controller returned by
`useLive2DModel()`. It deliberately excludes renderer and lifecycle methods:

```ts
interface Live2DModelController {
  motion(group: string, index?: number): Promise<void>
  expression(id?: string): Promise<void>
  focus(x: number, y: number): void
  getParameter(id: string): number
  setParameter(id: string, value: number): void
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

type RuntimeLipSyncOptions =
  | { driver: LipSyncDriver }
  | {
      source: AudioNode
      profile: string | URL | ArrayBuffer | LipSyncProfile
      isSpeaking: () => boolean
    }
```

React `<LipSync>` accepts the same driver mode, or
`source + active + profile`. Source mode dynamically imports wLipSync. The
caller owns the `AudioNode` and `AudioContext`; cleanup removes only the
analysis edge and node owned by this feature.

Mouth values are clamped to 0–1. `ParamMouthOpenY`, a 200 ms smoothstep release
and a 500 ms closed-mouth hold are fixed for this alpha.

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
```

`useLive2DParameter` is for discrete changes. `useParameterDriver` reads the
latest getter after SDK motion update without causing React renders.

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
