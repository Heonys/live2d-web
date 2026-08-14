# API Reference

Status: implemented locally on 2026-08-14. The package is ESM-only and remains
`0.1.0-alpha.0` until publication. The root entry has no React dependency;
React 18.2 and React 19 are supported through `live2d-web/react`.

## Vanilla API

```ts
import { createLive2D } from 'live2d-web'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'

const character = await createLive2D({
  backend: pixiV6,
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

`backend` is typed as optional for the future default cubism-webgl adapter.
While that adapter is blocked by the redistribution gate, omitting `backend`
throws `adapter-error`; pass `pixiV6` for local and compatibility use.

`addParameterDriver()` and `addLipSync()` return idempotent cleanup functions.
Registered features survive `retry()` and attach to the new model generation.

## React components

```tsx
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'
import { LipSync, Live2DModel, Live2DStage } from 'live2d-web/react'

<Live2DStage backend={pixiV6} coreUrl="/live2dcubismcore.min.js">
  <Live2DModel src="/models/hiyori.model3.json">
    <LipSync driver={driver} />
  </Live2DModel>
</Live2DStage>
```

`Live2DStageProps` contains the same backend/Core/quality controls plus
`className`, `style`, loading/error fallbacks and `onError`.

`Live2DModelProps` provides `src`, `fit`, `retries`, `onLoad`, `onError` and
children. Only one model is allowed per Stage. `src` changes and StrictMode
effect replays dispose the old headless runtime generation.

The React binding currently keeps `backend` required so a configuration cannot
silently select a backend that is not legally publishable yet. It becomes
optional when cubism-webgl passes the public gate.

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
useStage(): {
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

useLive2DModel(): ModelHandle | null
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

The reserved cubism-webgl backend will use `webgl-unsupported` when WebGL2 is
unavailable; it will not fall back to WebGL1.

## Next.js and SSR

The root and pixi adapter entries are SSR-evaluation safe. The React entry is a
client entry, and renderer/wLipSync runtime modules load only in browser
lifecycle code.
