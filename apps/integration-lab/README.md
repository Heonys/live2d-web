# live2d-web integration lab

Private consumer app for release qualification. It combines runtime features in
streaming, lifecycle, input, asset-tooling, overlay and Pixi comparison flows.
It is intentionally separate from the public Playground and is not deployed.

## Package modes

- `pnpm lab:dev` and `pnpm lab:build` resolve the registry package pinned as
  `npm:live2d-web@0.9.0`. Startup fails if it resolves to a workspace entry or a
  different version.
- `pnpm lab:dev:local` and `pnpm lab:build:local` alias public entry points to
  `packages/live2d-web/src` without changing the scenarios.

The source badge in the header is part of the test contract.

## Assets

The app reads the ignored assets owned by the Playground and does not copy them
into its build output. Download them only after accepting the upstream terms:

```sh
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
pnpm fetch-mediapipe-assets
```

Cubism Core, model files and camera frames must never be committed, cached by
CI or attached to a Playwright report.

## Browser checks

```sh
pnpm test:lab:ui       # Chromium, no licensed assets required
pnpm test:lab:smoke    # Chromium, local source and real model
pnpm test:lab:release  # npm 0.9.0, desktop + mobile projects
pnpm test:lab:deep     # local source, desktop + mobile projects
pnpm test:lab:soak     # npm 0.9.0, 30 minutes by default
```

Set `LIVE2D_LAB_SOAK_MINUTES` to shorten a local soak. CI disables screenshots,
traces and videos because those can contain licensed model responses. Test JSON
contains only package/browser versions, timings, counts and heap numbers.

Real camera and microphone buttons require an explicit user action. After a
manual run, verify that stopping the scenario turns off the device indicator,
then repeat a portrait/landscape resize in Safari and an OBS browser source.
