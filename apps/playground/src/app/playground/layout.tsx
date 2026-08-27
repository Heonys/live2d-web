import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { localizedMetadata } from '../../i18n/metadata'

export const metadata: Metadata = localizedMetadata(
  'en',
  '/playground',
  'playgroundTitle',
  'playgroundDescription',
)

export default function PlaygroundLayout({ children }: { children: ReactNode }) {
  return children
}
