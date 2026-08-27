import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localizedMetadata } from '../../../i18n/metadata'
import { isPrefixedSiteLocale } from '../../../i18n/site'
import VanillaPlayground from '../../vanilla/page'

export async function generateMetadata({ params }: { params: Promise<{ locale: string }> }): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  return localizedMetadata(locale, '/vanilla', 'vanillaTitle', 'vanillaDescription')
}

export default function LocalizedVanillaPage() {
  return <VanillaPlayground />
}
