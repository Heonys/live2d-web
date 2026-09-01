# Changelog

## Unreleased

### Added

- A placement overlay, mounted over the canvas by `debug: true` on
  `createLive2D()` or `<Live2DModel debug />`, or by
  `mountLive2DDebugOverlay()` from the new `live2d-web/debug` entry. Drag to
  move, scroll to zoom around the cursor, arrow keys to nudge, and it prints the
  `fit` value to paste back. Reset returns to where the placement stood when the
  overlay opened.

  `upper-body` assumes a full-body rig that fills its canvas, and two of the
  five official Cubism samples are not one: one overflows at twice the size, the
  other is drawn off center and leans. `model3.json` carries the canvas size but
  not where the character sits inside it, so no default can correct for that.
  Rather than guess for every rig, let the value be found by hand.

  Pointer events stop at the overlay, including the click a press synthesizes,
  or `followPointer` would chase the cursor while the model slides under it and
  letting go would play a motion through `onTap`. The entry is loaded on demand,
  so leaving `debug` off adds nothing to the root bundle.
- `fit` offsets can be read as a fraction of the stage with
  `{ ..., units: 'stage' }`. Pixel offsets, still the default, are fixed to the
  stage size they were measured at: the layout is recomputed on every resize
  with the same stored value, so a placement found in one window is wrong in
  another. The overlay writes stage-relative values for that reason.
- `getFit()` reports the layout in effect, and `setDebug()` shows or hides the
  overlay without reloading the model.
- More than one model on a canvas. `addModel()` loads another onto the stage
  that already exists and returns a handle for that model alone; in React a
  `<Live2DCanvas>` takes as many `<Live2DModel>` children as you give it.

  A stage held one model, so a second character meant a second canvas and a
  second WebGL context, which browsers cap. That is a limit rather than a cost,
  and it is where migrating from `pixi-live2d-display`, which puts many models
  on one stage, lost a feature.

  Models draw in the order they were added, so a later one sits on top. Each
  carries its own `fit`, motions, expressions, parameters and hit areas, and
  disposing one leaves the canvas and the others alone. `src` is optional now,
  so a canvas can open empty. The instance keeps its own `motion()`, `fit` and
  the rest, acting on the model `src` created.

  `<Live2DCanvas paused>` joins the canvas, where pausing always belonged. It
  still works on a model, where any paused model pauses the canvas.

### Fixed

- The placement overlay belongs to one model at a time, and turning `debug` on
  moves it to that model. It used to mount for whichever model finished loading
  first, drop the others without a word, let any model remove another's, and
  stay behind editing a model that had been disposed while still taking the
  pointer over the canvas. Declaring `debug` on two models at once now warns
  rather than silently picking one.
- Disposing one model no longer stops the others on its canvas. The Framework
  keeps compiled shaders and offscreen buffers in registries keyed by GL
  context, and every model released them on the way out, so the models still
  drawing lost their shaders. They are reference counted now, and the last
  model out does the releasing. Only reachable with more than one model, and
  only visible in a browser: the unit suite passed while it was broken.
- A `fit` prop is compared by value before it is reapplied. An inline
  `fit={{ ... }}` is a new object on every render, so React was pushing the same
  placement into the runtime on every parent render. That was wasted work on its
  own, and it would have wiped whatever the debug overlay had been dragged to,
  which is why the overlay needs nothing but `debug` to be useful.

## 0.8.0 - 2026-08-31

### Fixed

- A tracked blink now closes the eye. Three separate causes were found by
  putting the tracker on a real avatar and measuring what came out.

  Smoothing sized for head pose was flattening the blink. One constant covered
  every blendshape, and a blink is over in about 120ms, three or four frames at
  30fps, so the peak was averaged away before it arrived and the lid stopped
  around halfway. Closing now follows the signal while opening keeps the shared
  constant. Held expressions such as a squint are unaffected.

  Calibration normalized each score against a maximum of 1, which MediaPipe does
  not reach for a shut eye: held medians measured 0.73 and 0.68 on the two sides.
  Nearly a third of the usable range was discarded, so a fully closed eye
  arrived as a lid a third open. Blink shapes now normalize against the score a
  real closure reports. This is not a `sensitivity` change; gain multiplies the
  resting offset and the left-right difference along with the movement.

  Together these also remove the asymmetry that prompted the report, where one
  eye sat visibly less open than the other while the wearer did nothing.

  Measured on one face and two cameras. A camera that scores higher will
  saturate early.
- A MediaPipe worker that dies reaching for `document` names the remedy instead
  of forwarding `Can't find variable: document`. MediaPipe 1.0.1 touches
  `document` while fetching its WASM and no worker has one, which affects Chrome
  and the Google app on iOS. Catch the error and recreate with
  `execution: 'main'`; the tracker never switches modes on its own.
- The `devtools` panel no longer draws its own heading. Every host that mounts it
  has already labelled the region it was handed, so the screen carried two
  titles. Its tab strip was also fixed at four columns and would have wrapped a
  fifth, the status row printed "model controller" when no runtime state was
  available, and format versions were two bare numbers either side of a slash.

### Changed

- Calibration guidance asks for the wearer's normal posture rather than a held
  neutral expression. Sitting up deliberately for the calibration second makes an
  ordinary posture read as slightly closed eyes afterwards.

## 0.7.0 - 2026-08-28

### Added

- Optional Canvas accessibility semantics mark a model as decorative or expose
  it as a labelled image with fallback text, without making the Canvas
  keyboard-focusable. `setAccessibility()` re-describes the live canvas instead
  of rebuilding the stage.
- API Extractor reports establish the public contract for every entry;
  `api:check` blocks unrecorded export and type changes in CI.

### Fixed

- Face tracking drives each parameter away from its own `defaultValue` instead
  of stretching a 0..1 signal across `[minimum, maximum]`. Rigs that do not park
  their defaults on a rail were visibly wrong: eyes sat over-open and the first
  part of every blink was spent undoing that, and a channel whose travel runs
  below its default was pinned to its minimum. Sensitivity now scales the
  tracked deflection, and `onFaceLost: 'neutral'` returns to the model's own
  defaults as documented. Rigs whose defaults sit on a rail are unchanged.
- The `devtools` panel labels its cards as groups instead of injecting `<h3>`
  titles into the host page's heading outline.

### Changed

- Packed consumer verification builds the React entry with both React 18.2 and
  React 19. Troubleshooting now covers every public error code in all three
  documentation languages.

## 0.6.0 - 2026-08-26

The tracking Worker entry, `inspect` and `devtools` are experimental.

### Added

- `live2d-web/devtools`: a React-free, SSR-safe entry that mounts isolated
  overview, parameter, motion and expression controls for vanilla instances or
  React controllers. Its temporary drivers never touch application-owned
  overrides.
- `live2d-web/inspect`: a React-free, SSR-safe entry reporting model3 assets,
  motions, expressions, hit areas, version metadata and Standard/Perfect Sync
  parameter coverage. The browser inspector accepts CORS-enabled URLs and local
  zip files without uploading them.
- `live2d-web/tracking/mediapipe/worker`: optional Worker execution through an
  application-provided module Worker, keeping the synchronous main tracker as
  the default. Frames, landmarks, WASM and model assets remain unbundled.
  Requests carry deadlines and a protocol version so a wedged or version-skewed
  worker fails loudly.
- Localized English, Korean and Japanese guides, a TypeDoc API reference,
  static search and four production-built examples (Vite Vanilla, Next React,
  Vue Vite, transparent OBS overlay).
- Entry-level bundle budgets asserted by `verify:package` on every push, and a
  tiered tracking soak gate on release tags and a weekly schedule.

## 0.5.0 - 2026-08-25

### Added (experimental)

- `live2d-web/tracking/mediapipe`: optional face tracking that dynamically
  loads MediaPipe Tasks Vision, calibrates a neutral pose, smooths the result
  and attaches Standard or Perfect Sync drivers. Perfect Sync uses the ARKit 52
  names and needs at least 45 of them. Camera capture, scheduling, WASM and
  model assets stay caller-owned and unbundled. Main-thread inference starts at
  30fps and lowers its own cap to 10fps while inference would starve the render
  loop; `effectiveFps` reports the current cap.
- Tracking tuned against a real camera: `sensitivity` per channel, the three
  MediaPipe confidence thresholds exposed and defaulted below MediaPipe's own
  0.5 so an ordinary head turn does not drop the face, `onFaceLost` holding the
  last pose by default, and head pose rate-limited to 360 degrees per second.
- Parameter drivers choose when they are written. `phase: 'before-physics'`
  runs between the SDK effects and physics so a driven head pose reaches the
  simulation and hair follows it; `'after-motion'` remains the default.
- Built-in backends expose optional parameter ranges through
  `ModelInfo.parameters`. New `tracking-error` code.

### Added

- `createVolumeLipSync()`: a React-free, SSR-safe driver turning caller-sampled
  RMS volume into stable mouth openness with noise-floor calibration,
  attack/release smoothing and speaking hysteresis.
- Per-playback `fadeInMs`/`fadeOutMs` on `motion()` and `expression()` without
  mutating cached motions or authored motion3/exp3 fades.
- `playMotion()` reports natural completion, interruption, skipped playback or
  disposal without changing the existing `motion(): Promise<void>` contract.
  `sequence()` pre-validates and plays ordered steps.
- Automatic idle playback accepts validated per-motion weights.

### Fixed

- `poseFromMatrix` normalizes the rotation basis. MediaPipe fits the canonical
  face with a similarity transform, so head scale was shrinking yaw while
  leaving pitch and roll intact.

## 0.3.1 - 2026-08-21

### Fixed

- Resolver-backed sources preserve literal spaces, CJK characters and URL
  reserved characters (`%`, `#`, `?`) in archive and browser-storage filenames.
- The React `useLive2D()` lifecycle no longer performs synchronous state writes
  from its setup effect.

## 0.3.0 - 2026-08-20

### Added

- `resolveAsset`, on `createLive2D()` and `<Live2DModel>`, supplies a model's
  files from somewhere other than the network: an archive unpacked in memory, a
  browser storage layer, or any custom source. `src` then names a path inside
  that source and sibling assets resolve relative to it exactly as they do for a
  URL. Paths reach the resolver decoded, so a model whose files are named in
  Korean, Japanese or Chinese is looked up under the names it uses. Returning
  `undefined` fails the load naming the missing path and never retries.
  Absolute URLs a model declares are still fetched.

## 0.2.0 - 2026-08-19

### Removed

- **Breaking**: the `live2d-web/backends/pixi-v6` entry is no longer published
  and the Pixi packages it needed are no longer optional peer dependencies.
  Declaring them put `pixi-live2d-display` and its transitive `gh-pages`
  dependency into the graph supply-chain scanners read, so every install
  carried an advisory for a backend almost nobody loads. Stay on 0.1.0 or write
  a backend against the public `Backend` interface, which is unchanged. `react`
  is now the only peer dependency.

## 0.1.0 - 2026-08-19

Initial release.

### Added

- `createLive2D()`: a React-free runtime owning model loading, lifecycle,
  fitting, retries and cleanup for Cubism 4/5 `model3.json` models on WebGL2,
  with the official Cubism Web Framework 5-r.5 renderer as the default backend.
- Motions and expressions: `motion()` resolving on completion,
  `expression()`/`clearExpression()`, `getModelInfo()`.
- Interaction: `followPointer`, `focus()`/`focusAt()`, `hitTest()`.
- Lip sync in three modes: a WebAudio node analysed by wLipSync, a
  caller-provided driver, or plain values through `<LipSync>`.
- Parameter control: persistent `setParameter()`/`clearParameter()` overrides
  and per-frame `addParameterDriver()` callbacks.
- Automatic render quality, `maxFps`, and automatic pausing for hidden tabs and
  offscreen canvases.
- React bindings at `live2d-web/react` sharing one headless controller with the
  vanilla API; React 18.2 and 19 as an optional peer.
- Errors with stable codes and asset details, fast failure on HTTP 4xx,
  configurable retries, `retry()` after WebGL context loss, `AbortSignal`
  support.
