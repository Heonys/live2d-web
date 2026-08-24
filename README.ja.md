# live2d-web

[English](README.md) | [한국어](README.ko.md) | **日本語**

> Live2Dキャラクターをウェブ画面に表示するためのランタイムです。PixiJSに
> 依存せず、vanilla JavaScriptとReactのどちらからも同じAPIでモーション、
> 視線追従、リップシンクを扱えます。

株式会社Live2Dとは無関係の非公式ライブラリです。本ライブラリで制作した
アプリケーションをリリースする場合、別途
[Cubism SDK のライセンス](https://www.live2d.com/ja/sdk/license/)が必要となる
ことがあります。詳細は[ライセンスドキュメント](docs/licensing.md)にあります。

**[ライブデモ](https://live2d-web-demo.netlify.app/)** ·
[モデルインスペクター](https://live2d-web-demo.netlify.app/inspect)

## 特徴

- 軽量です。レンダリングフレームワークなしでWebGL2に直接描画し、
  キャラクター1体で gzip 約58KBです。
- キャラクターの表示が速く、実機GPUで初回表示までの時間が4〜6倍短く
  なっています（[測定](docs/benchmarks/2026-08-18-hardware-matrix.md)）。
  [フレーム性能は pixi-live2d-display と
  同等です](docs/benchmarks/2026-08-18-cubism-webgl-vs-pixi-v6.md)。
- Reactにそのまま対応し、vanillaと同じ機能をコンポーネントとフックで
  使えます。
- 最新の Cubism 5.3 が基準で、Cubism 4・5 のモデルに対応します。更新が
  止まった `pixi-live2d-display` の代わりに使えます。

## はじめに

```bash
npm install live2d-web
```

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

promise はキャラクターが画面に表示されてから resolve します。コンテナに
CSSサイズを与えると、キャンバスがそれを満たします。

## モーションと表情

モーショングループ、表情、ヒットエリアの一覧は `getModelInfo()` で取得
します。

```ts
const info = character.getModelInfo()
// { motions: { Idle: 3, 'Tap@Body': 2 }, expressions: [...], hitAreas: [...] }

await character.motion('Tap@Body') // グループ内でランダム
await character.motion('Tap@Body', 1) // インデックス指定
await character.motion('Idle', 0, { priority: 'normal' }) // 再生中を中断しない
await character.motion('Tap@Body', 0, { fadeInMs: 250, fadeOutMs: 400 })

await character.expression('smile')
character.clearExpression()
```

`motion()` は再生が終わった時点で resolve するため、`await` だけで連続
演出を組めます。別のモーションに割り込まれた場合はその時点で resolve し、
WebGLコンテキスト喪失のような描画エラーの後は reject します。

`fadeInMs` と `fadeOutMs` は、その再生に限ってモーション全体のフェードを
ミリ秒単位で上書きします。値は0以上の有限数で、`0` は該当フェードを即時に
します。省略した値は model3/motion3 の既定値を維持し、motion3 に記録された
パラメータ別フェードもそのまま保たれます。

アイドル再生はモデルの `Idle` グループが自動で行います。`idleMotion` で別の
グループを指定でき、`false` で無効になります。優先度は
`'idle' | 'normal' | 'force'` の3段階で、デフォルトの `'force'` は再生中の
モーションを中断します。存在しないグループ名や表情名を渡すと、有効な名前の
一覧を含むエラーで reject されます。

## 視線追従とタップ

`followPointer: true` を指定すると、キャラクターはキャンバス上のポインター
を目で追い、ポインターが離れると視線が中央に戻ります。

```ts
container.addEventListener('click', async (event) => {
  const areas = character.hitTest(event.clientX, event.clientY)
  if (areas.includes('Body'))
    await character.motion('Tap@Body')
})
```

視線を直接制御するメソッドは2つあります。`focusAt()` はビューポート座標、
`focus()` はコンテナ基準のCSSピクセルを受け取ります。

Reactでは prop 2つで同じ配線になります。これらの prop は変更してもモデルを
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

リップシンクは3つの方式に対応しています。いずれもSDKのモーション更新の後に
値を書き込むため、モーションカーブに上書きされません。

WebAudioノード（TTS出力やマイク）をwLipSyncの母音分析につなぐ方式。
アナライザーは必要時に動的にロードされます。

```ts
const stopLipSync = character.addLipSync({
  source: audioNode, // TTS出力などのWebAudioノード
  profile: '/lipsync/profile.bin', // wLipSyncのキャリブレーションプロファイル
  isSpeaking: () => isPlaying,
})
```

マイクなどRMS音量を取得できる入力では、組み込みドライバーがノイズフロアの
補正、平滑化、発話ヒステリシスを処理します。キャプチャ、RMS計算、フレームの
スケジューリングは引き続きアプリケーションが所有します。

```ts
import { createVolumeLipSync } from 'live2d-web'

const volume = createVolumeLipSync()
const stopLipSync = character.addLipSync({ driver: volume })

// キャプチャフレームごとに1回。elapsedMsはキャプチャ開始後の経過時間です。
volume.sample(rms, elapsedMs)
```

`getMouthOpen()` と `isSpeaking()` を実装した独自ドライバーもそのまま利用
できます。

React専用として、値を直接渡す方式。

```tsx
<LipSync mouthOpen={mouth} speaking={mouth > 0} />
```

対象パラメータのデフォルトは `ParamMouthOpenY` で、`parameterId` で変更
できます。ライブラリが呼び出し側の `AudioContext` を閉じたり中断したりする
ことはなく、キャリブレーションプロファイルも同梱しません。
`createVolumeLipSync()` 自体はReact、WebAudio、ブラウザのグローバルを使用
しません。

## パラメータの直接制御

`setParameter()` は持続的なオーバーライドです。`clearParameter()` を呼ぶ
まで、毎フレーム、モーションカーブより優先されます。毎フレーム計算し直す値は
ドライバーとして登録します。SDKの更新が終わるたびにライブラリが値を読み
取ります。

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

## 構図と描画品質

`fit` はモデルファイルに手を入れずに構図を決めます。`'upper-body'`（デフォルト）、
`'full'`、または `{ scale, offsetX, offsetY }` を直接指定でき、実行中は
`setFit()` で変更します。

描画品質はデフォルトで自動です。バッキングバッファは `devicePixelRatio` に
追従しつつ上限があり（モバイル1.5MP、デスクトップ4MP）、フレームが長引くと
解像度を一段ずつ下げます。固定する場合は `resolution` を指定し、フレーム上限
は `maxFps` で設定します。非表示のタブと画面外にスクロールされたキャンバスは
自動で停止します。

```ts
const character = await createLive2D({
  // ...
  fit: 'full',
  maxFps: 30,
  pauseWhenOffscreen: false, // キャプチャ用途などで描画を続けたいとき
})
```

## ライフサイクルとエラー処理

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
  console.log(character.getState().status) // 'loading' | 'ready' | 'error' | 'disposed'
})

character.pause() // モーダル表示中など
character.resume()
character.dispose() // モデル・キャンバス・GLコンテキストを解放。2回呼んでも安全
```

HTTP 4xx はリトライせず即座に失敗し、一時的な失敗はデフォルトで2回
リトライします（`retries`）。WebGLコンテキスト喪失のような描画エラーの後は
`retry()` がステージを作り直します。読み込みの中断は `AbortSignal` を
`signal` に渡します。

## React APIまとめ

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
| `resolveAsset`                        | モデルのファイルを fetch せずに供給                            |
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

## バックエンド

`backend` を省略するとデフォルトの Framework/WebGL2 バックエンドが使われ
ます。パッケージが同梱するバックエンドはこれだけで、シェーダーを自分で
ホストする場合は明示的に渡します。

```ts
import { createCubismWebGLBackend, cubismWebGL } from 'live2d-web/backends/cubism-webgl'

const custom = createCubismWebGLBackend({ shaderBaseUrl: '/live2d-shaders/' })
```

Pixi v6 バックエンドは上のベンチマークの比較対象としてリポジトリにのみ
あり、公開はしていません。ほとんど使われない経路のために、すべての
インストールの依存グラフに Pixi が入ってしまうためです。`Backend`
インターフェースは公開されているので、パッケージの外で実装できます。

## モデルのソース

既定では `src` は URL で、モデルのファイル群はその位置を基準に読み込まれ
ます。ユーザーが選んだアーカイブのようにモデルがサーバー上にない場合は
`resolveAsset` を渡します。そのとき `src` はソース内のパスになります。

```tsx
// 展開結果やストレージから詰める
const files = new Map<string, Blob>()

export function Character() {
  return (
    <Live2DModel
      src="hiyori/hiyori.model3.json"
      resolveAsset={path => files.get(path)}
    />
  )
}
```

resolver はモデルが宣言した各ファイルについて呼ばれます。パスは `src` を
基準に解決済みで（入れ子のディレクトリ、`./` と `../` を含む）、デコード
済みなので、韓国語・日本語・中国語のファイル名もそのまま届きます。
`undefined` を返すとそのパスを示して読み込みが失敗します。model3.json 内の
絶対 URL は従来どおり fetch されます。

空白とファイル名に含まれる `%`、`#`、`?` もそのまま保持されます。信頼できない
ローカルアーカイブを開き、ネットワークアクセスを許可しない場合は、描画前に
model3.json を検証してください。絶対 URL は意図的に resolver を経由せず
`fetch` を使用します。

アーカイブの展開は利用側の担当です。resolver を単なる関数にしていることが、
このパッケージがアーカイブ用の依存を持たずに済む理由です。React では
`useCallback` かモジュール定数で関数の参照を固定してください。参照が変わる
とモデルを再読み込みします。

## トラブルシューティング

- 何も表示されないのに状態は ready の場合: コンテナにCSSサイズがなく、
  キャンバスが 1x1 に潰れています。コンテナに幅と高さを与えてください。
  コンソールに警告が出力されます。
- モデルが404の場合: モデルのディレクトリが静的ファイルとして配信されている
  か確認してください。すべてのアセットは model3.json のURL基準の相対パスで
  ロードされます。
- キャラクター複数で重い場合: キャンバスごとにWebGLコンテキストと描画ループ
  が生まれ、ブラウザのコンテキスト上限は8〜16程度です。キャンバスの数を
  減らしてください。
- モバイルでドラッグするとページがスクロールする場合: キャンバスには
  `touch-action: none` が設定されますが、スクロールする祖先要素にも同じ設定
  が必要なことがあります。

ローカルのリリースゲートでは最新の Chromium、Firefox、WebKit を検証します。
OBS は別の組み込み Chromium 環境なので、現在は OBS 31 以降を対象にし、
デスクトップ Chrome の結果から推測せず手動で確認します。
driver/value リップシンクはこのブラウザ範囲をサポートします。任意の
wLipSync AudioWorklet source モードは wlipsync 1.3 が Firefox の worklet 内で
エラーになるため、現在は Chromium/WebKit のみを検証します。

## 開発

Node 24 と pnpm が必要です。

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets   # 案内される規約を確認のうえCoreとサンプルモデルを取得
pnpm dev

pnpm lint && pnpm typecheck && pnpm test && pnpm test:e2e && pnpm verify:package
pnpm verify:packed-consumers             # 実際の tarball を3種類の利用側にインストール
LIVE2D_SOAK_MINUTES=120 pnpm test:soak   # 任意の長時間ローカルゲート
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
