import type { Metadata } from 'next'
import Script from 'next/script'
import './globals.css'

export const metadata: Metadata = {
  title: 'live2d-jsx playground',
  description: 'Development playground for live2d-jsx',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>
        {/* Cubism Core는 npm 배포 불가 — 모델 로드 전에 글로벌로 있어야 한다 (pnpm fetch-assets) */}
        <Script src="/assets/js/cubism/live2dcubismcore.min.js" strategy="beforeInteractive" />
        {children}
      </body>
    </html>
  )
}
