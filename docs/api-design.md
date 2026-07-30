# API Reference

Status: `0.1.0-alpha.0`, implemented on 2026-07-30. The package is ESM-only
and supports React 18.2 and React 19.

## Components

### `Live2DStage`

```ts
type StageQualityProps =
  | { quality?: 'auto' | AutoQualityPolicy; resolution?: never }
  | { quality?: never; resolution: number }

type Live2DStageProps = StageQualityProps & {
  backend: Live2DBackend
  coreUrl?: string
  maxFps?: number
  className?: string
  style?: CSSProperties
  fallback?: (stage: 'core' | 'stage' | 'model') => ReactNode
  errorFallback?: (error: Live2DError, retry: () => void) => ReactNode
  onError?: (error: Live2DError) => void
  children?: ReactNode
}
```

`coreUrl` points to a user-hosted `live2dcubismcore.min.js`. Concurrent Core
loads for the same absolute URL are deduplicated. If the global already exists,
no script is added.

Automatic quality is the default. It selects an initial resolution from device
DPR, a device cap and a backing-buffer pixel budget. Every three seconds it
lowers resolution by 0.25 when more than 5% of frames exceed 33 ms. Resolution
never rises during the same stage lifetime.

### `Live2DModel`

```ts
interface Live2DModelProps {
  src: string
  fit?: 'upper-body' | 'full' | {
    scale: number
    offsetX?: number
    offsetY?: number
  }
  retries?: number
  onLoad?: (model: ModelHandle) => void
  onError?: (error: Live2DError) => void
  children?: ReactNode
}
```

Only one model is allowed per stage in v0.1. Model loads use the initial
attempt plus two retries at 250 ms and 500 ms by default. Unmount, retry and
`src` changes abort the active generation; a backend result that resolves late
is disposed immediately.

## Hooks

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

`useLive2DParameter` is for discrete changes. `useParameterDriver` keeps the
latest getter in a ref and reads it after every SDK motion update without
causing React renders.

## Errors

`Live2DError.code` is one of `browser-only`, `core-missing`, `invalid-props`,
`invalid-tree`, `model-load-failed`, `render-error`, or `adapter-error`.

A render or WebGL context-loss error stops the ticker. `retry()` recreates the
whole stage rather than attempting to reuse uncertain GPU state.

## Next.js

The root and adapter imports are SSR-evaluation safe. Stage creation and the
dynamic `pixi-live2d-display` import happen in browser effects.

```tsx
'use client'

import { Live2DModel, Live2DStage } from 'live2d-jsx'
import { pixiV6 } from 'live2d-jsx/adapters/pixi-v6'
```
