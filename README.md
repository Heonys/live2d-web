# live2d-web

> A vanilla-first Live2D runtime with optional React bindings.

`live2d-web` owns Live2D model loading, lifecycle, fitting, parameter drivers,
render quality, retry and cleanup. Rendering stays behind a backend contract,
so the same runtime can be used directly from JavaScript or through React.

**Status: `0.1.0-alpha.0` is implemented and validated locally, but has not
been published to npm.** The default backend uses the official Cubism Web
Framework 5-r.5 renderer directly on WebGL2. PixiJS v6 remains available only
as an explicit compatibility and performance-comparison backend. Public
repository and npm release are separate release gates.

## Vanilla API

```ts
import { createLive2D } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: '/assets/live2dcubismcore.min.js',
  fit: 'upper-body',
  quality: 'auto',
  src: '/models/hiyori.model3.json',
})

await character.motion('Tap@Body')
character.setParameter('ParamMouthOpenY', 0.5)
character.pause()
character.resume()
character.dispose()
```

`createLive2D()` resolves only after Core, Stage and the model are ready. It
also exposes `expression`, `focus`, `getParameter`, `setFit`, `retry`,
`addParameterDriver`, `addLipSync`, state subscription and idempotent cleanup.

## React API

```tsx
'use client'

import { LipSync, Live2DModel, Live2DStage } from 'live2d-web/react'

export function Character({ voice }: { voice: AudioNode | null }) {
  return (
    <Live2DStage
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
    </Live2DStage>
  )
}
```

The React components create and subscribe to the same headless controller used
by the vanilla API. Per-frame values never pass through React state.

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
pnpm verify:package
pnpm -F @live2d-web/playground build
pnpm test:e2e
LIVE2D_BENCHMARK_MS=300000 pnpm benchmark:backends
```

After reviewing the official terms linked by the command,
`LIVE2D_ACCEPT_TERMS=1` confirms the local development download. The script
uses the official Cubism 5.3 Core (`core/06`) and Hiyori URLs and writes only to
ignored development paths. Neither asset is included in the package.

The Playground provides React at `/`, the vanilla controller at `/vanilla`,
and a WebGL/Pixi A-B view at `/compare`, all using the same Hiyori manifest.
`apps/vanilla-consumer` is a separate Vite fixture whose manifest and production
bundle contain no React dependency.

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api-design.md)
- [Cubism WebGL implementation plan and gate](docs/cubism-webgl-plan.md)
- [Cubism WebGL vs Pixi v6 benchmark](docs/benchmarks/2026-08-14-cubism-webgl-vs-pixi-v6.md)
- [Licensing](docs/licensing.md)
- [Roadmap](docs/roadmap.md)

## License and trademark

The original project source is MIT licensed. The bundled Cubism Web Framework
and shaders remain under Live2D's license. Package license details and modified
Framework files are recorded in [LICENSES.md](packages/live2d-web/LICENSES.md)
and [THIRD_PARTY_NOTICES.md](packages/live2d-web/THIRD_PARTY_NOTICES.md).

This is an unofficial third-party project and is not affiliated with or
endorsed by Live2D Inc. Live2D and Cubism are trademarks of Live2D Inc.
`live2d-web` does not bundle Cubism Core, sample models or a lip-sync profile.
Before making the repository public or publishing npm, confirm that the final
Framework/shader redistribution and product use comply with Live2D's current
terms. See [licensing notes](docs/licensing.md).
