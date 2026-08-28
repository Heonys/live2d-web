# Changelog

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
