import type { NextConfig } from 'next'
import createMDX from '@next/mdx'

const nextConfig: NextConfig = {
  pageExtensions: ['ts', 'tsx', 'md', 'mdx'],
  // live2d-web은 개발 중 소스-export — Next가 직접 컴파일한다(퍼블리시 시에만 dist)
  transpilePackages: ['live2d-web'],
  async headers() {
    // Cubism Core·모델 에셋은 불변 파일 — 재방문·재시도를 즉시로 만든다
    return [
      {
        // immutable을 붙이지 않는다. 이 규칙은 파일 존재와 무관하게 적용되어
        // 404 응답에도 그대로 실리는데, immutable이면 브라우저가 새로고침에도
        // 재검증을 건너뛴다. 자산이 잠깐이라도 빠지면 그것을 받은 방문자가
        // 1년간 복구되지 않는다. 2026-08-28 실기기 검증이 그 상태에 빠졌다.
        // max-age만으로도 재방문은 그대로 캐시에서 오고, 새로고침은 살아난다.
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000' },
        ],
      },
      {
        // 유일하게 가변인 파일. 모델 경로가 바뀌면 낡은 사본을 든 재방문자가
        // 영구히 404를 받으므로 immutable에서 제외한다.
        source: '/assets/live2d/:model/manifest.json',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=0, must-revalidate' },
        ],
      },
    ]
  },
}

const withMDX = createMDX({
  options: {
    rehypePlugins: [['rehype-pretty-code', {
      keepBackground: false,
      theme: 'github-dark-default',
    }]],
  },
})

export default withMDX(nextConfig)
