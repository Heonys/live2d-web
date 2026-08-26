# Changelog

## Unreleased

### Added

- Optional Canvas accessibility semantics let vanilla and React consumers mark
  a model as decorative or expose it as a labelled image with fallback text,
  without making the Canvas keyboard-focusable or changing existing defaults.
- API Extractor reports now establish the public contract for the root, React,
  inspect, devtools, MediaPipe main/Worker and cubism-webgl entries; `api:check`
  blocks unrecorded export and type changes in CI.
- The Playground reports MediaPipe camera, tracker, first-inference,
  calibration and tracked timings separately, alongside matching JS, WASM and
  task Resource Timing entries.

### Changed

- Packed consumer verification builds the React entry with both React 18.2 and
  React 19. Troubleshooting in all three documentation languages now covers
  every public error code, and Playground model errors link to the matching
  cause, check, fix and retry guidance.

## 0.6.0 - 2026-08-26

The tracking Worker entry, `inspect` and `devtools` remain experimental. Their
exit criteria are mobile/consumer validation for tracking and consumer/API
compatibility validation for inspect/devtools; see `docs/roadmap.md`.

### Added

- A React-free, SSR-safe `live2d-web/devtools` entry mounts isolated overview,
  parameter, motion and expression controls for vanilla instances or React
  controllers. Temporary parameter drivers are removed on reset, target swap
  and dispose without touching application-owned overrides.
- The documentation site now renders localized MDX with build-time Shiki
  highlighting, full-text search, a desktop table of contents and accessible
  mobile navigation. The root is a focused landing experience; the full demo
  lives at `/playground` with a fixed canvas, scroll-contained tool panels and
  a focus-managed code drawer.
- A React-free, SSR-safe `live2d-web/inspect` entry reports model3 assets,
  motions, expressions, hit areas, version metadata, stable compatibility
  findings and Standard/Perfect Sync parameter coverage. The public browser
  inspector accepts CORS-enabled URLs and local zip files without uploading or
  rendering incompatible archives.
- The Netlify Playground now includes localized English, Korean and Japanese
  guides, a TypeDoc-generated API reference, static search, language metadata,
  sitemap and `llms.txt`. Four production-built examples cover Vite Vanilla,
  Next React, Vue Vite and transparent OBS overlays; contribution and issue
  templates define asset-safe reproduction requirements.
- Optional MediaPipe Worker execution keeps the existing synchronous main
  tracker as the default while adding an asynchronous, one-frame-in-flight
  tracker through an application-provided module Worker. The new
  `live2d-web/tracking/mediapipe/worker` entry owns task startup and cleanup;
  frames, landmarks, WASM and model assets remain unbundled. Detect and init
  requests carry deadlines and a protocol version so a wedged or version-skewed
  worker fails loudly, and the adaptive fps cap stays off in worker mode, where
  inference no longer competes with rendering.
- The tracking soak gate is tiered: five minutes on every release tag, fifteen
  weekly on a schedule, and a manual dispatch up to two hours, covering the
  main and Worker execution modes and attaching a heap/error summary to each
  run. Entry-level bundle budgets (raw and gzip) for React, tracking, its
  Worker, `inspect` and `devtools` are asserted by `verify:package` on every
  push, and the tracking benchmark compares main against Worker while Hiyori
  renders.

## 0.5.0 - 2026-08-25

Ships both roadmap scopes in one release; see the 2026-08-25 decision in
docs/README.md. The tracking subpath was released as experimental; current
stability criteria are documented in `docs/roadmap.md`.

### Added (0.5 scope, experimental)

- Optional `live2d-web/tracking/mediapipe` face tracking dynamically loads
  MediaPipe Tasks Vision, performs one-second neutral calibration, smoothing
  and face-loss recovery, then attaches standard or Perfect Sync drivers to
  vanilla instances and React controllers. Perfect Sync uses the ARKit 52
  parameter names (a model with at least 45 of them is mapped directly);
  `_neutral` never becomes a parameter and `ParamTongueOut` keeps its
  default. Camera capture, scheduling, WASM and model assets remain
  caller-owned and unbundled.
  Main-thread inference starts at 30fps and lowers its own cap (down to 10fps)
  while measured inference time would starve the render loop; `effectiveFps`
  reports the current cap.
- Face tracking is tuned against a real camera rather than a still portrait.
  `sensitivity` scales any channel away from that parameter's own default
  before the model's range clamps it (pose defaults to 3, measured against a
  live camera; every other channel stays at 1), the
  three MediaPipe confidence thresholds are exposed and default below
  MediaPipe's own 0.5 so an ordinary head turn no longer drops the face, losing
  the face holds the last pose instead of recentring the head (`onFaceLost`
  restores the old behaviour), and head pose is rate limited to 360 degrees per
  second so the estimate breaking down at the edge of frame cannot slam a
  parameter to its rail for a frame.
- `poseFromMatrix` normalizes the rotation basis. MediaPipe fits the canonical
  face with a similarity transform, so head scale was shrinking yaw while
  leaving pitch and roll intact.
- Parameter drivers choose when they are written. The new `phase:
  'before-physics'` runs between the SDK effects and physics, so a driven head
  pose reaches the physics simulation and hair and body follow it; the default
  `'after-motion'` is unchanged. `ModelHandle.onBeforePhysicsUpdate` is
  optional, and backends without it fall back to the late phase.
- Built-in backends expose optional parameter ranges through
  `ModelInfo.parameters`; custom backends remain compatible. MediaPipe
  initialization and inference failures use the new `tracking-error` code.

### Added (0.4 scope)

- `createVolumeLipSync()` provides a React-free, SSR-safe driver that turns
  caller-sampled RMS volume into stable mouth openness with initial noise-floor
  calibration, attack/release smoothing and speaking hysteresis. Capture,
  WebAudio nodes and scheduling remain caller-owned.
- `motion()` accepts per-playback `fadeInMs` and `fadeOutMs` overrides on the
  default cubism-webgl backend without mutating the model's cached motion or
  parameter-specific motion3 fades. Invalid values and the unsupported
  repository-only pixi-v6 path fail explicitly with `invalid-props`.
- `playMotion()` reports natural completion, interruption, skipped playback or
  model disposal without changing the existing `motion(): Promise<void>`
  contract. `sequence()` pre-validates and plays ordered steps until the first
  non-completed result. Custom backends can adopt the detailed capability
  without breaking their existing `ModelHandle` implementation.
- Automatic idle playback accepts validated per-motion weights, including zero
  weights that exclude entries. Expression calls accept isolated per-playback
  `fadeInMs` and `fadeOutMs` overrides while preserving authored exp3 defaults
  and the immediate `clearExpression()` behaviour. An explicitly named idle
  group that the model lacks now rejects with `invalid-props`, matching the
  weighted form; the implicit `'Idle'` default stays lenient.

### Changed

- Motion and expression caches keep only the parsed object; the raw file is
  re-read and retained the first time a fade override needs it. Consumers who
  never override fades keep the 0.3.1 memory profile.
- The React binding validates `idleMotion` before rendering and reports a bad
  value through `onError` as `invalid-props` instead of throwing from render.

## 0.3.1 - 2026-08-21

### Fixed

- Resolver-backed sources now preserve literal spaces, CJK characters and URL
  reserved characters (`%`, `#`, `?`) in archive and browser-storage filenames.
  Relative, rooted and `./`/`../` paths keep their existing resolution rules;
  absolute URLs declared by a model still use the network.
- The React `useLive2D()` lifecycle no longer performs synchronous state writes
  from its setup effect.

### Verification

- The exact npm tarball is installed and built in isolated vanilla Vite, React
  Vite and Next.js SSR consumers before release.
- The local browser gate covers Chromium, WebKit and Firefox. A separate
  two-hour Chromium soak command checks repeated motion, recreation, Canvas
  cleanup and post-GC heap trend without slowing CI.

## 0.3.0 - 2026-08-20

### Added

- `resolveAsset`, on `createLive2D()` and `<Live2DModel>`, supplies a model's
  files from somewhere other than the network: an archive unpacked in memory,
  a browser storage layer, or any custom source. `src` then names a path
  inside that source and sibling assets resolve relative to it exactly as
  they do for a URL, including nested directories and `./`/`../`. Returning
  `undefined` fails the load naming the missing path, and never retries,
  because a file the source does not have will not appear on a second try.
  Absolute URLs a model declares are still fetched.

  Paths reach the resolver decoded, so a model whose files are named in
  Korean, Japanese or Chinese is looked up under the names it actually uses.

  Unpacking archives stays outside this package: a resolver is a function, so
  no archive dependency is imposed on someone who only wants a character on a
  page.

## 0.2.0 - 2026-08-19

### Removed

- **Breaking**: the `live2d-web/backends/pixi-v6` entry point is no longer
  published, and the Pixi packages it needed are no longer declared as
  optional peer dependencies. Declaring them put `pixi-live2d-display` and
  its transitive `gh-pages` dependency into the graph that supply-chain
  scanners read, so every install carried an advisory for a backend almost
  nobody loads. Applications that used it should either stay on 0.1.0 or
  write a backend against the public `Backend` interface, which is
  unchanged. The backend itself remains in the repository as the
  counterpart for the published benchmarks.

The default `cubism-webgl` backend, the vanilla runtime and the React
binding are untouched. `react` is now the only peer dependency.

## 0.1.0 - 2026-08-19

Initial release.

### Added

- `createLive2D()`: a React-free runtime that owns model loading, lifecycle,
  fitting, retries and cleanup for Cubism 4/5 `model3.json` models on WebGL2,
  with the official Cubism Web Framework 5-r.5 renderer as the default
  backend.
- Motions and expressions: `motion()` resolves when playback finishes and
  rejects after a render error, `expression()`/`clearExpression()`,
  `getModelInfo()` for the model's motion groups, expressions and hit areas.
- Interaction: `followPointer`, `focus()`/`focusAt()`, `hitTest()` with
  viewport client coordinates.
- Lip sync in three modes: a WebAudio node analysed by wLipSync (loaded on
  demand), a caller-provided driver, or plain values through the React
  `<LipSync>` component. No calibration profile is bundled.
- Parameter control: persistent `setParameter()`/`clearParameter()` overrides
  and per-frame `addParameterDriver()` callbacks, applied after the SDK's own
  motion update.
- Automatic render quality (capped backing buffer that steps down on long
  frames), `maxFps`, and automatic pausing for hidden tabs and offscreen
  canvases.
- React bindings at `live2d-web/react`: `<Live2DCanvas>`, `<Live2DModel>`,
  `<LipSync>` and five hooks sharing one headless controller with the vanilla
  API; React 18.2 and 19 as an optional peer.
- A Pixi v6 compatibility backend at `live2d-web/backends/pixi-v6` for A/B
  comparison and migration from `pixi-live2d-display@0.4`; all Pixi packages
  are optional peers.
- Errors with stable codes and asset details, fast failure on HTTP 4xx,
  configurable retries for transient failures, `retry()` after WebGL context
  loss, and `AbortSignal` support.

### Not included

- AI, TTS, camera tracking, Worker rendering and multi-model Canvas support
  remain outside the v0.1 scope.

### Notes for pre-release readers

- The React API was renamed from `Live2DStage` to `Live2DCanvas`, and the
  backend subpaths from `adapters/` to `backends/`, before the first release.
  No compatibility aliases exist for either.
