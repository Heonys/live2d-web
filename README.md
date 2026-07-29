# live2d-jsx

> Declarative Live2D for React.

**live2d-jsx** lets you drive [Live2D Cubism](https://www.live2d.com/) models with JSX — the way `@react-three/fiber` did for three.js. Model loading, lifecycle, lip sync, and gaze become components and hooks instead of imperative glue code. Rendering backends sit behind an adapter contract, so the fragmented lower ecosystem — an unmaintained de-facto standard and four competing forks — is absorbed rather than fought.

**Current stage: design.** There is no code yet. The design documents below (in Korean) define the contracts first; the API is being extracted from a production Live2D app, not invented on a whiteboard.

```tsx
<Live2DStage backend={pixiV6}>
  <Live2DModel src="/hiyori.model3.json" fit="upper-body">
    <LipSync source={audioNode} />
    <IdleGaze />
  </Live2DModel>
</Live2DStage>
```

## Why

Measured 2026-07-29 ([survey with reproducible commands](docs/ecosystem-survey.md)):

- The de-facto standard renderer (`pixi-live2d-display`) has been unmaintained since Dec 2023 — yet still sees ~12k weekly downloads.
- Lip sync, PixiJS v8 support, and fixes live in four separate forks that cannot be combined.
- The only existing React wrapper sees ~13 weekly downloads. The React layer is effectively empty.

## Design docs (Korean)

- [Docs index & decisions](docs/README.md)
- [Ecosystem survey](docs/ecosystem-survey.md)
- [Product vision](docs/product-vision.md)
- [Architecture](docs/architecture.md)
- [API design](docs/api-design.md)
- [Extraction map](docs/extraction-map.md)
- [Licensing](docs/licensing.md)
- [Roadmap](docs/roadmap.md)

## License & trademark

- This is an **unofficial, third-party** project — not affiliated with or endorsed by Live2D Inc. "Live2D" and "Cubism" are trademarks of Live2D Inc.
- **Cubism Core is not and will never be bundled** — its license does not permit redistribution. You load it yourself from the [official SDK](https://www.live2d.com/sdk/download/web/); the library verifies its presence and fails loudly instead of silently.
- Shipping a product built on the Cubism SDK may require Live2D's Publication License (free below ¥10M annual revenue — verify current terms on the official site).
- Library license: MIT (planned). Details: [docs/licensing.md](docs/licensing.md).
