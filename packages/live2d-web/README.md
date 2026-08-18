# live2d-web

> Put a Live2D character on the web with one call. No PixiJS, no globals,
> React optional.

An unofficial library for Live2D, not affiliated with Live2D Inc. Shipping an
app built with it may need its own
[Cubism SDK license](https://www.live2d.com/en/sdk/license/).

```bash
npm install live2d-web
```

You also need the official Cubism Core file (not bundled; see the
[project README](https://github.com/Heonys/live2d-web#readme) for the
one-minute setup) and a Cubism 4/5 model directory served as static files.

## Vanilla

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL, // self-host the file for production
  fit: 'upper-body',
  followPointer: true,
  src: '/models/hiyori/hiyori.model3.json',
})

await character.motion('Tap@Body') // resolves when playback finishes
character.hitTest(event.clientX, event.clientY) // ['Body']
character.dispose()
```

## React

```tsx
import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

<Live2DCanvas coreUrl="/assets/live2dcubismcore.min.js" quality="auto">
  <Live2DModel
    src="/models/hiyori/hiyori.model3.json"
    followPointer
    onTap={areas => console.log(areas)}
  />
</Live2DCanvas>
```

## Entry points

- `live2d-web` — React-free runtime and renderer-neutral contracts
- `live2d-web/react` — client components and hooks (React is an optional peer)
- `live2d-web/adapters/cubism-webgl` — default WebGL2 backend (Framework
  runtime and shaders included, Cubism Core not included)
- `live2d-web/adapters/pixi-v6` — compatibility backend for
  `pixi-live2d-display@0.4` users (all Pixi peers optional)

Full API reference, troubleshooting and licensing:
[github.com/Heonys/live2d-web](https://github.com/Heonys/live2d-web#readme).

The bundled Cubism Web Framework and its WebGL shaders remain under Live2D's
license; modifications are recorded in `THIRD_PARTY_NOTICES.md`. Cubism Core,
sample models and lip-sync profiles are not included. This is an unofficial
project, not affiliated with or endorsed by Live2D Inc. Live2D and Cubism are
trademarks of Live2D Inc.
