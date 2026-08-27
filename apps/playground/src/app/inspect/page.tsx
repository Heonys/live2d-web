import type { Metadata } from 'next'
import { preload } from 'react-dom'
import { localizedMetadata } from '../../i18n/metadata'
import { InspectorApp } from '../../inspector/InspectorApp'
import { CUBISM_CORE_URL } from '../../lib/assetManifest'

export const metadata: Metadata = localizedMetadata(
  'en',
  '/inspect',
  'inspectorTitle',
  'inspectorDescription',
)

export function InspectorPageContent() {
  preload(CUBISM_CORE_URL, { as: 'script' })
  return <InspectorApp />
}

export default function InspectorPage() {
  return <InspectorPageContent />
}
