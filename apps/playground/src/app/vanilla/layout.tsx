import type { Metadata } from 'next'
import type { ReactNode } from 'react'
import { localizedMetadata } from '../../i18n/metadata'

export const metadata: Metadata = localizedMetadata(
  'en',
  '/vanilla',
  'vanillaTitle',
  'vanillaDescription',
)

export default function VanillaLayout({ children }: { children: ReactNode }) {
  return children
}
