import type { MetadataRoute } from 'next'
import { DOC_LOCALES, DOC_PAGES, docHref } from '../docs/manifest'

const SITE_URL = 'https://live2d-web-demo.netlify.app'

export default function sitemap(): MetadataRoute.Sitemap {
  const tools = ['', '/playground', '/inspect', '/vanilla', '/compare']
    .map(path => ({ changeFrequency: 'weekly' as const, url: `${SITE_URL}${path}` }))
  const documentation = DOC_LOCALES.flatMap(locale => DOC_PAGES.map(page => ({
    changeFrequency: 'weekly' as const,
    url: `${SITE_URL}${docHref(locale, page.slug)}`,
  })))
  return [...tools, ...documentation]
}
