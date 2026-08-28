# Contributing to live2d-web

Thanks for helping make browser Live2D support easier to use. Start with a
small issue or proposal before changing a public API; implementation and
documentation should land together.

## Local setup

```sh
corepack enable
pnpm install
pnpm lint
pnpm typecheck
pnpm test
```

The package intentionally does not contain Cubism Core, Hiyori or another
Live2D model. To run the local browser suite, read the terms printed by the
asset command and opt in explicitly:

```sh
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
pnpm test:e2e
```

Do not commit, cache or attach downloaded Core files, sample models, MediaPipe
models, camera frames or Playwright artifacts containing them. Describe a
reproduction with paths and metadata instead. If maintainers need the exact
model, coordinate a private, licensed transfer outside a public issue.

## Before opening a pull request

- Keep the root entry React-free and SSR-safe. Heavy or optional behavior uses
  a subpath and dynamic loading.
- Preserve existing 0.x public contracts where possible. Open an issue to
  discuss deprecation and migration before changing a signature.
- Add a focused unit test. Add Playwright coverage only for behavior that needs
  a browser, renderer or lifecycle boundary.
- Run `pnpm verify:package` when exports or dependencies change. Run
  `pnpm verify:packed-consumers` when a public entry changes.
- `pnpm api:check` compares the committed reports in `etc/api/` against the
  current build. When a public export or type changes on purpose, run
  `pnpm api:update`, commit the regenerated report **in the same commit as the
  change**, and describe the change in `CHANGELOG.md` (plus a migration note
  when it breaks a caller). A regenerated report with no changelog entry is a
  silent contract change, not a fix for a red gate.
- Update the English, Korean and Japanese guide source together. `pnpm
docs:check` rejects missing localized slugs.
- Include browser, OS, bundler, Core version, editor/export version and the
  stable `Live2DError.code` in compatibility reports.

## Public API design

Public APIs belong to the smallest useful entry. The root API must not import
React, Cubism Framework, MediaPipe, archive libraries or model assets. Custom
backend fields are added as optional unless a versioned breaking change has
been accepted. Resource ownership and cleanup must be explicit and idempotent.

## Good first issue candidates

A `good first issue` should be independently testable, avoid vendor code and
public API design, name the files involved, and include an expected result.
Good candidates are a missing guide example, a reproducible error-message
improvement, a browser fixture, or a small pure helper with tests. Creating the
GitHub label remains a manual repository operation after these templates are
pushed.

## Security

Do not open a public issue for a vulnerability that exposes users or licensed
assets. Follow the private reporting instructions in `SECURITY.md` when that
file is available, or contact the maintainer through the repository profile.
