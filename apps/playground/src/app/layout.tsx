import type { Metadata } from 'next'
import './globals.css'

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
