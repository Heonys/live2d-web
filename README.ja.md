# live2d-web

[English](README.md) | [한국어](README.ko.md) | **日本語**

> 1回の呼び出しでウェブにLive2Dキャラクターを表示。PixiJS不要、グローバル
> 汚染なし、Reactは任意。

`live2d-web` は、Live2Dモデルのロード、ライフサイクル、フィッティング、
インタラクション（タップのヒットテスト、ポインター追跡）、リップシンク、
パラメータドライバー、描画品質、リトライとクリーンアップをランタイムが
所有します。レンダリングはバックエンド契約の背後にあり、同じランタイムを
素のJavaScriptからもReactからも利用できます。

ライブデモ: 最初の一般公開と同時に提供予定です。

**状態: `0.1.0` はローカルで実装・検証済みですが、npm には未公開
です。** デフォルトバックエンドは公式 Cubism Web Framework 5-r.5 の
レンダラーを WebGL2 上で直接使用します。PixiJS v6 は互換・性能比較用の
バックエンドとしてのみ残しています。

## はじめに

```bash
npm install live2d-web   # 公開ゲート通過後にリリース予定
```

キャラクター表示に必要なのは2つだけです。

1. **Cubism Core** (`live2dcubismcore.min.js`) — Live2Dのクローズドソース
   エンジンで、意図的に同梱していません。https://www.live2d.com/sdk/download/web/
   から公式Web SDKをダウンロードし、ファイルを静的アセットに置いてそのURLを
   `coreUrl` に渡してください。手早く試すには `OFFICIAL_CUBISM_CORE_URL`
   定数（Live2Dのホスト版）も使えます。本番ではセルフホストを推奨します。
2. **モデルのディレクトリ** — `model3.json` は `.moc3`、テクスチャ、
   モーション、物理を相対パスで参照します。モデルのディレクトリごと配信し
   （例: `public/models/hiyori/`）、`src` に `model3.json` のURLを渡して
   ください。

## Vanilla API

```ts
import { createLive2D, OFFICIAL_CUBISM_CORE_URL } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#character')!,
  coreUrl: OFFICIAL_CUBISM_CORE_URL,
  fit: 'upper-body',
  followPointer: true,
  quality: 'auto',
  src: '/models/hiyori/hiyori.model3.json',
})

// インタラクション: タップのヒットテスト、モーションの連結、メタデータ取得
container.addEventListener('click', async (event) => {
  if (character.hitTest(event.clientX, event.clientY).includes('Body'))
    await character.motion('Tap@Body') // 再生終了時にresolveします
})
console.log(character.getModelInfo()) // { motions, expressions, hitAreas }

character.setParameter('ParamMouthOpenY', 0.5)
character.clearParameter('ParamMouthOpenY')
character.pause()
character.resume()
character.dispose()
```

`createLive2D()` は Core、Stage、モデルがすべて準備できてから resolve
します。`expression`/`clearExpression`、`focus`/`focusAt`、
`isMotionPlaying`、`setFit`、`retry`、`addParameterDriver`、`addLipSync`、
状態のサブスクライブと冪等なクリーンアップも提供します。モーション再生は
`priority`（'idle' | 'normal' | 'force'）を受け取り、アイドルグループは
`idleMotion` オプションで変更でき、`false` で無効化できます。

## React API

```tsx
'use client'

import { LipSync, Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Character({ voice }: { voice: AudioNode | null }) {
  return (
    <Live2DCanvas
      // セルフホストしたCoreファイル。OFFICIAL_CUBISM_CORE_URL も利用可
      coreUrl="/assets/live2dcubismcore.min.js"
      quality="auto"
    >
      <Live2DModel src="/models/hiyori.model3.json" fit="upper-body">
        <LipSync
          source={voice}
          active={voice !== null}
          profile="/lipsync/profile.bin"
        />
      </Live2DModel>
    </Live2DCanvas>
  )
}
```

Reactコンポーネントは vanilla API と同じ headless コントローラーを生成・
購読します。`Live2DModel.onLoad` と `useLive2DModel()` は、モーション、
表情、フォーカス、パラメータ、モデル情報のメソッドだけを持つ同一の安全な
コントローラーを返します。フレーム単位の値が React state を通ることは
ありません。

`<Live2DModel>` は `followPointer`、`paused`、
`onTap={(hitAreas, event) => ...}` も受け取り、これらのトグルでモデルが
再ロードされることはありません。`<LipSync>` は安定した driver オブジェクト
が不便な場合、プレーンな値 `mouthOpen`/`speaking` も受け取れます。vanilla
インスタンスを直接扱いたい React アプリには、`useLive2D({ container, src,
... })` がライフサイクル全体（StrictMode安全）を所有し、
`{ instance, state, error, retry }` を返します。

## トラブルシューティング

- **何も表示されないのに状態は ready**: コンテナにCSSサイズがなく、キャン
  バスが 1x1 に潰れています（コンソールに警告が出ます）。コンテナに幅と
  高さを与えてください。
- **モデルが404**: モデルのディレクトリを静的ファイルとして配信する必要が
  あります。すべてのアセットは model3.json のURL基準の相対パスでロード
  されます。HTTP 4xx はリトライせず即座に失敗します。
- **キャラクター複数で重い**: キャンバスごとにWebGLコンテキストと描画
  ループを所有します。ブラウザのコンテキスト上限は8〜16程度なので、
  キャンバス数は少なく保ってください。
- **モバイルでドラッグするとページがスクロールする**: キャンバスには
  `touch-action: none` が設定されますが、スクロールする祖先要素にも必要な
  場合があります。

## バックエンド選択

`backend` を省略すると Framework ベースの WebGL2 バックエンドが選択され
ます。Pixi や WebGL1 へのフォールバックはしません。

```ts
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/adapters/cubism-webgl'
import { pixiV6 } from 'live2d-web/adapters/pixi-v6'

// 再利用可能なデフォルトWebGLバックエンド
const defaultBackend = cubismWebGL

// シェーダーをアプリ所有のURLから配信する場合のみ必要
const customWebGL = createCubismWebGLBackend({
  shaderBaseUrl: '/live2d-shaders/',
})

// 互換/A-B用。任意のPixi peer依存が必要
const compatibilityBackend = pixiV6
```

Cubism Core 5.3 は意図的に同梱していません。公式のブラウザ用ファイルを
`coreUrl` で渡すか、モデル作成前にロードして `coreUrl` を省略してください。

## パッケージ境界

- `live2d-web`: React非依存の vanilla ランタイムとレンダラー中立の契約。
- `live2d-web/react`: クライアントコンポーネントとフック。Reactは optional
  peer。
- `live2d-web/adapters/cubism-webgl`: Framework ランタイムとシェーダーを
  含むデフォルトWebGL2バックエンド。Cubism Core は含みません。
- `live2d-web/adapters/pixi-v6`: `pixi-live2d-display@0.4` を使う互換/A-B
  バックエンド。Pixi peer はすべて任意。

自動品質はバッキングバッファをモバイル1.5MP、デスクトップ4MPに制限します。
固定 `resolution` を与えると自動ダウンシフトは無効になります。

## リップシンク

vanilla の `addLipSync()` と React の `<LipSync>` はどちらも、既存の
driver または呼び出し側が所有する WebAudio `AudioNode` を受け取ります。
source モードは wLipSync を動的にロードします。パッケージはキャリブレー
ションプロファイルを含まず、呼び出し側の `AudioContext` を閉じたり中断
したりしません。

`ParamMouthOpenY`、200msのリリース、500msの口閉じハンドオフはこのアルファ
APIでは固定です。最終的なパラメータ書き込みはSDKモーション更新の後に行われ、
フレーム単位のReactレンダーは発生しません。

## 開発

Node 24 と pnpm が必要です。

```bash
pnpm install
LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets
pnpm dev

pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm verify:package
```

ベンチマークスイート（startup、18条件matrix、memory、バックエンドA/B、
実機GPU実行）は[ベンチマークガイド](docs/benchmarking.md)に記載しています。

`LIVE2D_ACCEPT_TERMS=1` は、コマンドが案内する公式規約を確認したうえで
ローカル開発用ダウンロードを承認するフラグです。スクリプトは公式 Cubism
5.3 Core（`core/06`）、Hiyori、固定版 `CubismWebSamples@5-r.5` の
Mark/Mao/Rice/Ren リソースを使用し、gitignore された開発パスにのみ書き込み
ます。これらのアセットはパッケージに含まれません。

Playground は `/` にReactデモ、`/vanilla` に vanilla コントローラー、
`/inspect` にURLベースのモデルインスペクター、`/compare` に WebGL/Pixi の
A-Bビューを提供します。`apps/vanilla-consumer` はReact依存が一切ない別の
Viteフィクスチャです。

## ドキュメント

[ドキュメントマップ](docs/README.md)から始めてください。主なドキュメント:

- [APIリファレンス](docs/api-design.md)
- [アーキテクチャ](docs/architecture.md)
- [ライセンス](docs/licensing.md)
- [ベンチマークガイド](docs/benchmarking.md)と
  [WebGL vs Pixi v6 の結果](docs/benchmarks/2026-08-15-cubism-webgl-vs-pixi-v6.md)

## ライセンスと商標

プロジェクト自体のソースはMITライセンスです。同梱される Cubism Web
Framework とシェーダーは Live2D のライセンスに従います。パッケージの
ライセンス詳細と変更した Framework ファイルの一覧は
[LICENSES.md](packages/live2d-web/LICENSES.md) と
[THIRD_PARTY_NOTICES.md](packages/live2d-web/THIRD_PARTY_NOTICES.md) に
記録されています。

本プロジェクトは非公式のサードパーティプロジェクトであり、Live2D Inc. とは
無関係で、承認も受けていません。Live2D および Cubism は Live2D Inc. の商標
です。`live2d-web` は Cubism Core、サンプルモデル、リップシンクプロファイル
を同梱しません。詳細は[ライセンスドキュメント](docs/licensing.md)を参照して
ください。
