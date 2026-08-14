# Third-party notices

- pixi-live2d-display, copyright Guan, MIT License.
- PixiJS, copyright PixiJS contributors, MIT License.
- AIRI, copyright AIRI contributors, MIT License. Reference implementation.
- wLipSync, copyright Noeri Huisman, MIT License. Source-mode dependency;
  calibration profiles are not included.
- Cubism Web Framework 5-r.5 and its WebGL shaders, copyright Live2D Inc.,
  Live2D Open Software License. `live2d-web` modifies shader loading so model
  readiness waits for fetch, empty-source, compile and link failures; it also
  adds per-WebGL-context shader/offscreen cleanup required by Stage disposal.

## Cubism Web Framework modification record

Behavioral modifications are limited to:

- `src/rendering/cubismshader_webgl.ts`: Promise-based shader readiness,
  bundled-source support, explicit HTTP/empty/compile/link failures and
  per-context release.
- `src/rendering/cubismrenderer_webgl.ts`: await shader readiness, inject
  bundled sources, release renderer-owned WebGL resources and reuse the
  adapter-provided framebuffer/viewport instead of synchronous per-frame
  WebGL state queries. Drawing also skips the original fire-and-forget shader
  readiness check because adapter model initialization already awaited it.
- `src/rendering/cubismoffscreenmanager.ts`: release offscreen targets owned by
  a disposed Stage.
- `src/physics/cubismphysics.ts`: write physics output directly to its target
  parameter instead of allocating and copying the unchanged tail of the
  parameter array for every output on every physics tick. Per-sub-rig
  input/output/particle views are cached once after parsing instead of sliced
  again during every evaluation.

Several Framework files also use TypeScript `import type` declarations so the
vendored source can be bundled under `verbatimModuleSyntax`. These changes do
not alter Framework runtime behavior. Project-owned `core-compat.d.ts` contains
only the minimal ambient Core surface required to typecheck the Framework; the
official Core implementation and official Core type file are not included.

Live2D Cubism Core and Live2D sample models are not included in this package.
Live2D and Cubism are trademarks of Live2D Inc. The Framework and shader files
retain their original copyright and license headers.
