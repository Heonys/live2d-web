import { Live2DError } from './errors'

declare global {
  interface Window {
    Live2DCubismCore?: unknown
  }
}

/**
 * Cubism Core는 라이선스상 npm 배포 불가 — 사용자가 <script>로 직접 로드해야 한다.
 * 하부 SDK는 Core 부재 시 조용히 실패하므로, 모델 로드 전에 여기서 명확한 에러로 표면화한다.
 */
export function ensureCubismCore(): void {
  if (typeof window === 'undefined') {
    throw new Live2DError(
      'core-missing',
      'live2d-jsx is browser-only. Render inside a client component (e.g. next/dynamic with ssr: false).',
    )
  }
  if (!window.Live2DCubismCore) {
    throw new Live2DError(
      'core-missing',
      'Live2D Cubism Core is not loaded. Its license does not permit bundling, so load it yourself before any model loads:\n'
      + '  <script src="/path/to/live2dcubismcore.min.js"></script>\n'
      + 'Download it from the official SDK: https://www.live2d.com/sdk/download/web/',
    )
  }
}
