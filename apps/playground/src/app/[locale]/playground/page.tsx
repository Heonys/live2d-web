import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localizedMetadata } from '../../../i18n/metadata'
import { isPrefixedSiteLocale } from '../../../i18n/site'
import PlaygroundPage from '../../playground/page'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  return localizedMetadata(locale, '/playground', 'playgroundTitle', 'playgroundDescription')
}

export default function LocalizedPlaygroundPage() {
  return <PlaygroundPage />
}
