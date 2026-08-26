import type { DocLocale } from './manifest'
import type { DocSearchEntry } from './searchTypes'

const searchCache = new Map<DocLocale, Promise<readonly DocSearchEntry[]>>()
const fontWarmCache = new Map<string, Promise<void>>()

export function loadDocSearch(locale: DocLocale): Promise<readonly DocSearchEntry[]> {
  const cached = searchCache.get(locale)
  if (cached)
    return cached
  const request = fetch(`/docs-search/${locale}`, { cache: 'force-cache' })
    .then((response) => {
      if (!response.ok)
        throw new Error(`Documentation search failed: HTTP ${response.status}`)
      return response.json() as Promise<readonly DocSearchEntry[]>
    })
    .catch((error) => {
      searchCache.delete(locale)
      throw error
    })
  searchCache.set(locale, request)
  return request
}

function uniqueGlyphs(value: string) {
  return [...new Set(value.replaceAll(/\s+/g, ''))].join('')
}

export function warmLocaleFonts(locale: DocLocale, slug: string): Promise<void> {
  if (locale === 'en' || typeof document === 'undefined' || !document.fonts)
    return Promise.resolve()
  const key = `${locale}:${slug}`
  const cached = fontWarmCache.get(key)
  if (cached)
    return cached
  const request = loadDocSearch(locale).then(async (entries) => {
    const href = `/docs/${locale}${slug ? `/${slug}` : ''}`
    const entry = entries.find(candidate => candidate.kind === 'page' && candidate.href === href)
    const text = uniqueGlyphs(`${entry?.title ?? ''}${entry?.summary ?? ''}${entry?.text ?? ''}`)
    if (!text)
      return
    const family = locale === 'ko' ? 'Pretendard Variable' : 'Noto Sans JP Variable'
    await Promise.all([400, 600, 700].map(weight =>
      document.fonts.load(`${weight} 16px "${family}"`, text)))
  }).catch(() => {
    fontWarmCache.delete(key)
  })
  fontWarmCache.set(key, request)
  return request
}
