import type { ReactNode } from 'react'
import './style.css'

export default function Layout({ children }: { children: ReactNode }) {
  return <html lang="en"><body>{children}</body></html>
}
