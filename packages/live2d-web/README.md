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
await character.motion('Tap@Body', 0, { fadeInMs: 250, fadeOutMs: 400 })
const result = await character.playMotion('Tap@Body') // detailed ending status
await character.sequence([
  { group: 'Tap@Body', index: 0 },
  { group: 'Tap@Body', index: 1 },
])
await character.expression('smile', { fadeInMs: 250, fadeOutMs: 400 })
character.clearExpression()

container.addEventListener('click', async (event) => {
  if (character.hitTest(event.clientX, event.clientY).includes('Body'))
    await character.motion('Tap@Body')
})
```

Motion fade overrides are finite, non-negative milliseconds and affect only
that playback. Use `0` for an instant fade; omit a field to retain the
model3/motion3 default. Parameter-specific motion3 fades remain authored.
`playMotion()` reports `completed`, `interrupted`, `skipped` or `disposed`;
`sequence()` validates all steps before playing and stops at the first
non-completed status. Expression fades follow the same millisecond rules.

For weighted automatic idle selection, pass
`idleMotion: { group: 'Idle', weights: [5, 2, 1] }` to `createLive2D()` or
`<Live2DModel>`. Weights must match the group's motion count, and zero-weight
entries are never selected.

## Lip sync

```ts
import { createVolumeLipSync } from 'live2d-web'

// From a WebAudio node (vowel analysis via wLipSync, loaded on demand):
character.addLipSync({
  source: audioNode,
  profile: '/lipsync/profile.bin',
  isSpeaking: () => isPlaying,
})

// Or convert caller-sampled RMS volume into a stable driver:
const volume = createVolumeLipSync()
character.addLipSync({ driver: volume })
volume.sample(rms, elapsedMs) // once per capture frame
```

React also takes plain values: `<LipSync mouthOpen={mouth} speaking={mouth > 0} />`.
The app owns microphone access, RMS analysis and scheduling; the volume driver
only calibrates the noise floor, smooths the value and detects speaking.
Driver/value lip sync supports current Chromium, Firefox and WebKit. The
optional wLipSync AudioWorklet source mode is currently verified on
Chromium/WebKit; wlipsync 1.3 throws inside Firefox's worklet.

## MediaPipe face tracking

Install `@mediapipe/tasks-vision` and use the isolated optional entry. The app
owns camera permissions, video, tracks and rAF; no WASM or model is bundled.

```ts
import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'

const tracker = await createMediaPipeFaceTracker({
  wasmPath: '/mediapipe/wasm',
  modelAssetPath: '/mediapipe/face_landmarker.task',
})
const detach = tracker.attach(character, {
  mapping: 'auto',
  channels: { mouth: false },
})
tracker.update(video, performance.now()) // once per app-owned capture frame
```

The tracker performs one-second neutral calibration, smoothing, face-loss
recovery and standard/52-parameter Perfect Sync mapping. Clean up with
`detach()` and `tracker.dispose()`. Main-thread inference starts at 30fps and
lowers its own cap (to 10fps at the lowest) while measured inference time would
starve rendering; `maxFps` sets the starting cap.

## Local and browser-storage models

Use `resolveAsset` to provide files without network fetches. `src` names the
model3.json inside that source; sibling paths, CJK, spaces and literal `%`, `#`
and `?` filenames are preserved.

```ts
await createLive2D({
  container,
  coreUrl,
  src: 'avatar/model.model3.json',
  resolveAsset: path => files.get(path),
})
```

Absolute URLs declared inside model3.json intentionally bypass the resolver
and use `fetch`. Validate untrusted local model3 files before rendering when
your application promises no network access.

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
- `live2d-web/tracking/mediapipe`: optional MediaPipe Face Landmarker mapping
- `live2d-web/backends/cubism-webgl`: default WebGL2 backend (Framework
  runtime and shaders included, Cubism Core not included)

Full guide, React reference tables, troubleshooting and licensing:
[github.com/Heonys/live2d-web](https://github.com/Heonys/live2d-web#readme).

The bundled Cubism Web Framework and its WebGL shaders remain under Live2D's
license; modifications are recorded in `THIRD_PARTY_NOTICES.md`. Cubism Core,
sample models and lip-sync profiles are not included. This is an unofficial
project, not affiliated with or endorsed by Live2D Inc. Live2D and Cubism are
trademarks of Live2D Inc.
