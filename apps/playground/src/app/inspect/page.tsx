import type { Metadata } from 'next'
import type { SiteLocale } from '../../i18n/site'
import { Suspense } from 'react'
import { preload } from 'react-dom'
import { localizedMetadata } from '../../i18n/metadata'
import { getSiteMessages } from '../../i18n/site'
import { InspectorApp } from '../../inspector/InspectorApp'
import { CUBISM_CORE_URL } from '../../lib/assetManifest'

export const metadata: Metadata = localizedMetadata(
  'en',
  '/inspect',
  'inspectorTitle',
  'inspectorDescription',
)

export function InspectorPageContent({ locale }: { locale: SiteLocale }) {
  preload(CUBISM_CORE_URL, { as: 'script' })
  const messages = getSiteMessages(locale)

  return (
    <Suspense fallback={<main lang={locale}><p>{messages.common.loading}</p></main>}>
      <InspectorApp />
    </Suspense>
  )
}

export default function InspectorPage() {
  return <InspectorPageContent locale="en" />
}
