# Third-party notices

`live2d-web` interoperates with the following projects. They are not bundled
in the root entry point.

- [pixi-live2d-display](https://github.com/guansss/pixi-live2d-display),
  copyright Guan, MIT License. Used by the optional PixiJS v6 adapter.
- [PixiJS](https://github.com/pixijs/pixijs), copyright PixiJS contributors,
  MIT License. Used by the optional PixiJS v6 adapter.
- [AIRI](https://github.com/moeru-ai/airi), copyright AIRI contributors,
  MIT License. Its Live2D integration informed the AIZUCHI reference
  implementation and future lip-sync design.
- [wLipSync](https://github.com/mrxz/wLipSync), copyright Noeri Huisman,
  MIT License. Dynamically loaded by the source lip-sync mode. Its runtime is
  installed as a dependency but no calibration profile is bundled.

Live2D Cubism Core, Cubism Framework and Live2D sample models are owned and
licensed by Live2D Inc. A Framework and shader review snapshot is present only
under `private/` in the private repository, retaining Live2D's license and
copyright headers. It is excluded from the npm package and may not be publicly
redistributed without written permission. Cubism Core and sample models are
not included in Git or npm and are obtained separately by the user.
