<p align="center">
  <img src="apps/playground/public/brand/live2d-web-avatar.png" alt="live2d-web" width="64" height="64">
</p>

<p align="center">
  JavaScript と React 向けの非公式 Live2D Cubism ランタイムです。<br>
  PixiJS を使わず WebGL2 で直接描画します。
</p>

<p align="center">
  <strong><a href="https://live2d-web.heonys.dev/docs/ja">日本語ドキュメント</a></strong> ·
  <a href="https://live2d-web.heonys.dev/ja/playground">Playground</a> ·
  <a href="https://live2d-web.heonys.dev/ja/inspect">モデル検査</a> ·
  <a href="examples">サンプル</a> ·
  <a href="https://live2d-web.heonys.dev/docs/ja/pixi-live2d-display">pixi からの移行</a>
</p>

<p align="center">
  <a href="README.md">English</a> · <a href="README.ko.md">한국어</a> · <strong>日本語</strong>
</p>

## 主な機能

- Framework 5-r.5 アダプター経由で Cubism 3/4/5 のモデルを読み込み、WebGL2 で
  直接描画
- バニラ JavaScript のランタイムと、React コンポーネントおよびフック
- モーション、シーケンス、フェード、重み付き Idle、表情、ポインター操作
- 1つのキャンバスに複数のモデル、WebGL コンテキストを共有
- 音量と wLipSync のリップシンク、MediaPipe の顔トラッキング（experimental）
- devtools パネル、およびモデルレポートと配置オーバーレイ（どちらも experimental）

## クイックスタート

```sh
pnpm add live2d-web
```

Cubism Core とモデルはパッケージに含まれません。Live2D の規約に従って Core
を取得・self-host し、利用権のある Cubism 3/4/5 モデルを配信してください。

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
import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/model.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

host 要素には CSS のサイズが必要です。JavaScript instance は画面から外すときに
dispose します。React component は unmount 時に自動で破棄します。

`pixi-live2d-display` を使っているなら
[pixi-live2d-display からの移行](https://live2d-web.heonys.dev/docs/ja/pixi-live2d-display)を
見てください。関数の対応表と、Pixi に留まるほうがよい場合をまとめています。

## Live2D Devtools

`live2d-web/devtools` は読み込んだモデルにパネルを取り付け、そのモデルが実際に
宣言しているものを一覧します。パラメーター、モーショングループ、表情、ヒット
エリアです。パラメーターをドラッグすればモデルがすぐ応えるので、他人が書き出した
モデルを当て推量で扱わずに済みます。

<p align="center">
  <img src="apps/playground/public/brand/demo-devtools.webp" alt="devtools パネルでパラメーターをドラッグし、モデルが応える画面" width="860">
</p>

## 詳細ドキュメントとサンプル

[日本語ドキュメント](https://live2d-web.heonys.dev/docs/ja)では Core・
モデル準備、JavaScript、React、motion・表情、lip sync、MediaPipe main/Worker、
Next SSR、mobile、troubleshooting、security・license を説明します。API
signature は公開 TypeScript source から生成した
[共通リファレンス](https://live2d-web.heonys.dev/docs/ja/api)を使います。

repository の Vite JavaScript・Next React・Vue Vite・透明 OBS overlay の例は
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
