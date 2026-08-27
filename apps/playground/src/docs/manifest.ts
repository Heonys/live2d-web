import type { SiteLocale } from '../i18n/site'
import { SITE_LOCALES } from '../i18n/site'

export const DOC_LOCALES = SITE_LOCALES
export type DocLocale = SiteLocale
export type DocGroup = 'Start' | 'Use' | 'Integrate' | 'Reference'

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
      ja: 'React を含まないルート API を使います。',
      ko: 'React 없는 루트 API를 사용합니다.',
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
      ja: '任意の React binding でモデルをマウントします。',
      ko: '선택형 React binding으로 모델을 마운트합니다.',
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
      ja: 'モーション・sequence・Idle weight・表情を制御します。',
      ko: '모션·시퀀스·Idle 가중치·표정을 제어합니다.',
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
      ja: '音量・driver/value・wLipSync 入力を選びます。',
      ko: '볼륨·driver/value·wLipSync 입력을 선택합니다.',
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
      ja: 'main または Worker で Standard・Perfect Sync 顔追跡を接続します。',
      ko: 'main 또는 Worker에서 Standard·Perfect Sync 얼굴 추적을 연결합니다.',
    },
    title: {
      en: 'MediaPipe face tracking',
      ja: 'MediaPipe 顔トラッキング',
      ko: 'MediaPipe 얼굴 추적',
    },
  },
  {
    group: 'Integrate',
    slug: 'next-ssr',
    summary: {
      en: 'Use live2d-web across the Next.js server/client boundary.',
      ja: 'Next.js の server/client 境界で使います。',
      ko: 'Next.js 서버·클라이언트 경계에서 사용합니다.',
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
      ja: 'モバイルブラウザ向けに capture と描画を準備します。',
      ko: '모바일 브라우저의 capture와 렌더링을 준비합니다.',
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
      ja: 'URL とローカル model zip を読み込み前に検査します。',
      ko: 'URL과 로컬 모델 zip을 로드 전에 검사합니다.',
    },
    title: {
      en: 'Model inspection',
      ja: 'モデル検査',
      ko: '모델 검사',
    },
  },
  {
    group: 'Reference',
    slug: 'devtools',
    summary: {
      en: 'Mount optional, framework-free controls for a loaded model.',
      ja: '読み込んだモデルに任意の framework-free 操作パネルを接続します。',
      ko: '로드된 모델에 선택형 프레임워크 독립 제어 패널을 연결합니다.',
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
      ja: '読み込み・Core・描画・tracking の問題を診断します。',
      ko: '로드·Core·렌더·트래킹 오류를 진단합니다.',
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
      ja: 'asset 境界・CSP・privacy・license の責任を整理します。',
      ko: '자산 경계·CSP·개인정보·라이선스 책임을 정합니다.',
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
      ja: '検証済みの framework・overlay 例4種から始めます。',
      ko: '검증된 프레임워크·overlay 예제 4종에서 시작합니다.',
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
      ja: '公開 TypeScript source から生成した英語 API signature です。',
      ko: '공개 TypeScript 소스에서 생성한 영어 API 시그니처입니다.',
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
