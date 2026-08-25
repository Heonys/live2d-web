export const DOC_LOCALES = ['en', 'ko', 'ja'] as const
export type DocLocale = typeof DOC_LOCALES[number]

export interface LocalizedText {
  en: string
  ja: string
  ko: string
}

export interface DocCodeBlock {
  language: string
  value: string
}

export interface DocLink {
  href: string
  label: LocalizedText
}

export interface DocSection {
  bullets?: Record<DocLocale, readonly string[]>
  code?: readonly DocCodeBlock[]
  heading: LocalizedText
  links?: readonly DocLink[]
  paragraphs: Record<DocLocale, readonly string[]>
}

export interface DocPage {
  group: 'Start' | 'Use' | 'Integrate' | 'Reference'
  sections: readonly DocSection[]
  slug: string
  summary: LocalizedText
  title: LocalizedText
}

function text(en: string, ko: string, ja: string): LocalizedText {
  return { en, ja, ko }
}

function paragraphs(en: string[], ko: string[], ja: string[]) {
  return { en, ja, ko }
}

const install = 'pnpm add live2d-web'
const coreScript = `<script src="/live2dcubismcore.min.js"></script>`
const vanilla = `import { createLive2D } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#avatar'),
  coreUrl: '/live2dcubismcore.min.js',
  src: '/models/model.model3.json',
})

await character.motion('TapBody', 0)

// When the host view is removed:
character.dispose()`
const react = `'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/model.model3.json" />
    </Live2DCanvas>
  )
}`
const motion = `const result = await character.playMotion('TapBody', 0, {
  fadeInMs: 250,
  fadeOutMs: 400,
})

await character.sequence([
  { group: 'TapBody', index: 0 },
  { group: 'Idle', index: 0 },
])

await character.expression('smile', { fadeInMs: 500 })`
const volume = `import { createVolumeLipSync } from 'live2d-web'

const driver = createVolumeLipSync()
const detach = character.addLipSync({ driver })

// The app owns AudioContext, RMS calculation and scheduling.
driver.sample(rms, elapsedMs)

detach()`
const mediaPipe = `import { createMediaPipeFaceTracker } from
  'live2d-web/tracking/mediapipe'

const tracker = await createMediaPipeFaceTracker({
  modelAssetPath: '/mediapipe/face_landmarker.task',
  wasmPath: '/mediapipe/wasm',
})
const detach = tracker.attach(character, {
  mapping: 'auto',
  channels: { mouth: false },
})

tracker.update(video, performance.now())

detach()
tracker.dispose()`
const worker = `const tracker = await createMediaPipeFaceTracker({
  execution: 'worker',
  modelAssetPath: '/mediapipe/face_landmarker.task',
  wasmPath: '/mediapipe/wasm',
  workerFactory: () => new Worker(
    new URL('./face-tracking.worker.ts', import.meta.url),
    { type: 'module' },
  ),
})`
const inspect = `import {
  inspectModelCapabilities,
  inspectModelSource,
} from 'live2d-web/inspect'

const report = await inspectModelSource({
  src: 'https://example.com/model.model3.json',
})

if (report.status === 'compatible') {
  console.log(report.motions, report.expressions)
}`
const vueExample = `<script setup lang="ts">
import { createLive2D } from 'live2d-web'
import { onBeforeUnmount, onMounted, ref } from 'vue'

const host = ref<HTMLElement>()
let character: Awaited<ReturnType<typeof createLive2D>> | undefined

onMounted(async () => {
  character = await createLive2D({
    container: host.value!,
    coreUrl: '/live2dcubismcore.min.js',
    src: '/models/model.model3.json',
  })
})
onBeforeUnmount(() => character?.dispose())
</script>

<template><div ref="host" class="avatar" /></template>`
const obsExample = `import { createLive2D } from 'live2d-web'

const query = new URLSearchParams(location.search)
const character = await createLive2D({
  container: document.querySelector('#overlay')!,
  coreUrl: '/live2dcubismcore.min.js',
  fit: query.get('fit') === 'full' ? 'full' : 'upper-body',
  src: query.get('model') ?? '/models/model.model3.json',
})

addEventListener('pagehide', () => character.dispose(), { once: true })`
const exampleCommands = `pnpm install
pnpm --filter @live2d-web/example-vanilla-vite dev
pnpm --filter @live2d-web/example-next-react dev
pnpm --filter @live2d-web/example-vue-vite dev
pnpm --filter @live2d-web/example-obs-overlay dev`

export const DOC_PAGES: readonly DocPage[] = [
  {
    group: 'Start',
    sections: [
      {
        code: [{ language: 'shell', value: install }],
        heading: text('Install the package', '패키지 설치', 'パッケージをインストール'),
        paragraphs: paragraphs(
          ['Install the single package with your package manager. React and MediaPipe remain optional, so a vanilla application does not download either runtime.'],
          ['패키지 하나만 설치하면 됩니다. React와 MediaPipe는 선택 의존성이므로 바닐라 앱에는 해당 런타임이 포함되지 않습니다.'],
          ['パッケージは1つだけです。React と MediaPipe は任意依存なので、Vanilla アプリにはそれらのランタイムが入りません。'],
        ),
      },
      {
        heading: text('What you provide', '앱이 준비할 것', 'アプリ側で用意するもの'),
        paragraphs: paragraphs(
          ['The npm package does not include Cubism Core or a model. Download Core under Live2D’s terms, export or license a Cubism 4/5 model, and serve both from your own origin.'],
          ['npm 패키지는 Cubism Core와 모델을 포함하지 않습니다. Live2D 약관에 따라 Core를 받고, 권한이 있는 Cubism 4/5 모델과 함께 같은 출처에서 제공하세요.'],
          ['npm パッケージに Cubism Core とモデルは含まれません。Live2D の規約に従って Core を取得し、利用権のある Cubism 4/5 モデルと同一オリジンから配信してください。'],
        ),
      },
    ],
    slug: '',
    summary: text(
      'Install live2d-web and display your first model in about ten minutes.',
      'live2d-web을 설치하고 약 10분 안에 첫 모델을 표시합니다.',
      'live2d-web を導入し、約10分で最初のモデルを表示します。',
    ),
    title: text('Getting started', '시작하기', 'はじめに'),
  },
  {
    group: 'Start',
    sections: [
      {
        code: [{ language: 'html', value: coreScript }],
        heading: text('Cubism Core', 'Cubism Core', 'Cubism Core'),
        paragraphs: paragraphs(
          ['Use Cubism Core 5.3 with the bundled Framework 5-r.5 adapter. The script may be preloaded by coreUrl or placed before application code. Never copy Core into npm packages or public issue attachments.'],
          ['내장 Framework 5-r.5 어댑터에는 Cubism Core 5.3을 사용합니다. coreUrl로 미리 불러오거나 앱 코드 앞에 script를 둘 수 있습니다. Core를 npm 패키지나 공개 이슈 첨부물에 넣지 마세요.'],
          ['同梱 Framework 5-r.5 アダプターには Cubism Core 5.3 を使います。coreUrl で先読みするか、アプリコードより前に script を置けます。Core を npm や公開 Issue に添付しないでください。'],
        ),
      },
      {
        bullets: paragraphs(
          ['Keep model3.json paths relative and case-correct.', 'Serve textures and motions with CORS when they use another origin.', 'Use /inspect before debugging rendering.'],
          ['model3.json의 경로는 상대 경로와 정확한 대소문자를 유지합니다.', '다른 출처의 texture·motion에는 CORS를 허용합니다.', '렌더 문제를 보기 전에 /inspect로 모델을 검사합니다.'],
          ['model3.json の相対パスと大文字小文字を正確に保ちます。', '別オリジンの texture・motion には CORS を許可します。', '描画を調べる前に /inspect でモデルを検査します。'],
        ),
        heading: text('Model directory', '모델 디렉터리', 'モデルディレクトリ'),
        paragraphs: paragraphs(
          ['Keep the exported directory together. A model may reference moc3, textures, motions, expressions, physics, pose and user-data files.'],
          ['내보낸 디렉터리를 그대로 유지하세요. 모델은 moc3, texture, motion, expression, physics, pose, user-data 파일을 참조할 수 있습니다.'],
          ['書き出したディレクトリをまとめて配置します。モデルは moc3、texture、motion、expression、physics、pose、user-data を参照できます。'],
        ),
      },
    ],
    slug: 'core-and-models',
    summary: text('Prepare Cubism Core and model assets safely.', 'Cubism Core와 모델 자산을 안전하게 준비합니다.', 'Cubism Core とモデル資産を安全に準備します。'),
    title: text('Core and models', 'Core와 모델', 'Core とモデル'),
  },
  {
    group: 'Use',
    sections: [
      {
        code: [{ language: 'ts', value: vanilla }],
        heading: text('Create, load, dispose', '생성·로드·정리', '作成・読み込み・破棄'),
        paragraphs: paragraphs(
          ['The vanilla runtime owns one Canvas and one model. Await loading before issuing model commands, and always dispose when its host view leaves the page.'],
          ['바닐라 런타임은 Canvas 하나와 모델 하나를 소유합니다. 모델 명령 전에 로드를 기다리고, 화면에서 제거될 때 반드시 dispose하세요.'],
          ['Vanilla ランタイムは Canvas 1つとモデル1体を所有します。モデル操作の前に読み込みを待ち、画面から外すときは必ず dispose します。'],
        ),
      },
    ],
    slug: 'vanilla',
    summary: text('Use the React-free root API.', 'React 없는 루트 API를 사용합니다.', 'React を含まないルート API を使います。'),
    title: text('Vanilla JavaScript', '바닐라 JavaScript', 'Vanilla JavaScript'),
  },
  {
    group: 'Use',
    sections: [
      {
        code: [{ language: 'tsx', value: react }],
        heading: text('Client component boundary', 'Client Component 경계', 'Client Component 境界'),
        paragraphs: paragraphs(
          ['Import /react only from a Client Component. Live2DCanvas owns rendering; Live2DModel owns model loading and cleans itself when React unmounts it.'],
          ['/react는 Client Component에서만 import하세요. Live2DCanvas는 렌더링을, Live2DModel은 모델 로드와 unmount 정리를 담당합니다.'],
          ['/react は Client Component からだけ import します。Live2DCanvas が描画を、Live2DModel がモデル読み込みと unmount 時の破棄を担当します。'],
        ),
      },
    ],
    slug: 'react',
    summary: text('Mount a model with the optional React binding.', '선택형 React binding으로 모델을 마운트합니다.', '任意の React binding でモデルをマウントします。'),
    title: text('React', 'React', 'React'),
  },
  {
    group: 'Use',
    sections: [
      {
        code: [{ language: 'ts', value: motion }],
        heading: text('Playback results and fades', '재생 결과와 페이드', '再生結果とフェード'),
        paragraphs: paragraphs(
          ['motion() preserves the simple Promise<void> contract. Use playMotion() when completed, interrupted, skipped and disposed must be distinguished. Sequence stops at the first non-completed result.'],
          ['motion()은 단순한 Promise<void> 계약을 유지합니다. 완료·중단·건너뜀·dispose를 구분하려면 playMotion()을 사용하세요. sequence는 첫 비정상 결과에서 멈춥니다.'],
          ['motion() は単純な Promise<void> を維持します。完了・中断・skip・dispose を区別する場合は playMotion() を使います。sequence は最初の非完了結果で停止します。'],
        ),
      },
      {
        heading: text('Authored defaults stay intact', '제작자 기본값 유지', '制作者の既定値を維持'),
        paragraphs: paragraphs(
          ['Omit fade options to preserve model3, motion3 and exp3 settings. Per-parameter motion fades remain stronger than a playback-wide override.'],
          ['fade 옵션을 생략하면 model3·motion3·exp3 설정을 유지합니다. motion3의 파라미터별 fade는 재생 전체 덮어쓰기보다 우선합니다.'],
          ['fade を省略すると model3・motion3・exp3 の設定を保ちます。motion3 のパラメータ別 fade は再生全体の上書きより優先されます。'],
        ),
      },
    ],
    slug: 'motion-and-expression',
    summary: text('Control motions, sequences, idle weights and expressions.', '모션·시퀀스·Idle 가중치·표정을 제어합니다.', 'モーション・sequence・Idle weight・表情を制御します。'),
    title: text('Motion and expression', '모션과 표정', 'モーションと表情'),
  },
  {
    group: 'Use',
    sections: [
      {
        code: [{ language: 'ts', value: volume }],
        heading: text('Volume driver', '볼륨 드라이버', '音量ドライバー'),
        paragraphs: paragraphs(
          ['The helper converts caller-sampled RMS into stable mouth openness. The application keeps ownership of microphone permission, AudioContext, nodes and requestAnimationFrame.'],
          ['헬퍼는 앱이 샘플링한 RMS를 안정적인 입 벌림으로 바꿉니다. 마이크 권한·AudioContext·노드·requestAnimationFrame은 앱이 계속 소유합니다.'],
          ['helper はアプリが取得した RMS を安定した口の開きに変換します。マイク権限・AudioContext・node・requestAnimationFrame はアプリが所有します。'],
        ),
      },
      {
        heading: text('Avoid competing mouth inputs', '입력 충돌 피하기', '口入力の競合を避ける'),
        paragraphs: paragraphs(
          ['When face tracking and microphone lip sync run together, disable the tracker mouth channel. wLipSync remains a separate source mode and requires a compatible browser AudioWorklet.'],
          ['얼굴 트래킹과 마이크 립싱크를 함께 쓸 때는 tracker의 mouth 채널을 끄세요. wLipSync는 별도 source 모드이며 브라우저 AudioWorklet 지원이 필요합니다.'],
          ['顔トラッキングとマイク lip sync を併用するときは tracker の mouth channel を無効にします。wLipSync は別の source mode で、AudioWorklet 対応が必要です。'],
        ),
      },
    ],
    slug: 'lip-sync',
    summary: text('Choose volume, driver/value or wLipSync input.', '볼륨·driver/value·wLipSync 입력을 선택합니다.', '音量・driver/value・wLipSync 入力を選びます。'),
    title: text('Lip sync', '립싱크', 'リップシンク'),
  },
  {
    group: 'Integrate',
    sections: [
      {
        code: [{ language: 'ts', value: mediaPipe }],
        heading: text('Main-thread tracking', '메인 스레드 추적', 'メインスレッド追跡'),
        paragraphs: paragraphs(
          ['MediaPipe is an optional peer and loads only from its subpath. You supply WASM, the Face Landmarker model, video frames and scheduling. The tracker keeps normalized values, never frames or landmarks.'],
          ['MediaPipe는 선택 peer이며 해당 subpath에서만 로드됩니다. WASM·Face Landmarker 모델·video frame·스케줄링은 앱이 제공합니다. 트래커는 정규화 값만 보관하고 frame·landmark는 저장하지 않습니다.'],
          ['MediaPipe は任意 peer で、この subpath からだけ読み込まれます。WASM・Face Landmarker model・video frame・schedule はアプリが渡します。tracker は正規化値だけを保持します。'],
        ),
      },
      {
        code: [{ language: 'ts', value: worker }],
        heading: text('Optional Worker', '선택형 Worker', '任意の Worker'),
        paragraphs: paragraphs(
          ['Worker mode keeps inference away from rendering. update() becomes asynchronous, accepts one frame at a time and reports busy frames as skipped. If Worker startup fails, choose main mode explicitly; there is no silent fallback.'],
          ['Worker 모드는 추론을 렌더링 스레드에서 분리합니다. update()는 비동기가 되고 한 번에 한 frame만 받아 busy frame은 skipped로 끝냅니다. 시작 실패 시 앱이 main을 명시적으로 선택하며 조용한 fallback은 없습니다.'],
          ['Worker mode は推論を描画スレッドから分離します。update() は非同期で1 frameずつ処理し、busy frame は skipped になります。起動失敗時の暗黙 fallback はありません。'],
        ),
      },
    ],
    slug: 'mediapipe',
    summary: text('Attach standard or Perfect Sync face tracking on main or Worker.', 'main 또는 Worker에서 Standard·Perfect Sync 얼굴 추적을 연결합니다.', 'main または Worker で Standard・Perfect Sync 顔追跡を接続します。'),
    title: text('MediaPipe face tracking', 'MediaPipe 얼굴 추적', 'MediaPipe 顔トラッキング'),
  },
  {
    group: 'Integrate',
    sections: [
      {
        code: [{ language: 'tsx', value: react }],
        heading: text('Keep browser code behind use client', '브라우저 코드를 use client 뒤에 두기', 'ブラウザコードを use client の内側へ'),
        paragraphs: paragraphs(
          ['The root and inspect entries are SSR-evaluation safe. Rendering and /react still require a Client Component. Pass model URLs as data from Server Components instead of importing browser code there.'],
          ['루트와 inspect entry는 SSR 평가가 안전합니다. 렌더링과 /react는 Client Component가 필요합니다. Server Component에서는 브라우저 코드를 import하지 말고 모델 URL만 데이터로 전달하세요.'],
          ['root と inspect entry は SSR 評価が安全です。描画と /react は Client Component が必要です。Server Component からは model URL だけをデータとして渡します。'],
        ),
      },
    ],
    slug: 'next-ssr',
    summary: text('Use live2d-web across the Next.js server/client boundary.', 'Next.js 서버·클라이언트 경계에서 사용합니다.', 'Next.js の server/client 境界で使います。'),
    title: text('Next.js and SSR', 'Next.js와 SSR', 'Next.js と SSR'),
  },
  {
    group: 'Integrate',
    sections: [
      {
        bullets: paragraphs(
          ['Use HTTPS for camera and microphone permission.', 'Pause capture when the page is hidden.', 'Test orientation changes and background return.', 'Prefer Worker tracking after measuring the device.'],
          ['카메라·마이크 권한에는 HTTPS를 사용합니다.', '페이지가 숨겨지면 capture를 중지합니다.', '화면 회전과 background 복귀를 확인합니다.', '기기 측정 뒤 Worker tracking을 우선 검토합니다.'],
          ['カメラ・マイク権限には HTTPS を使います。', 'ページが hidden の間は capture を止めます。', '画面回転と background 復帰を確認します。', '端末で測定してから Worker tracking を検討します。'],
        ),
        heading: text('Mobile checklist', '모바일 체크리스트', 'モバイルチェックリスト'),
        paragraphs: paragraphs(
          ['Automatic quality caps the Canvas backing buffer, but camera inference still depends on the device. iOS Safari and Android Chrome hardware measurements are pending for 0.6; treat desktop numbers only as a reference.'],
          ['자동 품질은 Canvas backing buffer를 제한하지만 카메라 추론은 기기에 따라 달라집니다. iOS Safari·Android Chrome 실기 측정은 0.6에서 아직 대기 중이므로 데스크톱 수치는 참고로만 보세요.'],
          ['自動画質は Canvas backing buffer を制限しますが、カメラ推論は端末依存です。iOS Safari・Android Chrome 実機測定は0.6で未完了です。'],
        ),
      },
    ],
    slug: 'mobile',
    summary: text('Prepare capture and rendering for mobile browsers.', '모바일 브라우저의 capture와 렌더링을 준비합니다.', 'モバイルブラウザ向けに capture と描画を準備します。'),
    title: text('Mobile', '모바일', 'モバイル'),
  },
  {
    group: 'Reference',
    sections: [
      {
        code: [{ language: 'ts', value: inspect }],
        heading: text('Inspect before rendering', '렌더링 전에 검사', '描画前に検査'),
        paragraphs: paragraphs(
          ['The optional inspect entry checks model3 references without importing React, Core, Framework, MediaPipe or JSZip. Content problems return together as findings; invalid API arguments and abort reject.'],
          ['선택형 inspect entry는 React·Core·Framework·MediaPipe·JSZip 없이 model3 참조를 검사합니다. 콘텐츠 문제는 findings로 한 번에 반환하고 잘못된 API 인자와 abort만 reject합니다.'],
          ['任意の inspect entry は React・Core・Framework・MediaPipe・JSZip を読み込まず model3 参照を検査します。内容の問題は findings としてまとめて返ります。'],
        ),
      },
      {
        heading: text('Browser zip inspector', '브라우저 zip 검사기', 'ブラウザ zip 検査'),
        paragraphs: paragraphs(
          ['The /inspect tool opens a zip only in the current tab. It validates size, count, paths and model references, and never uploads, stores or sends telemetry. Incompatible archives are not rendered.'],
          ['/inspect 도구는 현재 탭 안에서만 zip을 엽니다. 크기·개수·경로·모델 참조를 검사하며 업로드·저장·telemetry 전송을 하지 않습니다. 호환되지 않는 archive는 렌더하지 않습니다.'],
          ['/inspect は現在のタブ内だけで zip を開き、サイズ・数・path・model 参照を検査します。upload・保存・telemetry は行いません。非互換 archive は描画しません。'],
        ),
      },
    ],
    slug: 'model-inspection',
    summary: text('Check URLs and local model zip files before loading.', 'URL과 로컬 모델 zip을 로드 전에 검사합니다.', 'URL とローカル model zip を読み込み前に検査します。'),
    title: text('Model inspection', '모델 검사', 'モデル検査'),
  },
  {
    group: 'Reference',
    sections: [
      {
        bullets: paragraphs(
          ['model-load-failed: inspect the URL, HTTP status and CORS.', 'core-load-failed: check Core URL and Core/Framework pairing.', 'invalid-props: fix the caller value; retrying does not help.', 'tracking-error: verify optional peer, WASM/model paths and Worker CSP.'],
          ['model-load-failed: URL·HTTP 상태·CORS를 확인합니다.', 'core-load-failed: Core URL과 Core/Framework 조합을 확인합니다.', 'invalid-props: 호출 값을 고칩니다. 재시도로 해결되지 않습니다.', 'tracking-error: optional peer·WASM/model 경로·Worker CSP를 확인합니다.'],
          ['model-load-failed: URL・HTTP status・CORS を確認します。', 'core-load-failed: Core URL と Core/Framework の組み合わせを確認します。', 'invalid-props: 呼び出し値を直します。retry では直りません。', 'tracking-error: optional peer・WASM/model path・Worker CSP を確認します。'],
        ),
        heading: text('Start with the error code', '오류 코드부터 확인', 'error code から確認'),
        paragraphs: paragraphs(
          ['Live2DError carries a stable code and, for asset failures, the URL, asset type and HTTP status. Include those fields plus browser and model export version in an issue, but do not attach licensed assets.'],
          ['Live2DError에는 안정적인 code와 자산 오류의 URL·asset type·HTTP 상태가 있습니다. 이 값과 브라우저·모델 export 버전을 이슈에 적되 라이선스 자산은 첨부하지 마세요.'],
          ['Live2DError には安定した code と asset URL・type・HTTP status があります。Issue には browser と export version も書き、ライセンス資産は添付しないでください。'],
        ),
      },
    ],
    slug: 'troubleshooting',
    summary: text('Diagnose loading, Core, rendering and tracking failures.', '로드·Core·렌더·트래킹 오류를 진단합니다.', '読み込み・Core・描画・tracking の問題を診断します。'),
    title: text('Troubleshooting', '문제 해결', 'トラブルシューティング'),
  },
  {
    group: 'Reference',
    sections: [
      {
        bullets: paragraphs(
          ['Allow script-src for Cubism Core.', 'Allow connect-src for model, WASM and tracking assets.', 'Allow worker-src for module Worker tracking.', 'Self-host assets and configure CORS deliberately.'],
          ['Cubism Core를 위해 script-src를 허용합니다.', '모델·WASM·tracking 자산을 위해 connect-src를 허용합니다.', 'module Worker tracking을 위해 worker-src를 허용합니다.', '자산을 self-host하고 CORS를 명시적으로 설정합니다.'],
          ['Cubism Core 用の script-src を許可します。', 'model・WASM・tracking asset 用の connect-src を許可します。', 'module Worker tracking 用の worker-src を許可します。', 'asset を self-host し CORS を明示します。'],
        ),
        heading: text('CSP and untrusted models', 'CSP와 신뢰하지 않는 모델', 'CSP と信頼できないモデル'),
        paragraphs: paragraphs(
          ['Treat model3.json as an input manifest. Inspect limits, external URLs and CORS before rendering. Local archives never resolve external URLs through the library inspector.'],
          ['model3.json을 입력 manifest로 취급하세요. 렌더 전에 크기 제한·외부 URL·CORS를 검사합니다. 로컬 archive 검사에서는 외부 URL을 네트워크로 요청하지 않습니다.'],
          ['model3.json を入力 manifest として扱い、描画前にサイズ・外部 URL・CORS を検査します。ローカル archive 検査は外部 URL を取得しません。'],
        ),
      },
      {
        heading: text('Licenses and privacy', '라이선스와 개인정보', 'ライセンスとプライバシー'),
        paragraphs: paragraphs(
          ['live2d-web is unofficial. Core, Framework, models and MediaPipe have separate terms. Face tracking runs on-device, but your application remains responsible for consent, indicators and any analytics it adds.'],
          ['live2d-web은 비공식 라이브러리입니다. Core·Framework·모델·MediaPipe는 각각 별도 약관을 가집니다. 얼굴 추적은 기기에서 실행되지만 동의·표시·앱이 추가한 분석의 책임은 앱에 있습니다.'],
          ['live2d-web は非公式です。Core・Framework・model・MediaPipe には別の規約があります。顔追跡は端末内で動きますが、同意・表示・analytics はアプリの責任です。'],
        ),
      },
    ],
    slug: 'security-and-license',
    summary: text('Set asset boundaries, CSP, privacy and license responsibilities.', '자산 경계·CSP·개인정보·라이선스 책임을 정합니다.', 'asset 境界・CSP・privacy・license の責任を整理します。'),
    title: text('Security and licenses', '보안과 라이선스', 'セキュリティとライセンス'),
  },
  {
    group: 'Reference',
    sections: [
      {
        code: [
          { language: 'shell', value: exampleCommands },
          { language: 'ts · Vite Vanilla', value: vanilla },
          { language: 'tsx · Next React', value: react },
          { language: 'vue · Vue Vite', value: vueExample },
          { language: 'ts · OBS overlay', value: obsExample },
        ],
        heading: text('Buildable projects', '실제 빌드되는 프로젝트', '実際に build する project'),
        links: [
          {
            href: 'https://github.com/Heonys/live2d-web/tree/main/examples/vanilla-vite',
            label: text('Complete Vite Vanilla source', 'Vite Vanilla 전체 소스', 'Vite Vanilla 完全な source'),
          },
          {
            href: 'https://github.com/Heonys/live2d-web/tree/main/examples/next-react',
            label: text('Complete Next React source', 'Next React 전체 소스', 'Next React 完全な source'),
          },
          {
            href: 'https://github.com/Heonys/live2d-web/tree/main/examples/vue-vite',
            label: text('Complete Vue Vite source', 'Vue Vite 전체 소스', 'Vue Vite 完全な source'),
          },
          {
            href: 'https://github.com/Heonys/live2d-web/tree/main/examples/obs-overlay',
            label: text('Complete OBS overlay source', 'OBS overlay 전체 소스', 'OBS overlay 完全な source'),
          },
        ],
        paragraphs: paragraphs(
          ['The repository includes Vite Vanilla, Next React, Vue Vite and transparent OBS overlay examples. CI typechecks and production-builds all four. Each expects Core at /live2dcubismcore.min.js and a model at /models/model.model3.json.'],
          ['저장소에는 Vite Vanilla·Next React·Vue Vite·투명 OBS overlay 예제가 있습니다. CI가 네 예제를 typecheck하고 production build합니다. 기본 경로는 Core /live2dcubismcore.min.js, 모델 /models/model.model3.json입니다.'],
          ['repository には Vite Vanilla・Next React・Vue Vite・透明 OBS overlay の例があります。CI が4つを typecheck・production build します。既定 path は Core /live2dcubismcore.min.js、model /models/model.model3.json です。'],
        ),
      },
    ],
    slug: 'examples',
    summary: text('Start from four verified framework and overlay examples.', '검증된 프레임워크·overlay 예제 4종에서 시작합니다.', '検証済みの framework・overlay 例4種から始めます。'),
    title: text('Examples', '예제', 'サンプル'),
  },
  {
    group: 'Reference',
    sections: [],
    slug: 'api',
    summary: text('English signatures generated from the public TypeScript source.', '공개 TypeScript 소스에서 생성한 영어 API 시그니처입니다.', '公開 TypeScript source から生成した英語 API signature です。'),
    title: text('API reference', 'API 레퍼런스', 'API リファレンス'),
  },
]

export function getDocPage(slug: string) {
  return DOC_PAGES.find(page => page.slug === slug)
}

export function docHref(locale: DocLocale, slug: string) {
  return `/docs/${locale}${slug ? `/${slug}` : ''}`
}
