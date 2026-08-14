import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'live2d-web playground',
  description: 'Vanilla-first Live2D runtime with optional React bindings',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
