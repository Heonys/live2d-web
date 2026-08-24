# Security verification

Status: 2026-08-24.

The published npm artifact and this development workspace have different
dependency graphs. Security results must not combine them.

## Published `live2d-web` candidate

`pnpm verify:packed-consumers` packs the exact candidate, installs it in a
temporary vanilla project whose only production dependency is that tarball,
and runs `npm audit --omit=dev --audit-level=high`. It then builds vanilla Vite,
React Vite and Next SSR consumers. The 0.3.1 candidate reports zero production
vulnerabilities.

The public package contains `wlipsync` as its only direct runtime dependency,
plus optional React and `@mediapipe/tasks-vision` peers. MediaPipe is reachable
only from `/tracking/mediapipe` and loads dynamically. Pixi, Next and benchmark
tooling are not in its published dependency graph; `verify-package.mjs` checks
that boundary and rejects bundled `.wasm` or `.task` assets.

## Camera tracking and remote boundaries

The MediaPipe helper never calls `getUserMedia`, stores frames or landmarks,
or sends face results to an application server. It keeps only normalized
coefficients, neutral calibration and smoothing state. Applications still own
informed camera consent, track cleanup and their privacy disclosure. MediaPipe
Tasks itself documents performance/utilization metrics sent to Google, so
"on-device inference" must not be described as "no external telemetry".

WASM and model paths are explicit caller inputs. Production deployments should
self-host them and allow their origins in `connect-src`; browsers may also
require the CSP WebAssembly compilation directive supported by that browser
(commonly `'wasm-unsafe-eval'` in `script-src`). Cross-origin assets need CORS.
The package supplies no default CDN, does not fall back to another origin and
does not bundle the model.

## Repository and Playground

`pnpm audit --prod` at the workspace root currently reports eight advisories:

- `pixi-live2d-display → gh-pages` and its old glob chain: repository-only Pixi
  benchmark adapter
- `Next → sharp/postcss/nanoid`: demo Playground build dependencies

These are not shipped in the npm tarball. They remain maintenance debt rather
than being hidden with broad overrides: update or remove the owning benchmark
and Playground dependency when compatible releases exist. CI and release must
continue to run the packed-production audit so a future boundary regression
cannot inherit this exception.
