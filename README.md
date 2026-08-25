# live2d-web

**English** | [한국어](README.ko.md) | [日本語](README.ja.md)

> An unofficial Live2D Cubism runtime for vanilla JavaScript and React. It
> renders through WebGL2 without PixiJS.

**[Documentation](https://live2d-web-demo.netlify.app/docs/en)** ·
[Playground](https://live2d-web-demo.netlify.app/playground) ·
[Model inspector](https://live2d-web-demo.netlify.app/inspect) ·
[Examples](examples)

## Why live2d-web

- Cubism 4/5 model loading with a bundled Framework 5-r.5 WebGL2 adapter
- One React-free root API plus an optional React binding
- Motions, sequences, fades, weighted idle, expressions and pointer interaction
- Volume/wLipSync inputs and optional MediaPipe main/Worker face tracking
- Explicit lifecycle cleanup, stable errors and real tarball/browser gates
- Optional `live2d-web/inspect` model reports and `live2d-web/devtools` controls

## Quick start

```sh
pnpm add live2d-web
```

Cubism Core and model files are deliberately not bundled. Download Core under
Live2D’s terms, self-host it, and serve a licensed Cubism 4/5 model directory.

```ts
import { createLive2D } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#avatar')!,
  coreUrl: '/live2dcubismcore.min.js',
  src: '/models/model.model3.json',
  followPointer: true,
})

await character.motion('TapBody', 0)
character.dispose()
```

```tsx
'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/model.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

The host element needs an explicit CSS size. Dispose the vanilla instance when
the host view is removed; React components clean themselves up on unmount.

## Learn and verify

The localized guides cover Core/model preparation, Vanilla, React,
motion/expression, lip sync, MediaPipe main/Worker, Next SSR, mobile,
troubleshooting, security and licenses:

- [English documentation](https://live2d-web-demo.netlify.app/docs/en)
- [한국어 문서](https://live2d-web-demo.netlify.app/docs/ko)
- [日本語ドキュメント](https://live2d-web-demo.netlify.app/docs/ja)
- [Generated API reference](https://live2d-web-demo.netlify.app/docs/en/api)

The repository includes production-built Vite Vanilla, Next React, Vue Vite
and transparent OBS overlay examples. Run them after providing
`/live2dcubismcore.min.js` and `/models/model.model3.json`:

```sh
pnpm examples:build
```

## Compatibility and package boundaries

The default target is current Chromium, Firefox and WebKit with WebGL2, Cubism
Core 5.3 and Framework 5-r.5. See the [compatibility matrix](docs/compatibility.md)
for verified and pending combinations.

The root entry stays React-, Framework- and MediaPipe-free. React,
`tracking/mediapipe`, its Worker entry, `inspect`, `devtools`, and the Cubism
backend have separate package boundaries. WASM, tracking models, Cubism Core and Live2D
models are never included in the npm package.

## License and trademarks

live2d-web is not affiliated with or endorsed by Live2D Inc. The library,
Cubism Framework, Cubism Core, models and MediaPipe have separate terms. Review
[package licenses](packages/live2d-web/LICENSES.md), [licensing notes](docs/licensing.md), and Live2D’s
[SDK license page](https://www.live2d.com/en/sdk/license/) before distribution.

## Contributing

Read [CONTRIBUTING.md](CONTRIBUTING.md) before opening an issue or pull request.
Do not attach Cubism Core, licensed models, camera frames or restricted test
artifacts to GitHub.
