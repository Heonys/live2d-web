import type { Metadata } from 'next'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/noto-sans-jp'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'
import './site.css'
import './docs.css'
import './landing.css'
import './playground.css'

export const metadata: Metadata = {
  title: 'live2d-web',
  description:
    'A Live2D runtime for the web. Load a Cubism model, react to taps, follow the pointer and lip sync. No PixiJS, no globals, React optional.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
