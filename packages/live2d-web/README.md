# live2d-web

> A Live2D runtime for the modern web. Load a Cubism model, play motions,
> follow the pointer and lip sync, from vanilla JavaScript or React. No PixiJS.

An unofficial library for Live2D, not affiliated with Live2D Inc. Shipping an
app built with it may need its own
[Cubism SDK license](https://www.live2d.com/en/sdk/license/).

**[Live demo](https://live2d-web-demo.netlify.app/)**, and an
[inspector](https://live2d-web-demo.netlify.app/inspect) that loads any
`model3.json` URL.

```bash
npm install live2d-web
```

Two files are required and not bundled: the official Cubism Core file from
https://www.live2d.com/sdk/download/web/ (or the hosted
`OFFICIAL_CUBISM_CORE_URL` for a quick trial), and a Cubism 4/5 model
directory served as static files.

## Quick start

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL, // self-host the file for production
  src: '/models/hiyori/hiyori.model3.json',
  fit: 'upper-body',
  followPointer: true,
})
```

```tsx
import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

<Live2DCanvas coreUrl="/assets/live2dcubismcore.min.js">
  <Live2DModel
    src="/models/hiyori/hiyori.model3.json"
    followPointer
    onTap={areas => console.log(areas)}
  />
</Live2DCanvas>
```

## Motions, expressions, taps

```ts
character.getModelInfo() // { motions: { Idle: 3, 'Tap@Body': 2 }, expressions, hitAreas }

await character.motion('Tap@Body') // resolves when playback finishes
await character.expression('smile')
character.clearExpression()

container.addEventListener('click', async (event) => {
  if (character.hitTest(event.clientX, event.clientY).includes('Body'))
    await character.motion('Tap@Body')
})
```

## Lip sync

```ts
// From a WebAudio node (vowel analysis via wLipSync, loaded on demand):
character.addLipSync({
  source: audioNode,
  profile: '/lipsync/profile.bin',
  isSpeaking: () => isPlaying,
})

// Or from any logic that yields mouth openness 0..1:
character.addLipSync({
  driver: { getMouthOpen: () => volume, isSpeaking: () => volume > 0 },
})
```

React also takes plain values: `<LipSync mouthOpen={mouth} speaking={mouth > 0} />`.

## Parameters, state, cleanup

```ts
character.setParameter('ParamMouthOpenY', 0.6) // persistent override
character.clearParameter('ParamMouthOpenY') // motions take over again
character.addParameterDriver('ParamAngleX', { getValue: () => angle })

character.subscribe(() => console.log(character.getState().status))
character.pause()
character.resume()
await character.retry() // rebuilds the stage after e.g. WebGL context loss
character.dispose() // safe to call twice
```

Rendering quality is automatic: the backing buffer is capped and steps down
when frames run long. Pass a fixed `resolution` to opt out, and `maxFps` to
cap the frame rate. Hidden tabs and offscreen canvases pause automatically.

## Entry points

- `live2d-web`: React-free runtime and renderer-neutral contracts
- `live2d-web/react`: components and hooks (React 18.2/19, optional peer)
- `live2d-web/backends/cubism-webgl`: default WebGL2 backend (Framework
  runtime and shaders included, Cubism Core not included)
- `live2d-web/backends/pixi-v6`: compatibility backend for
  `pixi-live2d-display@0.4` users (all Pixi peers optional)

Full guide, React reference tables, troubleshooting and licensing:
[github.com/Heonys/live2d-web](https://github.com/Heonys/live2d-web#readme).

The bundled Cubism Web Framework and its WebGL shaders remain under Live2D's
license; modifications are recorded in `THIRD_PARTY_NOTICES.md`. Cubism Core,
sample models and lip-sync profiles are not included. This is an unofficial
project, not affiliated with or endorsed by Live2D Inc. Live2D and Cubism are
trademarks of Live2D Inc.
