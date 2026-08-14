# Third-party notices

`live2d-web` interoperates with the following projects. Renderer-specific code
is excluded from the root static bundle.

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

- [Cubism Web Framework 5-r.5](https://github.com/Live2D/CubismWebFramework)
  and its WebGL shaders, copyright Live2D Inc., Live2D Open Software License.
  They are bundled only in the `cubism-webgl` adapter chunks/assets. The
  Framework source retains its upstream headers, and the package includes the
  upstream license and a modification record.

Live2D Cubism Core and Live2D sample models are owned and licensed by Live2D
Inc. They are not included in Git or npm and are obtained separately by the
user.
