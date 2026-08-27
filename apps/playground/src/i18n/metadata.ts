import type { Metadata } from 'next'
import type { SiteLocale, SiteMessages } from './site'
import { siteUrl } from '../lib/siteOrigin'
import { getSiteMessages, localizedPath, SITE_LOCALES } from './site'

type MetadataPage = keyof SiteMessages['metadata']

const OPEN_GRAPH_LOCALES: Record<SiteLocale, string> = {
  en: 'en_US',
  ja: 'ja_JP',
  ko: 'ko_KR',
}

export function openGraphLocale(locale: SiteLocale) {
  return OPEN_GRAPH_LOCALES[locale]
}

export function localizedMetadata(
  locale: SiteLocale,
  pathname: string,
  titleKey: MetadataPage,
  descriptionKey: MetadataPage,
): Metadata {
  const messages = getSiteMessages(locale).metadata
  const canonicalPath = localizedPath(locale, pathname)
  const title = messages[titleKey]
  const description = messages[descriptionKey]
  return {
    alternates: {
      canonical: siteUrl(canonicalPath),
      languages: Object.fromEntries(SITE_LOCALES.map(language => [
        language,
        siteUrl(localizedPath(language, pathname)),
      ])),
    },
    description,
    openGraph: {
      alternateLocale: SITE_LOCALES
        .filter(language => language !== locale)
        .map(language => OPEN_GRAPH_LOCALES[language]),
      description,
      locale: OPEN_GRAPH_LOCALES[locale],
      siteName: 'live2d-web',
      title,
      type: 'website',
      url: siteUrl(canonicalPath),
    },
    title,
    twitter: {
      card: 'summary_large_image',
      description,
      title,
    },
  }
}
