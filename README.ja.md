# live2d-web

[English](README.md) | [한국어](README.ko.md) | **日本語**

> モダンウェブのためのLive2Dランタイム。Cubismモデルの読み込み、モーション
> 再生、視線追従、リップシンクまで、vanilla JavaScriptでもReactでも使えます。
> PixiJSは不要です。

株式会社Live2Dとは無関係の非公式ライブラリです。本ライブラリで制作した
アプリケーションをリリースする場合、別途
[Cubism SDK のライセンス](https://www.live2d.com/ja/sdk/license/)が必要となる
ことがあります。詳細は[ライセンスドキュメント](docs/licensing.md)にあります。

**[ライブデモ](https://live2d-web-demo.netlify.app/)**: モーションを再生し、
キャラクターをタップし、マイクでリップシンクを試せます。
[インスペクター](https://live2d-web-demo.netlify.app/inspect)では自分の
`model3.json` も読み込めます。

**状態: `0.1.0`、npm には未公開です。** デフォルトバックエンドは公式 Cubism
Web Framework 5-r.5 のレンダラーを WebGL2 上でそのまま使用します。

```bash
npm install live2d-web
```

## このライブラリの特徴

- **レンダリングフレームワークが不要です。** ランタイムが WebGL2 と直接
  やり取りします。キャラクター1体のプロダクションビルドは gzip 約58KBで、
  そこに PixiJS は含まれません。
- **起動が速い。** シェーダーは必要になるまでコンパイルせず、アセットの
  ダウンロードをシェーダー処理と並行させます。実機GPUでは初回表示までの時間が
  Pixiベース比で4〜6倍短縮され、
  [定常時のフレーム性能は同等です](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)。
- **Reactを正式サポート。** コンポーネントとフックが vanilla API と同じ
  コントローラーを共有し、フレーム単位の値が React state を通ることは
  ありません。
- **最新のCubismが基準。** Cubism 5.3 Core と公式 Framework 5-r.5 の上に
  作られており、Cubism 4・5 のモデルを両方読み込めます。更新が止まった
  `pixi-live2d-display` の移行先になります。

## 必要なもの

パッケージに含まれないファイルが2つ必要です。

1. **Cubism Core** (`live2dcubismcore.min.js`)。Live2Dのクローズドソース
   エンジンです。https://www.live2d.com/sdk/download/web/ から公式Web SDKを
   ダウンロードし、ファイルを自分で配信してそのURLを `coreUrl` に渡して
   ください。手早く試すにはLive2Dのホスト版を指す `OFFICIAL_CUBISM_CORE_URL`
   定数も使えます。本番ではセルフホストを推奨します。
2. **モデルのディレクトリ。** `model3.json` は `.moc3`、テクスチャ、
   モーション、物理ファイルを相対パスで参照するため、ディレクトリごと静的
   ファイルとして配信し（例: `public/models/hiyori/`)、`model3.json` のURLを
   `src` に渡します。

## クイックスタート

Vanilla:

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL,
  src: '/models/hiyori/hiyori.model3.json',
  fit: 'upper-body',
  followPointer: true,
})
```

React:

```tsx
'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Character() {
  return (
    <Live2DCanvas coreUrl="/assets/live2dcubismcore.min.js">
      <Live2DModel src="/models/hiyori/hiyori.model3.json" followPointer />
    </Live2DCanvas>
  )
}
```

`createLive2D()` の promise はキャラクターが画面に表示されてから resolve
します。コンテナにCSSサイズを与えると、キャンバスがそれを満たします。

## モーションと表情

`motion()` は再生が実際に終わったときに resolve します。別のモーションに
割り込まれて中断された場合も含みます。そのため `await` だけで連続演出を
組めます。アイドル再生はモデルの `Idle` グループが自動で担い、`idleMotion`
オプションで別のグループを指定するか、`false` で無効化できます。

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // グループ内でランダム
await character.motion('Tap@Body', 1) // インデックス指定
await character.motion('Idle', 0, { priority: 'normal' }) // 再生中を中断しない

await character.expression('smile')
character.clearExpression()
```

優先度は `'idle' | 'normal' | 'force'` で、デフォルトは `'force'`（何でも
中断して再生）。存在しないグループ名や表情名を渡すと、利用可能な名前の一覧を
含むエラーで reject されます。

## 視線追従とタップ

`followPointer: true` を指定すると、ポインターがキャンバス上にある間は
キャラクターがポインターを見つめ、離れると視線が中央に戻ります。手動で制御
する場合は、ビューポート座標を受け取る `focusAt()` と、コンテナ基準のCSS
ピクセルを受け取る `focus()` があります。`hitTest()` はクリック位置にある
モデルのヒットエリア名を返します。

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

Reactでは prop 2つで同じことができ、これらの prop はトグルしてもモデルを
再読み込みしません。

```tsx
<Live2DModel
  src="/models/hiyori/hiyori.model3.json"
  followPointer
  onTap={(areas) => {
    if (areas.includes('Body'))
      controller?.motion('Tap@Body')
  }}
/>
```

## リップシンク

口を動かす方法は3通りあります。いずれもSDKのモーション更新の後に値を書き込む
ため、モーションカーブに上書きされることはありません。

**オーディオノードから**（wLipSyncによる母音分析、必要時に動的ロード）:

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // TTS出力などのWebAudioノード
  profile: '/lipsync/profile.bin', // wLipSyncのキャリブレーションプロファイル
  isSpeaking: () => isPlaying,
})
```

**自作のアナライザーから**（0〜1の口の開き具合を返すロジックなら何でも）:

```ts
character.addLipSync({
  driver: {
    getMouthOpen: () => currentVolume,
    isSpeaking: () => currentVolume > 0,
  },
})
```

**値を直接、React専用**（すでにstateに値があるなら最も簡単）:

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

対象パラメータのデフォルトは `ParamMouthOpenY` で、`parameterId` で変更でき
ます。ライブラリが呼び出し側の `AudioContext` を閉じたり中断したりすることは
なく、キャリブレーションプロファイルも同梱しません。

## パラメータの直接制御

`setParameter()` は持続するオーバーライドです。`clearParameter()` で解除する
まで、毎フレーム、モーションカーブより優先されます。毎フレーム計算し直す値
なら、代わりにドライバーを登録してください。SDKの更新が終わるたびに
ライブラリが値を読み取ります。

```ts
character.setParameter('ParamMouthOpenY', 0.6) // 口を開けたままにする
character.clearParameter('ParamMouthOpenY') // 再びモーションが制御

const stop = character.addParameterDriver('ParamAngleX', {
  getValue: () => Math.sin(performance.now() / 300) * 30,
})
```

Reactでは `useLive2DParameter(id, value)` がオーバーライドを（アンマウント時に
自動で解除）、`useParameterDriver(id, getter)` がフレーム単位のドライバーを
担当します。

## フィッティングと描画品質

`fit` はモデルファイルに手を入れずに構図を決めます。`'upper-body'`（デフォルト）、
`'full'`、または `{ scale, offsetX, offsetY }` を直接指定でき、実行中は
`setFit()` で変更します。

描画品質はデフォルトで自動です。バッキングバッファは `devicePixelRatio` に
追従しつつ上限があり（モバイル1.5MP、デスクトップ4MP）、フレームが長引くと
解像度を一段ずつ下げます。固定の `resolution` を渡すと自動調整が無効になり、
`maxFps` でフレーム上限を設定できます。タブが非表示になると描画は自動で
止まり、キャンバスが画面外にスクロールされたときも止まります
（`pauseWhenOffscreen: false` で無効化できます）。

```ts
const character = await createLive2D({
  // ...
  fit: 'full',
  maxFps: 30,
  pauseWhenOffscreen: false, // キャプチャ用途などで描画を続けたいとき
})
```

## 状態・エラー・後片付け

`getState()` は `{ status, loadingStage, error, render }` を返し、
`subscribe()` は状態が変わるたびに通知します。エラーには安定した `code`
（`'core-missing'`、`'model-load-failed'`、`'render-error'` など）とアセット
情報が含まれます。HTTP 4xx はリトライせず即座に失敗し、一時的な失敗は
デフォルトで2回リトライします（`retries`）。WebGLコンテキスト喪失のような
描画エラーの後は、`retry()` がステージ全体を作り直します。

```ts
const character = await createLive2D({
  // ...
  onError: error => console.warn(error.code, error.message),
})

const unsubscribe = character.subscribe(() => {
  console.log(character.getState().status) // 'loading' | 'ready' | 'error'
})

character.pause() // モーダル表示中など
character.resume()
character.dispose() // モデル・キャンバス・GLコンテキストを解放。2回呼んでも安全
```

読み込みの中断は、標準の `AbortSignal` を `signal` オプションに渡すだけです。

## React早見表

すべて `live2d-web/react` にあります。React は optional peer（18.2と19を
サポート）で、ルートのインポートに React コードは一切含まれません。

| `<Live2DCanvas>` prop                  | 役割                                                     |
| -------------------------------------- | -------------------------------------------------------- |
| `coreUrl`                              | Cubism Core スクリプトのURL（ロード済みなら省略可）      |
| `quality` / `resolution`               | 自動品質（デフォルト）または固定のバッファ倍率           |
| `maxFps`, `pauseWhenOffscreen`         | フレーム上限と画面外での一時停止                         |
| `backend`                              | レンダラーバックエンド。レンダー間で同じ値を保つこと     |
| `fallback`, `errorFallback`, `onError` | ローディングUI、リトライ付きエラーUI、エラーコールバック |

| `<Live2DModel>` prop                  | 役割                                                           |
| ------------------------------------- | -------------------------------------------------------------- |
| `src`, `fit`, `idleMotion`, `retries` | モデルURLと読み込み時オプション                                |
| `followPointer`, `paused`, `onTap`    | インタラクションのトグル。変更してもモデルを再読み込みしません |
| `onLoad`, `onError`                   | コントローラーの受け取りとエラーコールバック                   |

| フック                           | 役割                                                                                            |
| -------------------------------- | ----------------------------------------------------------------------------------------------- |
| `useLive2DModel()`               | `onLoad` が渡すものと同じコントローラー（モーション・表情・フォーカス・パラメータ・モデル情報） |
| `useLive2DCanvas()`              | ステージ状態: `status`、`loadingStage`、`error`、描画情報                                       |
| `useLive2DParameter(id, value)`  | 宣言的なパラメータオーバーライド。解除は自動                                                    |
| `useParameterDriver(id, getter)` | フレーム単位のパラメータドライバー                                                              |
| `useLive2D(options)`             | vanilla インスタンスをReactのライフサイクルで管理（StrictMode安全）                             |

`<LipSync>` は3つのモードのうち、ちょうど1つだけを受け取ります: `driver`、
`source`/`active`/`profile`、または `mouthOpen`/`speaking`。

## バックエンドの切り替え

`backend` を省略するとデフォルトの Framework/WebGL2 アダプターがロードされ
ます。`pixi-live2d-display` から移行する際のA/B比較用に Pixi v6 アダプターも
ありますが、Pixi のパッケージ群は optional peer なので、使わなければ
インストールされません。

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/backends/cubism-webgl'
import { pixiV6 } from 'live2d-web/backends/pixi-v6'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

## トラブルシューティング

- **何も表示されないのに状態は ready**: コンテナにCSSサイズがなく、キャンバス
  が 1x1 に潰れています（コンソールに警告が出ます）。コンテナに幅と高さを
  与えてください。
- **モデルが404**: モデルのディレクトリを静的ファイルとして配信する必要が
  あります。すべてのアセットは model3.json のURL基準の相対パスでロードされ
  ます。HTTP 4xx はリトライせず即座に失敗します。
- **キャラクター複数で重い**: キャンバスごとにWebGLコンテキストと描画ループが
  1つずつ生まれます。ブラウザのコンテキスト上限は8〜16程度なので、キャンバス
  数を減らしてください。
- **モバイルでドラッグするとページがスクロールする**: キャンバスには
  `touch-action: none` が設定されますが、スクロールする祖先要素にも必要な
  場合があります。

## 開発

Node 24 と pnpm が必要です。

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets   # 案内される規約を確認のうえCoreとサンプルモデルを取得
pnpm dev

pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm verify:package
```

ダウンロードしたアセットは gitignore された開発パスにのみ保存され、
パッケージに含まれることはありません。Playground は `/` にReactデモ、
`/vanilla` に vanilla API、`/inspect` にモデルインスペクター、`/compare` に
WebGL/Pixi 比較画面を提供します。ベンチマークは
[ベンチマークガイド](docs/benchmarking.md)にまとめています。

## ドキュメント

[ドキュメントマップ](docs/README.md)から始めてください。主なドキュメント:

- [APIリファレンス](docs/api-design.md)
- [アーキテクチャ](docs/architecture.md)
- [ライセンス](docs/licensing.md)
- [ベンチマークガイド](docs/benchmarking.md)、
  [WebGL vs Pixi v6 の結果](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)、
  [実機GPUでの起動コスト](docs/benchmarks/2026-08-18-hardware-matrix.md)

## ライセンスと商標

プロジェクト自体のソースはMITライセンスです。同梱される Cubism Web Framework
とシェーダーは Live2D のライセンスに従います。パッケージのライセンス詳細と
変更した Framework ファイルの一覧は
[LICENSES.md](packages/live2d-web/LICENSES.md) と
[THIRD_PARTY_NOTICES.md](packages/live2d-web/THIRD_PARTY_NOTICES.md) に
記録されています。

本プロジェクトは非公式のサードパーティプロジェクトです。株式会社Live2Dが
開発・提供する公式製品ではなく、同社が開発に関与した製品でもありません。
Live2D および Cubism は株式会社Live2Dの商標です。`live2d-web` は Cubism Core、
サンプルモデル、リップシンクプロファイルを同梱しません。

本ライブラリで制作したアプリケーション等は、その内容や事業者規模等に応じて、
別途 Live2D Cubism SDK の出版許諾契約が必要となる場合があります。
[Live2D Cubism SDK のライセンス条件](https://www.live2d.com/ja/sdk/license/)と
[ライセンスドキュメント](docs/licensing.md)をご確認ください。
