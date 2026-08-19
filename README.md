# live2d-web

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

> A Live2D runtime for the modern web. Load a Cubism model, play motions,
> follow the pointer and lip sync, from vanilla JavaScript or React. No PixiJS.

An unofficial library for Live2D, not affiliated with Live2D Inc. Shipping an
app built with it may need its own
[Cubism SDK license](https://www.live2d.com/en/sdk/license/); details in
[licensing notes](docs/licensing.md).

**[Live demo](https://live2d-web-demo.netlify.app/)**: play motions, tap the
character, drive lip sync from your microphone, or load your own `model3.json`
in the [inspector](https://live2d-web-demo.netlify.app/inspect).

**Status: `0.1.0`, not yet published to npm.** The default backend runs the
official Cubism Web Framework 5-r.5 renderer directly on WebGL2.

```bash
npm install live2d-web
```

## Why this library

- There's no PixiJS underneath. The runtime talks to WebGL2 itself, which is
  how one character fits in about 58KB gzipped.
- Startup is fast. Shaders compile lazily and downloads overlap the compile
  work; on GPU hardware that cut time-to-first-frame by 4 to 6 times against
  the Pixi-based baseline, at
  [equal steady-state frame rates](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md).
- React support isn't a wrapper. The components and hooks drive the same
  controller as the vanilla API, and per-frame values never touch React state.
- It's built for Cubism 5.3 Core and the official Framework 5-r.5, loads
  Cubism 4 and 5 models alike, and makes a realistic replacement for the
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

The promise resolves once the character is on screen. Give the container a CSS
size and the canvas fills it; that's the whole layout contract.

## Motions and expressions

Start by asking the model what it ships:

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // random index within the group
await character.motion('Tap@Body', 1) // specific index
await character.motion('Idle', 0, { priority: 'normal' }) // do not interrupt

await character.expression('smile')
character.clearExpression()
```

A motion's promise resolves when playback is actually done, not when it
starts. So sequencing is just `await` one, then start the next. If something
interrupts the motion, the promise resolves at that moment instead of hanging.

Idle playback runs on its own from the model's `Idle` group; use `idleMotion`
to pick a different group, or `false` to turn it off. Priorities are
`'idle' | 'normal' | 'force'`, and the default `'force'` interrupts whatever
is playing. Ask for a group or expression the model doesn't have and the error
lists the valid names, which saves a round trip to the model file.

## Pointer tracking and taps

Set `followPointer: true` and the character watches the pointer while it's
over the canvas, then looks back to the centre when it leaves. Tap handling is
a hit test away:

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

For manual gaze control there are two methods: `focusAt()` takes viewport
client coordinates, `focus()` takes container-local CSS pixels.

The React wiring is two props. Toggling them never reloads the model:

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

There are three ways to drive the mouth, because the right one depends on
where your audio lives. All of them write after the SDK's own motion update,
so a motion curve can't overwrite the value.

If you have a WebAudio node (TTS output, a microphone), let wLipSync analyse
the vowels; the analyser is loaded on demand:

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // your WebAudio node, e.g. TTS output
  profile: '/lipsync/profile.bin', // wLipSync calibration profile
  isSpeaking: () => isPlaying,
})
```

If you'd rather compute mouth openness yourself, hand over any logic that
yields a value between 0 and 1:

```ts
character.addLipSync({
  driver: {
    getMouthOpen: () => currentVolume,
    isSpeaking: () => currentVolume > 0,
  },
})
```

And in React, plain values work too, which is the simplest option when the
number already lives in state:

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

The target parameter defaults to `ParamMouthOpenY`; change it with
`parameterId`. The library never closes or suspends your `AudioContext`, and
no calibration profile is bundled.

## Direct parameter control

Sometimes you want a parameter held at a value no matter what the current
motion says. That's `setParameter()`: it wins over motion curves every frame
until `clearParameter()` releases it. For values you recompute per frame,
register a driver instead and the library polls it after each SDK update.

```ts
character.setParameter('ParamMouthOpenY', 0.6) // hold the mouth open
character.clearParameter('ParamMouthOpenY') // motions take over again

const stop = character.addParameterDriver('ParamAngleX', {
  getValue: () => Math.sin(performance.now() / 300) * 30,
})
```

The React equivalents are `useLive2DParameter(id, value)` for the override
(it cleans up after itself on unmount) and `useParameterDriver(id, getter)`
for the per-frame driver.

## Fitting, quality and performance

`fit` frames the model without touching the model file: `'upper-body'`
(default), `'full'`, or a custom `{ scale, offsetX, offsetY }`. Change it at
runtime with `setFit()`.

Rendering quality takes care of itself by default. The backing buffer follows
`devicePixelRatio` up to a cap (1.5MP on mobile, 4MP on desktop) and steps
down when frames run long; for most apps that's the right trade and you never
think about it again. If you'd rather pin it, pass a fixed `resolution`, and
use `maxFps` to cap the frame rate. Hidden tabs pause automatically, as do
canvases scrolled out of view.

```ts
const character = await createLive2D({
  // ...
  fit: 'full',
  maxFps: 30,
  pauseWhenOffscreen: false, // keep rendering for capture scenarios
})
```

## State, errors and cleanup

`getState()` returns `{ status, loadingStage, error, render }`, and
`subscribe()` notifies on every change. Each error carries a stable `code`
(`'core-missing'`, `'model-load-failed'`, `'render-error'`, ...) plus details
about the asset involved.

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

A few behaviours worth knowing: HTTP 4xx fails immediately, while transient
failures retry twice by default. After a render error such as WebGL context
loss, `retry()` rebuilds the whole stage. And loading can be aborted with a
standard `AbortSignal` passed as `signal`.

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

Leave `backend` out and you get the default Framework-on-WebGL2 backend.
There's also a Pixi v6 backend, kept for A/B comparison and for migrating from
`pixi-live2d-display`; its Pixi packages are optional peers, so nothing
Pixi-related is installed unless you actually use it.

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/backends/cubism-webgl'
import { pixiV6 } from 'live2d-web/backends/pixi-v6'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

## Troubleshooting

- Nothing visible but the status says ready: the container has no CSS size, so
  the canvas collapsed to 1x1. Give the container a width and height. The
  runtime prints a console warning when this happens.
- The model 404s: the model directory has to be served as static files, and
  every sibling asset loads relative to the model3.json URL. HTTP 4xx fails
  fast without retries.
- Several characters feel slow: each canvas owns a WebGL context and a render
  loop, and browsers cap contexts at around 8-16. Fewer canvases is the fix.
- The page scrolls while dragging the character on mobile: the canvas sets
  `touch-action: none`, but a scrolling ancestor may need it too.

## Development

Node 24 and pnpm are required.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets   # downloads Core + sample models after you review the linked terms
pnpm dev

pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm verify:package
```

Downloaded assets stay in gitignored development paths and are never packaged.
The playground serves a React demo at `/`, the vanilla API at `/vanilla`, a
model inspector at `/inspect` and a WebGL/Pixi comparison at `/compare`.
Benchmark suites are documented in the [benchmark guide](docs/benchmarking.md).

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
