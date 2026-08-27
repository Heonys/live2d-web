import type { MetadataRoute } from 'next'
import { DOC_LOCALES, DOC_PAGES, docHref } from '../docs/manifest'
import { siteUrl } from '../lib/siteOrigin'

export default function sitemap(): MetadataRoute.Sitemap {
  const tools = ['', '/playground', '/inspect', '/vanilla', '/compare']
    .map(path => ({ changeFrequency: 'weekly' as const, url: siteUrl(path) }))
  const documentation = DOC_LOCALES.flatMap(locale => DOC_PAGES.map(page => ({
    changeFrequency: 'weekly' as const,
    url: siteUrl(docHref(locale, page.slug)),
  })))
  return [...tools, ...documentation]
}
