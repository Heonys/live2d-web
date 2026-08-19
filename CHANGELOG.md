# Changelog

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
