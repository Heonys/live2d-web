# live2d-jsx

> Declarative Live2D for React.

`live2d-jsx` moves Live2D model loading, lifecycle, fitting, parameter drivers,
render quality and cleanup into React components and hooks. Rendering remains
behind a backend contract; v0.1 ships a PixiJS v6 adapter powered by
`pixi-live2d-display@0.4`.

**Status: `0.1.0-alpha.0` is implemented and validated locally, but not
published to npm yet.** Lip sync, gaze and the AIZUCHI migration are v0.2+
work.

```tsx
'use client'

import { Live2DModel, Live2DStage, useParameterDriver } from 'live2d-jsx'
import { pixiV6 } from 'live2d-jsx/adapters/pixi-v6'

function Mouth({ value }: { value: () => number }) {
  useParameterDriver('ParamMouthOpenY', value)
  return null
}

export function Character() {
  return (
    <Live2DStage
      backend={pixiV6}
      coreUrl="/assets/live2dcubismcore.min.js"
      quality="auto"
    >
      <Live2DModel src="/models/hiyori.model3.json" fit="upper-body">
        <Mouth value={() => 0.5} />
      </Live2DModel>
    </Live2DStage>
  )
}
```

## v0.1 API

- `<Live2DStage>`: Core loading, stage lifecycle, adaptive quality,
  `ResizeObserver`, visibility pause/resume, errors and retry.
- `<Live2DModel>`: one model per stage, retry, stale-load disposal and fitting.
- `useStage()`: loading/error state and low-frequency render diagnostics.
- `useLive2DModel()`, `useLive2DParameter()` and `useParameterDriver()`.
- `live2d-jsx/adapters/pixi-v6`: single application ticker, manual model update,
  guarded render and idempotent cleanup.

`quality="auto"` limits mobile backing buffers to 1.5×/1.5 MP and desktop
buffers to 2×/4 MP. A fixed `resolution` disables adaptive quality.

## Development

Node 24 and pnpm are required.

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
pnpm dev

pnpm lint
pnpm typecheck
pnpm test
pnpm build
pnpm -F @live2d-jsx/playground build
pnpm test:e2e
```

After reviewing the official terms linked by the command,
`LIVE2D_ACCEPT_TERMS=1` confirms the local development download. The command
uses Live2D's official Core and Hiyori distribution URLs and writes only to
ignored development paths. Neither asset is included in the package.

## Documentation

- [Architecture](docs/architecture.md)
- [API reference](docs/api-design.md)
- [AIZUCHI extraction map](docs/extraction-map.md)
- [Licensing](docs/licensing.md)
- [Roadmap](docs/roadmap.md)

## License and trademark

The project source is MIT licensed. Third-party notices are listed in
[THIRD_PARTY_NOTICES.md](THIRD_PARTY_NOTICES.md).

This is an unofficial third-party project and is not affiliated with or
endorsed by Live2D Inc. Live2D and Cubism are trademarks of Live2D Inc.
`live2d-jsx` does not bundle Cubism Core, Cubism Framework, or sample models.
Users must obtain and use those materials under Live2D's current terms.
