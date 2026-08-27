import type { MetadataRoute } from 'next'
import { DOC_LOCALES, DOC_PAGES, docHref } from '../docs/manifest'
import { localizedPath, SITE_LOCALES } from '../i18n/site'
import { siteUrl } from '../lib/siteOrigin'

export default function sitemap(): MetadataRoute.Sitemap {
  const tools = SITE_LOCALES.flatMap(locale => (
    ['/', '/playground', '/inspect', '/vanilla', '/compare'].map(path => ({
      changeFrequency: 'weekly' as const,
      url: siteUrl(localizedPath(locale, path)),
    }))
  ))
  const documentation = DOC_LOCALES.flatMap(locale => DOC_PAGES.map(page => ({
    changeFrequency: 'weekly' as const,
    url: siteUrl(docHref(locale, page.slug)),
  })))
  return [...tools, ...documentation]
}
