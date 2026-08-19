# live2d-web

[English](README.md) | [한국어](README.ko.md) | **日本語**

> ウェブでLive2Dキャラクターを動かすためのライブラリです。モデルを読み込んで、
> モーション再生、視線追従、リップシンクまで扱えます。PixiJSなしで動き、
> Reactは使っても使わなくても構いません。

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

- 下に PixiJS がいません。ランタイムが WebGL2 と直接やり取りするので、
  キャラクター1体が gzip で58KBほどに収まります。
- 起動が速いです。シェーダーは必要になるまでコンパイルせず、ダウンロードを
  コンパイルと並行させることで、実機GPUでは初回表示までの時間がPixiベース比で
  4〜6倍縮まりました。
  [定常時のフレーム性能は同等です](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)。
- Reactサポートはラッパーではありません。コンポーネントとフックが vanilla API
  と同じコントローラーを動かし、フレーム単位の値が React state を通ることは
  ありません。
- Cubism 5.3 Core と公式 Framework 5-r.5 を前提に作られていて、Cubism 4・5 の
  モデルをどちらも読み込めます。更新が止まった `pixi-live2d-display` の
  乗り換え先として使えます。

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

promise はキャラクターが画面に表示されてから resolve します。コンテナにCSS
サイズを与えれば、キャンバスがそれを満たします。レイアウトの約束はこれだけです。

## モーションと表情

まず、モデルに何が入っているかを聞いてみてください。

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // グループ内でランダム
await character.motion('Tap@Body', 1) // インデックス指定
await character.motion('Idle', 0, { priority: 'normal' }) // 再生中を中断しない

await character.expression('smile')
character.clearExpression()
```

モーションの promise は再生が本当に終わったときに resolve します。開始時では
ありません。なので連続演出は `await` して次を再生するだけです。途中で別の
モーションに割り込まれた場合はその時点で resolve するため、待ち続けることは
ありません。

アイドル再生はモデルの `Idle` グループが勝手に担当します。別のグループを
使いたければ `idleMotion` で指定し、`false` を渡せば止まります。優先度は
`'idle' | 'normal' | 'force'` の3段階で、デフォルトの `'force'` は再生中の
モーションを中断して入ります。存在しないグループ名や表情名を渡すと、使える
名前の一覧を含むエラーが返ってきます。

## 視線追従とタップ

`followPointer: true` ひとつで、キャラクターはキャンバス上のポインターを目で
追い、ポインターが離れると視線が中央に戻ります。タップ処理はヒットテスト
1回で済みます。

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

視線を手動で動かすメソッドは2つあります。`focusAt()` はビューポート座標を、
`focus()` はコンテナ基準のCSSピクセルを受け取ります。

Reactなら prop 2つで同じことができます。これらの prop は変更してもモデルを
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

口を動かす方法は3つあります。音声がどこにあるかで選んでください。どれもSDKの
モーション更新の後に値を書き込むので、モーションカーブに上書きされる心配は
ありません。

WebAudioノード（TTS出力やマイク）があるなら、wLipSyncに母音分析を任せます。
アナライザーは必要になったときに動的にロードされます。

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // TTS出力などのWebAudioノード
  profile: '/lipsync/profile.bin', // wLipSyncのキャリブレーションプロファイル
  isSpeaking: () => isPlaying,
})
```

口の開き具合を自分で計算したいなら、0〜1の値を返すロジックをそのまま渡せば
動きます。

```ts
character.addLipSync({
  driver: {
    getMouthOpen: () => currentVolume,
    isSpeaking: () => currentVolume > 0,
  },
})
```

Reactでは値を直接渡すこともできます。値がすでに state にあるなら、これが
いちばん簡単です。

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

対象パラメータのデフォルトは `ParamMouthOpenY` で、`parameterId` で変更でき
ます。ライブラリが呼び出し側の `AudioContext` を閉じたり止めたりすることは
なく、キャリブレーションプロファイルも入っていません。

## パラメータの直接制御

モーションが何と言おうと、特定のパラメータをある値に固定したいことがあります。
それが `setParameter()` です。`clearParameter()` で解除するまで、毎フレーム
モーションカーブに勝ちます。毎フレーム計算し直す値なら、代わりにドライバーを
登録してください。SDKの更新が終わるたびにライブラリが値を読み取ります。

```ts
character.setParameter('ParamMouthOpenY', 0.6) // 口を開けたままにする
character.clearParameter('ParamMouthOpenY') // 再びモーションが制御

const stop = character.addParameterDriver('ParamAngleX', {
  getValue: () => Math.sin(performance.now() / 300) * 30,
})
```

React側の対応物は `useLive2DParameter(id, value)`（オーバーライド、
アンマウント時に自動解除）と `useParameterDriver(id, getter)`（フレーム単位の
ドライバー）です。

## フィッティングと描画品質

`fit` はモデルファイルに手を入れずに構図を決めます。`'upper-body'`（デフォルト）、
`'full'`、または `{ scale, offsetX, offsetY }` を直接指定でき、実行中は
`setFit()` で変更します。

描画品質は基本的に放っておいて大丈夫です。バッキングバッファは
`devicePixelRatio` に追従しつつ上限があり（モバイル1.5MP、デスクトップ4MP）、
フレームが長引くと解像度を一段ずつ下げます。ほとんどのアプリはこのままで
十分です。固定したい場合は `resolution` を直接指定し、フレーム上限は `maxFps`
で設定します。非表示のタブと画面外にスクロールされたキャンバスは自動で
止まります。

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
（`'core-missing'`、`'model-load-failed'`、`'render-error'` など）と、問題に
なったアセットの情報が付いています。

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

知っておくと役立つ挙動をいくつか。HTTP 4xx はリトライせず即座に失敗し、
一時的な失敗はデフォルトで2回リトライします。WebGLコンテキスト喪失のような
描画エラーの後は `retry()` がステージ全体を作り直します。読み込みの中断は
標準の `AbortSignal` を `signal` に渡すだけです。

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

`backend` を省略すればデフォルトの Framework/WebGL2 バックエンドが使われます。
もうひとつ Pixi v6 バックエンドがあり、こちらはA/B比較と
`pixi-live2d-display` からの移行のために残してあるものです。Pixi の
パッケージ群は optional peer なので、実際に使うまでインストールされません。

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/backends/cubism-webgl'
import { pixiV6 } from 'live2d-web/backends/pixi-v6'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

## トラブルシューティング

- 何も表示されないのに状態は ready のとき: コンテナにCSSサイズがなく、
  キャンバスが 1x1 に潰れています。コンテナに幅と高さを与えてください。この
  ときコンソールにも警告が出ます。
- モデルが404のとき: モデルのディレクトリが静的ファイルとして配信されているか
  確認してください。すべてのアセットは model3.json のURL基準の相対パスで
  ロードされ、HTTP 4xx はリトライせず即座に失敗します。
- キャラクターを複数出したら重いとき: キャンバスごとにWebGLコンテキストと
  描画ループが1つずつ生まれ、ブラウザのコンテキスト上限は8〜16程度です。
  キャンバスの数を減らすのが解決策です。
- モバイルでドラッグするとページがスクロールするとき: キャンバスには
  `touch-action: none` が設定されますが、スクロールする祖先要素にも同じ設定が
  必要な場合があります。

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
