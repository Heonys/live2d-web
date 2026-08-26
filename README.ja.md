<p align="center">
  <img src="apps/playground/public/brand/live2d-web-avatar.png" alt="" width="96" height="96">
</p>
<h1 align="center">live2d-web</h1>

[English](README.md) | [한국어](README.ko.md) | **日本語**

> Vanilla JavaScript と React 向けの非公式 Live2D Cubism ランタイムです。
> PixiJS を使わず WebGL2 で直接描画します。

**[日本語ドキュメント](https://live2d-web-demo.netlify.app/docs/ja)** ·
[Playground](https://live2d-web-demo.netlify.app/playground) ·
[モデル検査](https://live2d-web-demo.netlify.app/inspect) ·
[サンプル](examples)

## 主な機能

- Framework 5-r.5 WebGL2 アダプターによる Cubism 4・5 モデル読み込み
- React を含まない root API と任意の React binding
- motion・sequence・fade・weighted Idle・表情・pointer interaction
- 音量/wLipSync と任意の MediaPipe main/Worker 顔トラッキング（モバイル・利用者検証まで experimental）
- 明確な resource cleanup、安定した error code、tarball・browser 検証
- 任意の `live2d-web/inspect` モデル検査と `live2d-web/devtools` 操作パネル（利用者・互換性検証まで experimental）

## クイックスタート

```sh
pnpm add live2d-web
```

Cubism Core とモデルはパッケージに含まれません。Live2D の規約に従って Core
を取得・self-host し、利用権のある Cubism 4・5 モデルを配信してください。

```ts
import { createLive2D } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#avatar')!,
  coreUrl: '/live2dcubismcore.min.js',
  src: '/models/model.model3.json',
  followPointer: true,
})

await character.motion('TapBody', 0)
character.dispose()
```

```tsx
'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/model.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

host 要素には CSS のサイズが必要です。Vanilla instance は画面から外すときに
dispose します。React component は unmount 時に自動で破棄します。

## 詳細ドキュメントとサンプル

[日本語ドキュメント](https://live2d-web-demo.netlify.app/docs/ja)では Core・
モデル準備、Vanilla、React、motion・表情、lip sync、MediaPipe main/Worker、
Next SSR、mobile、troubleshooting、security・license を説明します。API
signature は公開 TypeScript source から生成した
[共通リファレンス](https://live2d-web-demo.netlify.app/docs/ja/api)を使います。

repository の Vite Vanilla・Next React・Vue Vite・透明 OBS overlay の例は
CI で production build されます。

```sh
pnpm examples:build
```

## 互換性とパッケージ境界

基本検証範囲は WebGL2 対応の現在の Chromium・Firefox・WebKit、Cubism Core
5.3、Framework 5-r.5 です。詳細は[互換性表](docs/compatibility.md)を参照して
ください。

root entry に React・Framework・MediaPipe は入りません。React、MediaPipe
main/Worker、inspect、devtools、Cubism backend は別の境界です。WASM、tracking model、
Cubism Core、Live2D model は npm パッケージに含まれません。

## ライセンスとコントリビューション

live2d-web は株式会社Live2Dとは無関係の非公式ライブラリです。配布前に
[LICENSES.md](packages/live2d-web/LICENSES.md)、[ライセンス文書](docs/licensing.md)、Live2D の
[SDK ライセンス](https://www.live2d.com/ja/sdk/license/)を確認してください。

コントリビューションは [CONTRIBUTING.md](CONTRIBUTING.md) を参照して
ください。Cubism Core、ライセンスモデル、camera frame、制限された test
artifact を GitHub に添付しないでください。
