# Security verification

Status: 2026-08-24.

The published npm artifact and this development workspace have different
dependency graphs. Security results must not combine them.

## Published `live2d-web` candidate

`pnpm verify:packed-consumers` packs the exact candidate, installs it in a
temporary vanilla project whose only production dependency is that tarball,
and runs `npm audit --omit=dev --audit-level=high`. It then builds vanilla Vite,
React Vite and Next SSR consumers. The 0.5.0 artifact reports zero production
vulnerabilities.

The public package contains `wlipsync` as its only direct runtime dependency,
plus optional React and `@mediapipe/tasks-vision` peers. MediaPipe is reachable
only from `/tracking/mediapipe` and its `/worker` entry, and loads dynamically. Pixi, Next and benchmark
tooling are not in its published dependency graph; `verify-package.mjs` checks
that boundary in both the root and React bundles, and rejects any `.bin`,
`.json`, `.task` or `.wasm` file in `dist/` as well as the asset names inside
the tracking entry.

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
does not bundle the model. Worker deployments must also allow the application
worker URL in `worker-src` (normally `worker-src 'self'`; add `blob:` only when
the application deliberately creates blob workers). The worker resolves
relative WASM and model paths against the main document URL, so both resources
still need the same CORS and CSP permissions. Prefer self-hosting them.

## Repository and Playground

The public `/inspect` page opens zip files entirely in the current browser tab.
JSZip loads only after the user selects a file. Before extraction, the app
checks the compressed size (256 MiB), central-directory entry count (2,048),
declared expanded size (768 MiB), root-escaping paths and duplicate normalized
paths. The expanded byte total is checked again while reading. It does not
upload, persist or send telemetry about the archive.

The library inspector uses lower model limits: 64 MiB per asset, 256 MiB total
and 2,048 references by default. A resolver-backed local model that declares an
external URL receives an error finding and no network request. URL inspection
fetches HTTP(S) references, warns about cross-origin assets and still requires
their server to allow CORS. In Node there is no browser CORS or private-network
boundary, so a server accepting untrusted model URLs must enforce its own host
allow-list and network policy. The inspector does not block private IP ranges.
Incompatible reports never create a Canvas; warning-only reports require an
explicit render action.

Documentation API JSON contains TypeScript metadata only. Core, Hiyori,
MediaPipe models, local zip contents and Playwright traces remain excluded from
the site artifact and repository.

The optional Devtools diagnostic copies public runtime and model metadata plus
current parameter values. It deliberately excludes model URLs, asset bytes,
camera frames, face landmarks and audio. Devtools never starts capture,
tracking, network requests or telemetry; applications still decide where a
copied diagnostic is sent.

`pnpm audit --prod` at the workspace root currently reports eight advisories:

- `pixi-live2d-display → gh-pages` and its old glob chain: repository-only Pixi
  benchmark adapter
- `Next → sharp/postcss/nanoid`: demo Playground build dependencies

These are not shipped in the npm tarball. They remain maintenance debt rather
than being hidden with broad overrides: update or remove the owning benchmark
and Playground dependency when compatible releases exist. CI and release must
continue to run the packed-production audit so a future boundary regression
cannot inherit this exception.
