# live2d-web

> A vanilla-first Live2D runtime with optional React bindings.

`live2d-web` owns Live2D model loading, lifecycle, fitting, parameter drivers,
render quality, retry and cleanup. Rendering stays behind a backend contract,
so the same runtime can be used directly from JavaScript or through React.

**Status: `0.1.0-alpha.0` is implemented and validated locally, but has not
been published to npm.** The official Cubism WebGL2 path has passed a private
Framework 5-r.5/Hiyori feasibility spike. It is intentionally not present in
Git, package exports or the npm tarball until Live2D confirms the Framework and
shader redistribution terms in writing. Until then, pass the PixiJS v6
comparison backend explicitly.

## Vanilla API

```ts
import { createLive2D } from 'live2d-web'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'

const character = await createLive2D({
  backend: pixiV6,
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

import { pixiV6 } from 'live2d-web/adapters/pixi-v6'
import { LipSync, Live2DModel, Live2DStage } from 'live2d-web/react'

export function Character({ voice }: { voice: AudioNode | null }) {
  return (
    <Live2DStage
      backend={pixiV6}
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

## Package boundaries

- `live2d-web`: React-free vanilla runtime and renderer-neutral contracts.
- `live2d-web/react`: client components and hooks. React is an optional peer.
- `live2d-web/adapters/pixi-v6`: temporary compatibility/A-B backend using
  `pixi-live2d-display@0.4`; all Pixi peers are optional.
- `live2d-web/adapters/cubism-webgl`: reserved, but deliberately not exported
  before the redistribution gate is cleared.

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
```

After reviewing the official terms linked by the command,
`LIVE2D_ACCEPT_TERMS=1` confirms the local development download. The script
uses the official Cubism 5.3 Core (`core/06`) and Hiyori URLs and writes only to
ignored development paths. Neither asset is included in the package.

The Playground provides the React page at `/` and the vanilla-controller page
at `/vanilla`, both using the same Hiyori manifest.
`apps/vanilla-consumer` is a separate Vite fixture whose manifest and production
bundle contain no React dependency.

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api-design.md)
- [Cubism WebGL implementation plan and gate](docs/cubism-webgl-plan.md)
- [Licensing](docs/licensing.md)
- [Roadmap](docs/roadmap.md)

## License and trademark

The project source is MIT licensed. Third-party notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This is an unofficial third-party project and is not affiliated with or
endorsed by Live2D Inc. Live2D and Cubism are trademarks of Live2D Inc.
`live2d-web` does not bundle Cubism Core, Cubism Framework, shaders, sample
models or a lip-sync profile.
