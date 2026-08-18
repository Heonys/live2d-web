# live2d-web

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

> Put a Live2D character on the web with one call. No PixiJS, no globals,
> React optional.

An unofficial library for Live2D, not affiliated with Live2D Inc. Shipping an
app built with it may need its own
[Cubism SDK license](https://www.live2d.com/en/sdk/license/); details in
[licensing notes](docs/licensing.md).

`live2d-web` owns Live2D model loading, lifecycle, fitting, interaction
(tap hit testing, pointer tracking), lip sync, parameter drivers, render
quality, retry and cleanup. Rendering stays behind a backend contract, so the
same runtime can be used directly from JavaScript or through React.

Live demo: coming with the first public release.

**Status: `0.1.0` is implemented and validated locally, but has not been
published to npm yet.** The default backend uses the official Cubism Web
Framework 5-r.5 renderer directly on WebGL2. PixiJS v6 remains available only
as an explicit compatibility and performance-comparison backend. Public
repository and npm release are separate release gates.

## Getting started

```bash
npm install live2d-web   # published after the public-release gates pass
```

Two files make a character:

1. **Cubism Core** (`live2dcubismcore.min.js`) — Live2D's closed-source engine,
   deliberately not bundled. Download the official Web SDK from
   https://www.live2d.com/sdk/download/web/, copy the file into your static
   assets and pass its URL as `coreUrl`. To try things quickly you can pass the
   `OFFICIAL_CUBISM_CORE_URL` constant (Live2D's hosted copy); self-host for
   production.
2. **A model directory** — `model3.json` references its `.moc3`, textures,
   motions and physics by relative path, so serve the whole model directory
   (for example under `public/models/hiyori/`) and point `src` at the
   `model3.json`.

## Vanilla API

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL,
  fit: 'upper-body',
  followPointer: true,
  quality: 'auto',
  src: '/models/hiyori/hiyori.model3.json',
})

// Interaction: hit-test taps, sequence motions, discover what the model has.
container.addEventListener('click', async (event) => {
  if (character.hitTest(event.clientX, event.clientY).includes('Body'))
    await character.motion('Tap@Body') // resolves when playback finishes
})
console.log(character.getModelInfo()) // { motions, expressions, hitAreas }

character.setParameter('ParamMouthOpenY', 0.5)
character.clearParameter('ParamMouthOpenY')
character.pause()
character.resume()
character.dispose()
```

`createLive2D()` resolves only after Core, Stage and the model are ready. It
also exposes `expression`/`clearExpression`, `focus`/`focusAt`,
`isMotionPlaying`, `setFit`, `retry`, `addParameterDriver`, `addLipSync`,
state subscription and idempotent cleanup. Motion playback accepts a
`priority` ('idle' | 'normal' | 'force') and the idle group is configurable
via `idleMotion` (or `false` to disable idle playback).

## React API

```tsx
'use client'

import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Character({ voice }: { voice: AudioNode | null }) {
  return (
    <Live2DCanvas
      // Self-hosted Core file; OFFICIAL_CUBISM_CORE_URL also works here.
      coreUrl="/assets/live2dcubismcore.min.js"
      quality="auto"
    >
      <Live2DModel src="/models/hiyori.model3.json" fit="upper-body">
        <LipSync
          source={voice}
          active={voice !== null}
          profile="/lipsync/profile.bin"
        />
      </Live2DModel>
    </Live2DCanvas>
  )
}
```

The React components create and subscribe to the same headless controller used
by the vanilla API. `Live2DModel.onLoad` and `useLive2DModel()` return the same
safe React controller with motion, expression, focus, parameter and model-info
methods. Per-frame values never pass through React state.

`<Live2DModel>` also accepts `followPointer`, `paused` and
`onTap={(hitAreas, event) => ...}` — toggling them never reloads the model.
`<LipSync>` additionally accepts plain `mouthOpen`/`speaking` values when a
stable driver object is inconvenient. For React apps that want the vanilla
instance directly, `useLive2D({ container, src, ... })` owns the full
lifecycle (StrictMode-safe) and returns `{ instance, state, error, retry }`.

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

## Backend selection

Omitting `backend` selects the Framework-based WebGL2 backend. It never falls
back to Pixi or WebGL1.

```ts
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/adapters/cubism-webgl'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'

// Reusable default WebGL backend instance.
const defaultBackend = cubismWebGL

// Only needed when shaders must be served from an application-owned URL.
const customWebGL = createCubismWebGLBackend({
  shaderBaseUrl: '/live2d-shaders/',
})

// Compatibility/A-B path; requires the optional Pixi peer dependencies.
const compatibilityBackend = pixiV6
```

Cubism Core 5.3 is deliberately not bundled. Supply its official browser file
with `coreUrl`, or load it before creating a model and omit `coreUrl`.

## Package boundaries

- `live2d-web`: React-free vanilla runtime and renderer-neutral contracts.
- `live2d-web/react`: client components and hooks. React is an optional peer.
- `live2d-web/adapters/cubism-webgl`: default WebGL2 backend containing the
  Framework runtime and its shader assets, but not Cubism Core.
- `live2d-web/adapters/pixi-v6`: compatibility/A-B backend using
  `pixi-live2d-display@0.4`; all Pixi peers are optional.

Automatic quality limits mobile backing buffers to 1.5 MP and desktop buffers
to 4 MP. A fixed `resolution` disables automatic downshifting.

## Lip sync

Both the vanilla `addLipSync()` API and React `<LipSync>` accept an existing
driver or a caller-owned WebAudio `AudioNode`. Source mode dynamically loads
wLipSync. The package does not include a calibration profile and never closes
or suspends the caller's `AudioContext`.

`ParamMouthOpenY`, the 200 ms release and the 500 ms closed-mouth handoff are
fixed in this alpha API. The final parameter write happens after SDK motion
updates without per-frame React renders.

## Development

Node 24 and pnpm are required.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
pnpm dev

pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm verify:package
```

Benchmark suites (startup, 18-condition matrix, memory, backend A/B and
hardware runs) are documented in the [benchmark guide](docs/benchmarking.md).

After reviewing the official terms linked by the command,
`LIVE2D_ACCEPT_TERMS=1` confirms the local development download. The script
uses the official Cubism 5.3 Core (`core/06`), Hiyori and the pinned
`CubismWebSamples@5-r.5` Mark/Mao/Rice/Ren resources, and writes only to ignored
development paths. None of these assets is included in the package. See the
[benchmark guide](docs/benchmarking.md) for the focused 18-condition matrix,
raw result boundary and explicit Markdown promotion command.

The Playground provides React at `/`, the vanilla controller at `/vanilla`,
a URL-based model Inspector at `/inspect`, and a WebGL/Pixi A-B view at
`/compare`. The Inspector accepts relative or CORS-enabled HTTP(S)
`model3.json` URLs and displays asset diagnostics without bundling models.
`apps/vanilla-consumer` is a separate Vite fixture whose manifest and production
bundle contain no React dependency.

## Documentation

Start from the [documentation map](docs/README.md). Highlights:

- [API reference](docs/api-design.md)
- [Architecture](docs/architecture.md)
- [Licensing](docs/licensing.md)
- [Benchmark guide](docs/benchmarking.md) and
  [WebGL vs Pixi v6 results](docs/benchmarks/2026-08-15-cubism-webgl-vs-pixi-v6.md)

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
