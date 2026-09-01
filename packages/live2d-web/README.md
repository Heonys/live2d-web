# live2d-web

An unofficial Live2D Cubism runtime for JavaScript and React. It uses a
WebGL2 renderer without PixiJS.

**[Documentation](https://live2d-web.heonys.dev/docs/en)** ·
[Playground](https://live2d-web.heonys.dev/playground) ·
[Model inspector](https://live2d-web.heonys.dev/inspect) ·
[GitHub](https://github.com/Heonys/live2d-web)

```sh
npm install live2d-web
```

Cubism Core and model files are not bundled. Download Core under Live2D’s
terms, self-host it, and serve a licensed Cubism 3/4/5 model directory.

## JavaScript

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

## React

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

The host needs an explicit CSS size. Dispose JavaScript instances when their view
is removed; React components clean up on unmount.

## Optional entries

- `live2d-web/react` — React components and hooks
- `live2d-web/tracking/mediapipe` — main/Worker face tracking; MediaPipe stays
  an optional peer and WASM/model files remain caller-supplied
- `live2d-web/inspect` — React-free, SSR-safe model source and capability reports
- `live2d-web/devtools` — framework-free model controls in an isolated Shadow DOM
- `live2d-web/backends/cubism-webgl` — bundled Framework adapter loaded by the
  root runtime on demand

See the guides for motions and expressions, lip sync, MediaPipe setup, Next
SSR, mobile, errors, security and licenses. API signatures are generated from
the public TypeScript source at
[the API reference](https://live2d-web.heonys.dev/docs/en/api).

live2d-web is not affiliated with or endorsed by Live2D Inc. The library,
Cubism Framework, Cubism Core, models and MediaPipe have separate terms. Review
the package license files and [Live2D SDK licensing](https://www.live2d.com/en/sdk/license/)
before distribution.
