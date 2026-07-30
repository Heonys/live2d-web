import type { Metadata } from 'next'
import './globals.css'

export const metadata: Metadata = {
  title: 'live2d-jsx playground',
  description: 'Declarative Live2D for React',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en">
      <body>{children}</body>
    </html>
  )
}
