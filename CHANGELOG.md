# Changelog

## 0.1.0-alpha.0 — Unreleased

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

### Fixed

- Prevented a long main-thread stall during initial asset setup from leaving
  frame-budget debt that temporarily rendered above `maxFps`.
- Released partially created Stage resources when React model loading fails.

### Not included

- AI, TTS, camera tracking, Worker rendering and multi-model Canvas support
  remain outside the v0.1 scope.
