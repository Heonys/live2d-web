# live2d-web

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

> A Live2D runtime for the modern web. Load a Cubism model, play motions,
> follow the pointer and lip sync, from vanilla JavaScript or React. No PixiJS.

An unofficial library for Live2D, not affiliated with Live2D Inc. Shipping an
app built with it may need its own
[Cubism SDK license](https://www.live2d.com/en/sdk/license/); details in
[licensing notes](docs/licensing.md).

**[Live demo](https://live2d-web-demo.netlify.app/)** ·
[Model inspector](https://live2d-web-demo.netlify.app/inspect)

## Features

- Lightweight. No rendering framework underneath; the runtime draws through
  WebGL2 directly, at about 58KB gzipped for one character.
- Characters appear fast: 4 to 6 times quicker to the first frame on GPU
  hardware ([measurements](docs/benchmarks/2026-08-18-hardware-matrix.md)),
  with [frame rates equal to
  pixi-live2d-display](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md).
- React works out of the box, with components and hooks over the same API as
  vanilla JavaScript.
- Built for the current Cubism 5.3, so Cubism 4 and 5 models both load. A
  replacement for the unmaintained `pixi-live2d-display`.

## Getting started

```bash
npm install live2d-web
```

Two files are required that the package does not bundle:

1. **Cubism Core** (`live2dcubismcore.min.js`), Live2D's closed-source engine.
   Download the official Web SDK from https://www.live2d.com/sdk/download/web/,
   serve the file yourself and pass its URL as `coreUrl`. For a quick trial the
   `OFFICIAL_CUBISM_CORE_URL` constant points at Live2D's hosted copy;
   self-host for production.
2. **A model directory.** A `model3.json` references its `.moc3`, textures,
   motions and physics by relative path, so serve the whole directory as static
   files (for example under `public/models/hiyori/`) and pass the
   `model3.json` URL as `src`.

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

The promise resolves once the character is on screen. Give the container a
CSS size and the canvas fills it.

## Motions and expressions

`getModelInfo()` lists the model's motion groups, expressions and hit areas.

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // random index within the group
await character.motion('Tap@Body', 1) // specific index
await character.motion('Idle', 0, { priority: 'normal' }) // do not interrupt

await character.expression('smile')
character.clearExpression()
```

`motion()` resolves when playback finishes, so sequencing works with plain
`await`. If another motion interrupts, the promise resolves at that point;
after a render error such as WebGL context loss it rejects instead.

Idle playback runs automatically from the model's `Idle` group; use
`idleMotion` to pick a different group, or `false` to turn it off. Priorities
are `'idle' | 'normal' | 'force'`, and the default `'force'` interrupts the
current motion. Unknown group or expression names reject with an error listing
the valid names.

## Pointer tracking and taps

With `followPointer: true` the character watches the pointer while it is
over the canvas and returns its gaze to the centre when it leaves.

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

Two methods control the gaze directly: `focusAt()` takes viewport client
coordinates, `focus()` takes container-local CSS pixels.

In React the same wiring is two props. Toggling them never reloads the model:

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

Lip sync supports three modes. All of them write after the SDK's motion
update, so motion curves cannot overwrite the value.

From a WebAudio node (TTS output, a microphone), analysed by wLipSync; the
analyser is loaded on demand:

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // your WebAudio node, e.g. TTS output
  profile: '/lipsync/profile.bin', // wLipSync calibration profile
  isSpeaking: () => isPlaying,
})
```

From your own logic, as a mouth-openness value between 0 and 1:

```ts
character.addLipSync({
  driver: {
    getMouthOpen: () => currentVolume,
    isSpeaking: () => currentVolume > 0,
  },
})
```

From plain values, React only:

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

The target parameter defaults to `ParamMouthOpenY`; change it with
`parameterId`. The library never closes or suspends your `AudioContext`, and
no calibration profile is bundled.

## Direct parameter control

`setParameter()` is a persistent override: it wins over motion curves every
frame until `clearParameter()` releases it. For values recomputed per frame,
register a driver instead; the library polls it after each SDK update.

```ts
character.setParameter('ParamMouthOpenY', 0.6) // hold the mouth open
character.clearParameter('ParamMouthOpenY') // motions take over again

const stop = character.addParameterDriver('ParamAngleX', {
  getValue: () => Math.sin(performance.now() / 300) * 30,
})
```

In React, `useLive2DParameter(id, value)` is the override (cleaned up on
unmount) and `useParameterDriver(id, getter)` is the per-frame driver.

## Framing and render quality

`fit` frames the model without touching the model file: `'upper-body'`
(default), `'full'`, or a custom `{ scale, offsetX, offsetY }`. Change it at
runtime with `setFit()`.

Rendering quality is automatic by default. The backing buffer follows
`devicePixelRatio` up to a cap (1.5MP on mobile, 4MP on desktop) and steps
down when frames run long. Pass a fixed `resolution` to pin it, and `maxFps`
to cap the frame rate. Hidden tabs and canvases scrolled out of view pause
automatically.

```ts
const character = await createLive2D({
  // ...
  fit: 'full',
  maxFps: 30,
  pauseWhenOffscreen: false, // keep rendering for capture scenarios
})
```

## Lifecycle and error handling

`getState()` returns `{ status, loadingStage, error, render }`, and
`subscribe()` notifies on every change. Errors carry a stable `code`
(`'core-missing'`, `'model-load-failed'`, `'render-error'`, ...) and details
about the asset involved.

```ts
const character = await createLive2D({
  // ...
  onError: error => console.warn(error.code, error.message),
})

const unsubscribe = character.subscribe(() => {
  console.log(character.getState().status) // 'loading' | 'ready' | 'error' | 'disposed'
})

character.pause() // e.g. while a modal is open
character.resume()
character.dispose() // releases model, canvas and GL context; safe to call twice
```

HTTP 4xx fails immediately; transient failures retry twice by default
(`retries`). After a render error such as WebGL context loss, `retry()`
rebuilds the stage. Loading can be aborted with an `AbortSignal` passed as
`signal`.

## React API summary

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
| `resolveAsset`                        | Supplies the model's files instead of fetching them        |
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

## Backends

Omitting `backend` loads the default Framework-on-WebGL2 backend, which is
the only backend the package ships. Pass one explicitly to host the shaders
yourself.

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/backends/cubism-webgl'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

A Pixi v6 backend lives in the repository as the counterpart for the
benchmarks above, but it is not published: it would pull Pixi into the
dependency graph of every install for a path almost nobody takes. The
`Backend` interface is public, so a Pixi backend can be written against it
outside this package.

## Model sources

By default `src` is a URL and the model's own files load relative to it. When
the model is not on a server, for instance an archive the user just picked,
pass `resolveAsset` and `src` becomes a path inside that source instead.

```tsx
// filled from an archive, storage, ...
const files = new Map<string, Blob>()

export function Character() {
  return (
    <Live2DModel
      src="hiyori/hiyori.model3.json"
      resolveAsset={path => files.get(path)}
    />
  )
}
```

The resolver is asked for each file the model declares, with the path already
resolved relative to `src` (nested directories, `./` and `../` included) and
decoded, so names written in Korean, Japanese or Chinese arrive as themselves.
Return `undefined` and the load fails naming that path. Absolute URLs inside a
model3.json are still fetched.

Spaces and literal `%`, `#` and `?` in filenames are preserved too. If you open
untrusted local archives, validate model3.json before rendering when network
access is not desired: absolute URLs intentionally bypass the resolver and use
`fetch`.

Unpacking an archive is left to you: keeping the resolver a plain function is
what lets this package stay free of an archive dependency. In React, keep the
function stable with `useCallback` or a module constant, since a new identity
reloads the model.

## Troubleshooting

- Nothing visible but the status is ready: the container has no CSS size, so
  the canvas collapsed to 1x1. Give the container a width and height. A
  console warning is printed in this case.
- The model 404s: the model directory must be served as static files; every
  sibling asset loads relative to the model3.json URL.
- Several characters feel slow: each canvas owns a WebGL context and a render
  loop, and browsers cap contexts at around 8-16. Reduce the canvas count.
- The page scrolls while dragging on mobile: the canvas sets
  `touch-action: none`, but a scrolling ancestor may need it too.

The local release gate covers current Chromium, Firefox and WebKit. OBS is a
separate embedded Chromium environment; the current downstream compatibility
target is OBS 31+, validated manually rather than inferred from desktop Chrome.
The driver/value lip-sync API works across that matrix. The optional wLipSync
AudioWorklet source mode is currently gated to Chromium/WebKit because
wlipsync 1.3 throws from its worklet in Firefox.

## Development

Node 24 and pnpm are required.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets   # downloads Core + sample models after you review the linked terms
pnpm dev

pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm verify:package
pnpm verify:packed-consumers             # installs the exact tarball in three apps
LIVE2D_SOAK_MINUTES=120 pnpm test:soak   # optional local long-session gate
```

Downloaded assets stay in gitignored development paths and are never
packaged. The playground serves a React demo at `/`, the vanilla API at
`/vanilla`, a model inspector at `/inspect` and a WebGL/Pixi comparison at
`/compare`. Benchmarks are documented in the
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
