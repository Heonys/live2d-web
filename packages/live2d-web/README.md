# live2d-web

Vanilla-first Live2D with optional React bindings. See the
[project README](https://github.com/Heonys/live2d-web#readme) for API,
installation, development and licensing details.

The root entry is React-free and dynamically selects the Framework-based
WebGL2 backend. React components are exported from `/react`, the explicit
WebGL factory from `/adapters/cubism-webgl`, and the PixiJS v6 compatibility
backend from `/adapters/pixi-v6`.

This package includes the Cubism Web Framework 5-r.5 runtime and its WebGL
shaders under Live2D's license. It does not include Cubism Core, sample models,
test fixtures or a wLipSync calibration profile. See `LICENSES.md` and
`THIRD_PARTY_NOTICES.md` before redistribution.
