import type { Metadata } from 'next'
import type { SiteLocale, SiteMessages } from './site'
import { siteUrl } from '../lib/siteOrigin'
import { getSiteMessages, localizedPath, SITE_LOCALES } from './site'

type MetadataPage = keyof SiteMessages['metadata']

export function localizedMetadata(
  locale: SiteLocale,
  pathname: string,
  titleKey: MetadataPage,
  descriptionKey: MetadataPage,
): Metadata {
  const messages = getSiteMessages(locale).metadata
  const canonicalPath = localizedPath(locale, pathname)
  return {
    alternates: {
      canonical: siteUrl(canonicalPath),
      languages: Object.fromEntries(SITE_LOCALES.map(language => [
        language,
        siteUrl(localizedPath(language, pathname)),
      ])),
    },
    description: messages[descriptionKey],
    title: messages[titleKey],
  }
}
