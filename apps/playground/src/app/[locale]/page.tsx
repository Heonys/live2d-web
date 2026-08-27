import type { Metadata } from 'next'
import { notFound } from 'next/navigation'
import { localizedMetadata } from '../../i18n/metadata'
import { isPrefixedSiteLocale } from '../../i18n/site'
import { LandingPageContent } from '../page'

export async function generateMetadata({ params }: {
  params: Promise<{ locale: string }>
}): Promise<Metadata> {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  return localizedMetadata(locale, '/', 'landingTitle', 'landingDescription')
}

export default async function LocalizedLandingPage({ params }: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  return <LandingPageContent locale={locale} />
}
