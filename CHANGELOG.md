# Changelog

## 0.1.0 — Unreleased

### Changed

- Renamed the unpublished React API from `Live2DStage` to `Live2DCanvas`,
  including its props, state hook and DOM data attribute. No compatibility
  aliases are provided before the first release.
- `Live2DModel.onLoad` and `useLive2DModel()` now return the same restricted
  `Live2DModelController` instead of exposing backend lifecycle methods.
- Benchmark raw results use schema v2 while the report reader remains
  compatible with schema v1.

### Added

- Read-only `Live2DError.details` for asset type, backend, final URL and HTTP
  status diagnostics.
- A Playground model Inspector for relative and CORS-enabled HTTP(S)
  `model3.json` URLs.
- Backend JS heap A/B and hardware-gated benchmark commands.
- `live2d-web/react` re-exports the types its own signatures reference, and the
  root entry exports `LipSyncProfileInput`.

### Fixed

- Prevented a long main-thread stall during initial asset setup from leaving
  frame-budget debt that temporarily rendered above `maxFps`.
- Released partially created Stage resources when React model loading fails.
- `ensureCubismCore()` no longer adopts a `<script>` the page already loaded,
  which could leave every caller for that URL pending forever. It also accepts
  an `AbortSignal` and gives up after 30 seconds.
- A `pause()` issued before the stage exists is now applied once it is created,
  and a user pause survives `retry()`. Previously a runtime that started paused
  rendered at full rate and lost `pauseWhenOffscreen` as well.
- Disposing a model whose load was still in flight no longer throws before
  releasing it, which leaked the moc3 allocation and a Framework reference.
- `motion()` promises reject on a render error instead of never settling, since
  the frame loop that resolves them never restarts.
- `<Live2DModel onError>` now receives the errors the runtime reports after
  ready, `followPointer` recentres the gaze on pointer leave, an inline
  lip-sync profile URL no longer rebuilds the AudioWorklet on every render, and
  a rebuilt runtime keeps its `paused` state.
- The pixi-v6 adapter follows the backend contract: stage-local CSS pixels for
  `focus`/`hitTest`, per-motion promise settlement, and persistent
  `setParameter` overrides.

### Not included

- AI, TTS, camera tracking, Worker rendering and multi-model Canvas support
  remain outside the v0.1 scope.
