import type { NextConfig } from 'next'

const nextConfig: NextConfig = {
  // live2d-web은 개발 중 소스-export — Next가 직접 컴파일한다(퍼블리시 시에만 dist)
  transpilePackages: ['live2d-web'],
  async headers() {
    // Cubism Core·모델 에셋은 불변 파일 — 재방문·재시도를 즉시로 만든다
    return [
      {
        source: '/assets/:path*',
        headers: [
          { key: 'Cache-Control', value: 'public, max-age=31536000, immutable' },
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

export default nextConfig
