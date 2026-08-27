import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localizedMetadata } from '../../../i18n/metadata'
import { isPrefixedSiteLocale } from '../../../i18n/site'
import BackendComparison from '../../compare/page'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  return localizedMetadata(locale, '/compare', 'compareTitle', 'compareDescription')
}

export default function LocalizedComparePage() {
  return <BackendComparison />
}
