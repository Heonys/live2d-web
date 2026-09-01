import type { SiteLocale } from '../i18n/site'
import { SITE_LOCALES } from '../i18n/site'

export const DOC_LOCALES = SITE_LOCALES
export type DocLocale = SiteLocale
export type DocGroup = 'Start' | 'Use' | 'Integrate' | 'Reference'

export const DOC_GROUPS: readonly DocGroup[] = ['Start', 'Use', 'Integrate', 'Reference']

export const DOC_GROUP_NAMES: Record<DocLocale, Record<DocGroup, string>> = {
  en: { Integrate: 'Integrate', Reference: 'Reference', Start: 'Start', Use: 'Use' },
  ja: { Integrate: '連携', Reference: 'リファレンス', Start: '導入', Use: '使い方' },
  ko: { Integrate: '통합', Reference: '레퍼런스', Start: '시작', Use: '사용' },
}

export interface LocalizedText { en: string, ja: string, ko: string }
export interface DocPageMeta {
  group: DocGroup
  slug: string
  summary: LocalizedText
  title: LocalizedText
}

export const DOC_PAGES = [
  {
    group: 'Start',
    slug: '',
    summary: {
      en: 'Install live2d-web and display your first model in about ten minutes.',
      ja: 'live2d-web を導入し、約10分で最初のモデルを表示します。',
      ko: 'live2d-web을 설치하고 약 10분 안에 첫 모델을 표시합니다.',
    },
    title: {
      en: 'Getting started',
      ja: 'はじめに',
      ko: '시작하기',
    },
  },
  {
    group: 'Start',
    slug: 'core-and-models',
    summary: {
      en: 'Prepare Cubism Core and model assets safely.',
      ja: 'Cubism Core とモデル資産を安全に準備します。',
      ko: 'Cubism Core와 모델 자산을 안전하게 준비합니다.',
    },
    title: {
      en: 'Core and models',
      ja: 'Core とモデル',
      ko: 'Core와 모델',
    },
  },
  {
    group: 'Use',
    slug: 'vanilla',
    summary: {
      en: 'Use the React-free root API.',
      ja: 'React に依存しない基本 API を使います。',
      ko: 'React에 의존하지 않는 기본 API를 사용합니다.',
    },
    title: {
      en: 'JavaScript',
      ja: 'JavaScript',
      ko: 'JavaScript',
    },
  },
  {
    group: 'Use',
    slug: 'react',
    summary: {
      en: 'Mount a model with the optional React binding.',
      ja: '必要なコンポーネントでのみ React 連携を読み込みます。',
      ko: 'React가 필요한 컴포넌트에서만 연동 모듈을 불러옵니다.',
    },
    title: {
      en: 'React',
      ja: 'React',
      ko: 'React',
    },
  },
  {
    group: 'Use',
    slug: 'motion-and-expression',
    summary: {
      en: 'Control motions, sequences, idle weights and expressions.',
      ja: 'モーションの連続再生、Idle の選択比率、表情の切り替えを制御します。',
      ko: '모션 연속 재생, Idle 선택 비율, 표정 전환을 제어합니다.',
    },
    title: {
      en: 'Motion and expression',
      ja: 'モーションと表情',
      ko: '모션과 표정',
    },
  },
  {
    group: 'Use',
    slug: 'lip-sync',
    summary: {
      en: 'Choose volume, driver/value or wLipSync input.',
      ja: '音量、カスタムドライバー、wLipSync から入力方式を選びます。',
      ko: '볼륨, 커스텀 드라이버, wLipSync 중에서 입력 방식을 선택합니다.',
    },
    title: {
      en: 'Lip sync',
      ja: 'リップシンク',
      ko: '립싱크',
    },
  },
  {
    group: 'Integrate',
    slug: 'mediapipe',
    summary: {
      en: 'Attach standard or Perfect Sync face tracking on main or Worker.',
      ja: 'メインスレッドか Worker で、Standard と Perfect Sync の顔トラッキングを使います。',
      ko: '메인 스레드나 Worker에서 Standard·Perfect Sync 얼굴 트래킹을 연결합니다.',
    },
    title: {
      en: 'MediaPipe face tracking',
      ja: 'MediaPipe フェイストラッキング',
      ko: 'MediaPipe 얼굴 트래킹',
    },
  },
  {
    group: 'Integrate',
    slug: 'next-ssr',
    summary: {
      en: 'Use live2d-web across the Next.js server/client boundary.',
      ja: 'Next.js の Server Component と Client Component での使い分けを説明します。',
      ko: 'Next.js의 Server Component와 Client Component에서 어떻게 나눠 사용하는지 설명합니다.',
    },
    title: {
      en: 'Next.js and SSR',
      ja: 'Next.js と SSR',
      ko: 'Next.js와 SSR',
    },
  },
  {
    group: 'Integrate',
    slug: 'mobile',
    summary: {
      en: 'Prepare capture and rendering for mobile browsers.',
      ja: 'モバイルブラウザでのカメラ入力と描画の注意点を確認します。',
      ko: '모바일 브라우저의 카메라 입력과 렌더링 주의 사항을 확인합니다.',
    },
    title: {
      en: 'Mobile',
      ja: 'モバイル',
      ko: '모바일',
    },
  },
  {
    group: 'Reference',
    slug: 'model-inspection',
    summary: {
      en: 'Check URLs and local model zip files before loading.',
      ja: 'URL とローカルのモデル ZIP を読み込み前に検査します。',
      ko: 'URL과 로컬 모델 ZIP을 불러오기 전에 검사합니다.',
    },
    title: {
      en: 'Model inspection',
      ja: 'モデル検査',
      ko: '모델 검사',
    },
  },
  {
    group: 'Reference',
    slug: 'debug',
    summary: {
      en: 'Drag the model into place and read the fit value back.',
      ja: 'モデルをドラッグで配置し、その fit の値を読み取ります。',
      ko: '모델을 끌어서 배치하고 그 `fit` 값을 그대로 가져옵니다.',
    },
    title: {
      en: 'Placement overlay',
      ja: '配置オーバーレイ',
      ko: '배치 오버레이',
    },
  },
  {
    group: 'Reference',
    slug: 'devtools',
    summary: {
      en: 'Mount optional, framework-free controls for a loaded model.',
      ja: '読み込み済みのモデルに、フレームワークに依存しない Devtools パネルを接続します。',
      ko: '불러온 모델에 프레임워크와 무관하게 사용할 수 있는 Devtools 패널을 연결합니다.',
    },
    title: {
      en: 'Live2D Devtools',
      ja: 'Live2D Devtools',
      ko: 'Live2D Devtools',
    },
  },
  {
    group: 'Reference',
    slug: 'troubleshooting',
    summary: {
      en: 'Diagnose loading, Core, rendering and tracking failures.',
      ja: '読み込み、Cubism Core、描画、トラッキングで発生する問題を切り分けます。',
      ko: '모델 로드, Cubism Core, 렌더링, 트래킹 문제의 원인을 찾습니다.',
    },
    title: {
      en: 'Troubleshooting',
      ja: 'トラブルシューティング',
      ko: '문제 해결',
    },
  },
  {
    group: 'Reference',
    slug: 'security-and-license',
    summary: {
      en: 'Set asset boundaries, CSP, privacy and license responsibilities.',
      ja: 'アセットの取り扱い、CSP、プライバシー、ライセンスの注意点を確認します。',
      ko: '자산 제공 방식, CSP, 개인정보, 라이선스 주의 사항을 확인합니다.',
    },
    title: {
      en: 'Security and licenses',
      ja: 'セキュリティとライセンス',
      ko: '보안과 라이선스',
    },
  },
  {
    group: 'Reference',
    slug: 'examples',
    summary: {
      en: 'Start from four verified framework and overlay examples.',
      ja: 'ビルドを確認済みの4つのサンプルから始められます。',
      ko: '실제 빌드를 확인한 예제 4개로 바로 시작할 수 있습니다.',
    },
    title: {
      en: 'Examples',
      ja: 'サンプル',
      ko: '예제',
    },
  },
  {
    group: 'Reference',
    slug: 'api',
    summary: {
      en: 'English signatures generated from the public TypeScript source.',
      ja: '公開 TypeScript 宣言から生成した英語の API リファレンスです。',
      ko: '공개 TypeScript 선언에서 생성한 영문 API 레퍼런스입니다.',
    },
    title: {
      en: 'API reference',
      ja: 'API リファレンス',
      ko: 'API 레퍼런스',
    },
  },
] as const satisfies readonly DocPageMeta[]

export function getDocPage(slug: string) {
  return DOC_PAGES.find(page => page.slug === slug)
}

export function docHref(locale: DocLocale, slug: string) {
  return `/docs/${locale}${slug ? `/${slug}` : ''}`
}
