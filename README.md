# live2d-web

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

> A Live2D runtime for the modern web. Load a Cubism model, play motions,
> follow the pointer and lip sync, from vanilla JavaScript or React. No PixiJS.

An unofficial library for Live2D, not affiliated with Live2D Inc. Shipping an
app built with it may need its own
[Cubism SDK license](https://www.live2d.com/en/sdk/license/); details in
[licensing notes](docs/licensing.md).

Live demo: coming with the first public release.

**Status: `0.1.0`, not yet published to npm.** The default backend runs the
official Cubism Web Framework 5-r.5 renderer directly on WebGL2.

```bash
npm install live2d-web
```

## Why this library

- **No rendering framework required.** The runtime talks to WebGL2 directly.
  A production build with one character is about 58KB gzipped, and none of it
  is PixiJS.
- **Fast startup.** Shader compilation is lazy, and asset loading overlaps
  shader work. On GPU hardware this cut time-to-first-frame by 4 to 6 times
  against the Pixi-based baseline, with
  [equal steady-state frame rates](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md).
- **First-class React bindings.** Components and hooks share one headless
  controller with the vanilla API. Per-frame values never pass through React
  state.
- **Current Cubism.** Built for Cubism 5.3 Core and the official Framework
  5-r.5, so Cubism 4 and 5 models both load. A drop-in path away from the
  unmaintained `pixi-live2d-display`.

## What you need

Two files, neither bundled with the package:

1. **Cubism Core** (`live2dcubismcore.min.js`), Live2D's closed-source engine.
   Download the official Web SDK from https://www.live2d.com/sdk/download/web/,
   serve the file yourself and pass its URL as `coreUrl`. For a quick trial the
   `OFFICIAL_CUBISM_CORE_URL` constant points at Live2D's hosted copy;
   self-host for production.
2. **A model directory.** A `model3.json` references its `.moc3`, textures,
   motions and physics by relative path, so serve the whole directory as static
   files (for example under `public/models/hiyori/`) and pass the
   `model3.json` URL as `src`.

## Quick start

Vanilla:

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL,
  src: '/models/hiyori/hiyori.model3.json',
  fit: 'upper-body',
  followPointer: true,
})
```

React:

```tsx
'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Character() {
  return (
    <Live2DCanvas coreUrl="/assets/live2dcubismcore.min.js">
      <Live2DModel src="/models/hiyori/hiyori.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

The promise from `createLive2D()` resolves once the character is on screen.
Give the container a CSS size; the canvas fills it.

## Motions and expressions

`motion()` resolves when playback actually finishes, including when another
motion interrupts it, so sequencing works with plain `await`. Idle playback
runs automatically from the model's `Idle` group; pick another group with
`idleMotion`, or pass `false` to disable it.

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // random index within the group
await character.motion('Tap@Body', 1) // specific index
await character.motion('Idle', 0, { priority: 'normal' }) // do not interrupt

await character.expression('smile')
character.clearExpression()
```

Priorities are `'idle' | 'normal' | 'force'` (default `'force'`, which
interrupts anything). Unknown group or expression names reject with an error
that lists the available names.

## Pointer tracking and taps

`followPointer: true` makes the character look at the pointer while it is over
the canvas and look back to the centre when it leaves. For manual control,
`focusAt()` takes viewport client coordinates and `focus()` takes
container-local CSS pixels. `hitTest()` returns the model's hit-area names
under a client point.

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

In React the same wiring is two props, and toggling them never reloads the
model:

```tsx
<Live2DModel
  src="/models/hiyori/hiyori.model3.json"
  followPointer
  onTap={(areas) => {
    if (areas.includes('Body'))
      controller?.motion('Tap@Body')
  }}
/>
```

## Lip sync

Three ways to drive the mouth, all writing after the SDK's own motion update
so motion curves cannot overwrite the value.

**From an audio node** (vowel analysis via wLipSync, loaded on demand):

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // your WebAudio node, e.g. TTS output
  profile: '/lipsync/profile.bin', // wLipSync calibration profile
  isSpeaking: () => isPlaying,
})
```

**From your own analyser** (any logic that yields mouth openness 0 to 1):

```ts
character.addLipSync({
  driver: {
    getMouthOpen: () => currentVolume,
    isSpeaking: () => currentVolume > 0,
  },
})
```

**From plain values, React only** (simplest when state already exists):

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

The target parameter defaults to `ParamMouthOpenY` and can be changed with
`parameterId`. The library never closes or suspends your `AudioContext`, and
no calibration profile is bundled.

## Direct parameter control

`setParameter()` is a persistent override: it wins over motion curves every
frame until `clearParameter()` releases it. For values you compute per frame,
register a driver instead and the library polls it after each SDK update.

```ts
character.setParameter('ParamMouthOpenY', 0.6) // hold the mouth open
character.clearParameter('ParamMouthOpenY') // motions take over again

const stop = character.addParameterDriver('ParamAngleX', {
  getValue: () => Math.sin(performance.now() / 300) * 30,
})
```

React equivalents: `useLive2DParameter(id, value)` for the override (it cleans
itself up on unmount) and `useParameterDriver(id, getter)` for the per-frame
driver.

## Fitting, quality and performance

`fit` frames the model without touching the model file: `'upper-body'`
(default), `'full'`, or a custom `{ scale, offsetX, offsetY }`. Change it at
runtime with `setFit()`.

Rendering quality is automatic by default: the backing buffer follows
`devicePixelRatio` but is capped (1.5MP on mobile, 4MP on desktop) and steps
down if frames run long. Pass a fixed `resolution` to opt out, and `maxFps` to
cap the frame rate. Rendering pauses automatically in hidden tabs and, unless
`pauseWhenOffscreen: false`, while the canvas is scrolled out of view.

```ts
const character = await createLive2D({
  // ...
  fit: 'full',
  maxFps: 30,
  pauseWhenOffscreen: false, // keep rendering for capture scenarios
})
```

## State, errors and cleanup

`getState()` returns `{ status, loadingStage, error, render }` and
`subscribe()` notifies on every change. Errors carry a stable `code`
(`'core-missing'`, `'model-load-failed'`, `'render-error'`, ...) plus asset
details. HTTP 4xx fails fast without retries; transient failures retry twice
by default (`retries`). After a render error such as WebGL context loss,
`retry()` rebuilds the whole stage.

```ts
const character = await createLive2D({
  // ...
  onError: error => console.warn(error.code, error.message),
})

const unsubscribe = character.subscribe(() => {
  console.log(character.getState().status) // 'loading' | 'ready' | 'error'
})

character.pause() // e.g. while a modal is open
character.resume()
character.dispose() // releases model, canvas and GL context; safe to call twice
```

Aborting is supported through a standard `AbortSignal` passed as `signal`.

## React at a glance

Everything lives in `live2d-web/react`; React is an optional peer dependency
(18.2 and 19 supported), and the root import stays React-free.

| `<Live2DCanvas>` prop                  | Purpose                                                       |
| -------------------------------------- | ------------------------------------------------------------- |
| `coreUrl`                              | Cubism Core script URL (omit if the script is already loaded) |
| `quality` / `resolution`               | Automatic quality (default) or a fixed backing-buffer scale   |
| `maxFps`, `pauseWhenOffscreen`         | Frame cap and offscreen pausing                               |
| `backend`                              | Renderer backend; keep the value stable across renders        |
| `fallback`, `errorFallback`, `onError` | Loading UI, error UI with retry, error callback               |

| `<Live2DModel>` prop                  | Purpose                                                    |
| ------------------------------------- | ---------------------------------------------------------- |
| `src`, `fit`, `idleMotion`, `retries` | Model URL and load-time options                            |
| `followPointer`, `paused`, `onTap`    | Interaction toggles; changing them never reloads the model |
| `onLoad`, `onError`                   | Controller delivery and error callback                     |

| Hook                             | Purpose                                                                                   |
| -------------------------------- | ----------------------------------------------------------------------------------------- |
| `useLive2DModel()`               | The same controller `onLoad` delivers (motion, expression, focus, parameters, model info) |
| `useLive2DCanvas()`              | Stage state: `status`, `loadingStage`, `error`, render info                               |
| `useLive2DParameter(id, value)`  | Declarative parameter override with automatic cleanup                                     |
| `useParameterDriver(id, getter)` | Per-frame parameter driver                                                                |
| `useLive2D(options)`             | The vanilla instance under React ownership (StrictMode-safe)                              |

`<LipSync>` accepts exactly one of its three modes: `driver`,
`source`/`active`/`profile`, or `mouthOpen`/`speaking`.

## Swapping backends

Omitting `backend` loads the default Framework-on-WebGL2 adapter. A Pixi v6
adapter exists for A/B comparison and migration from `pixi-live2d-display`;
its Pixi packages are optional peers and are never pulled in otherwise.

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/adapters/cubism-webgl'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

## Troubleshooting

- **Nothing visible, status is ready**: the container has no CSS size; the
  canvas collapsed to 1x1 (a console warning is printed). Give the container a
  width and height.
- **Model 404s**: the model directory must be served as static files; all
  sibling assets load relative to the model3.json URL. HTTP 4xx fails fast
  without retries.
- **Several characters feel slow**: each canvas owns a WebGL context and its
  own render loop; browsers cap contexts around 8-16. Prefer a few canvases.
- **Mobile scrolls while dragging the character**: the canvas sets
  `touch-action: none`, but a scrolling ancestor may still need it.

## Development

Node 24 and pnpm are required.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets   # downloads Core + sample models after you review the linked terms
pnpm dev

pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm verify:package
```

Downloaded assets live only in gitignored development paths and are never
packaged. The playground serves a React demo at `/`, the vanilla API at
`/vanilla`, a model inspector at `/inspect` and a WebGL/Pixi comparison at
`/compare`. Benchmark suites are documented in the
[benchmark guide](docs/benchmarking.md).

## Documentation

Start from the [documentation map](docs/README.md). Highlights:

- [API reference](docs/api-design.md)
- [Architecture](docs/architecture.md)
- [Licensing](docs/licensing.md)
- [Benchmark guide](docs/benchmarking.md),
  [WebGL vs Pixi v6 results](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)
  and [startup cost on GPU hardware](docs/benchmarks/2026-08-18-hardware-matrix.md)

## License and trademark

The original project source is MIT licensed. The bundled Cubism Web Framework
and shaders remain under Live2D's license. Package license details and modified
Framework files are recorded in [LICENSES.md](packages/live2d-web/LICENSES.md)
and [THIRD_PARTY_NOTICES.md](packages/live2d-web/THIRD_PARTY_NOTICES.md).

This is an unofficial third-party project. It is not developed, provided or
endorsed by Live2D Inc., and it is not one of their official products. Live2D
and Cubism are trademarks of Live2D Inc. `live2d-web` does not bundle Cubism
Core, sample models or a lip-sync profile.

An application you build with this library may need its own Live2D Cubism SDK
publishing license, depending on what it is and on the size of the business
releasing it. See
[Live2D's SDK license terms](https://www.live2d.com/en/sdk/license/) and the
[licensing notes](docs/licensing.md).
