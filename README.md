<p align="center">
  <img src="apps/playground/public/brand/live2d-web-avatar.png" alt="live2d-web" width="64" height="64">
</p>

<p align="center">
  An unofficial Live2D Cubism runtime for JavaScript and React.<br>
  Direct WebGL2 rendering without PixiJS.
</p>

<p align="center">
  <strong><a href="https://live2d-web.heonys.dev/docs/en">Documentation</a></strong> ·
  <a href="https://live2d-web.heonys.dev/playground">Playground</a> ·
  <a href="https://live2d-web.heonys.dev/inspect">Model inspector</a> ·
  <a href="examples">Examples</a>
</p>

<p align="center">
  <strong>English</strong> · <a href="README.ko.md">한국어</a> · <a href="README.ja.md">日本語</a>
</p>

## Features

- Cubism 4/5 models loaded through a bundled Framework 5-r.5 adapter and
  drawn on WebGL2
- A plain JavaScript runtime, with React components and hooks included
- Motions, sequences, fades, weighted idle, expressions and pointer interaction
- Several models on one canvas, sharing its WebGL context
- Lip sync from volume or wLipSync, and MediaPipe face tracking (experimental)
- A devtools panel, plus model reports and a placement overlay (both
  experimental)

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
import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/model.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

The host element needs an explicit CSS size. Dispose the JavaScript instance when
the host view is removed; React components clean themselves up on unmount.

## Learn and verify

The localized guides cover Core/model preparation, JavaScript, React,
motion/expression, lip sync, MediaPipe main/Worker, Next SSR, mobile,
troubleshooting, security and licenses:

- [English documentation](https://live2d-web.heonys.dev/docs/en)
- [한국어 문서](https://live2d-web.heonys.dev/docs/ko)
- [日本語ドキュメント](https://live2d-web.heonys.dev/docs/ja)
- [Generated API reference](https://live2d-web.heonys.dev/docs/en/api)

The repository includes production-built Vite JavaScript, Next React, Vue Vite
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
