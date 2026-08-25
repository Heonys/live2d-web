import type { Metadata } from 'next'
import type { DocGroup, DocLocale } from '../../../../docs/manifest'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { SiteHeader } from '../../../../components/SiteHeader'
import { readApiReference } from '../../../../docs/apiReference'
import { DocsMobileNavigation, DocsToc, ReadingProgress } from '../../../../docs/DocsChrome'
import { DocSearch } from '../../../../docs/DocSearch'
import { HighlightedCode } from '../../../../docs/HighlightedCode'
import { DOC_LOADERS } from '../../../../docs/loaders'
import { DOC_LOCALES, DOC_PAGES, docHref, getDocPage } from '../../../../docs/manifest'
import { readDocSearch } from '../../../../docs/searchIndex'

const SITE_URL = 'https://live2d-web-demo.netlify.app'
const groupNames: Record<DocLocale, Record<DocGroup, string>> = {
  en: { Integrate: 'Integrate', Reference: 'Reference', Start: 'Start', Use: 'Use' },
  ja: { Integrate: '統合', Reference: 'リファレンス', Start: '導入', Use: '使い方' },
  ko: { Integrate: '통합', Reference: '레퍼런스', Start: '시작', Use: '사용' },
}
const labels: Record<DocLocale, { apiNote: string, next: string, previous: string }> = {
  en: { apiNote: 'Signatures are generated from the public TypeScript source.', next: 'Next', previous: 'Previous' },
  ja: { apiNote: 'signature は公開 TypeScript source から生成されます。', next: '次へ', previous: '前へ' },
  ko: { apiNote: '시그니처는 공개 TypeScript 소스에서 생성됩니다.', next: '다음', previous: '이전' },
}

interface PageParameters { locale: string, slug?: string[] }

function isLocale(value: string): value is DocLocale {
  return DOC_LOCALES.includes(value as DocLocale)
}

function routeSlug(slug?: string[]) {
  return slug?.join('/') ?? ''
}

function apiAnchor(section: string, symbol: string) {
  return `${section.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${symbol.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
}

export function generateStaticParams() {
  return DOC_LOCALES.flatMap(locale => DOC_PAGES.map(page => ({
    locale,
    slug: page.slug ? [page.slug] : [],
  })))
}

export async function generateMetadata({ params }: {
  params: Promise<PageParameters>
}): Promise<Metadata> {
  const { locale, slug } = await params
  if (!isLocale(locale))
    return {}
  const page = getDocPage(routeSlug(slug))
  if (!page)
    return {}
  const pagePath = docHref(locale, page.slug)
  return {
    alternates: {
      canonical: `${SITE_URL}${pagePath}`,
      languages: Object.fromEntries(DOC_LOCALES.map(language => [
        language,
        `${SITE_URL}${docHref(language, page.slug)}`,
      ])),
    },
    description: page.summary[locale],
    title: `${page.title[locale]} · live2d-web`,
  }
}

export default async function DocumentationPage({ params }: {
  params: Promise<PageParameters>
}) {
  const { locale, slug } = await params
  if (!isLocale(locale))
    notFound()
  const currentSlug = routeSlug(slug)
  const page = getDocPage(currentSlug)
  const loader = DOC_LOADERS[locale][currentSlug]
  if (!page || !loader)
    notFound()

  const Content = (await loader()).default
  const reference = readApiReference()
  const searchEntries = readDocSearch(locale).map(entry => ({
    href: entry.href,
    summary: entry.summary,
    text: entry.text,
    title: entry.title,
  })).concat(reference.sections.flatMap(section => section.symbols.map(symbol => ({
    href: `${docHref(locale, 'api')}#${apiAnchor(section.title, symbol.name)}`,
    summary: symbol.description || `${section.title} ${symbol.kind}`,
    text: symbol.signatures.join(' '),
    title: symbol.name,
  }))))
  const api = page.slug === 'api' ? reference : undefined
  const groups: readonly DocGroup[] = ['Start', 'Use', 'Integrate', 'Reference']
  const pageIndex = DOC_PAGES.findIndex(entry => entry.slug === page.slug)
  const previous = DOC_PAGES[pageIndex - 1]
  const next = DOC_PAGES[pageIndex + 1]

  return (
    <>
      <ReadingProgress />
      <SiteHeader docSlug={page.slug} locale={locale} />
      <div className="docs-layout" lang={locale}>
        <aside className="docs-sidebar">
          <Link className="docs-sidebar-brand" href={docHref(locale, '')}>Documentation</Link>
          <DocSearch entries={searchEntries} locale={locale} />
          <nav aria-label="Documentation">
            {groups.map(group => (
              <section key={group}>
                <h2>{groupNames[locale][group]}</h2>
                {DOC_PAGES.filter(entry => entry.group === group).map(entry => (
                  <Link
                    key={entry.slug}
                    aria-current={entry.slug === page.slug ? 'page' : undefined}
                    href={docHref(locale, entry.slug)}
                  >
                    {entry.title[locale]}
                  </Link>
                ))}
              </section>
            ))}
          </nav>
        </aside>
        <main className="docs-main">
          <DocsMobileNavigation current={page.slug} locale={locale} pages={DOC_PAGES} />
          <article className="docs-article">
            <p className="eyebrow">live2d-web documentation</p>
            <h1>{page.title[locale]}</h1>
            <p className="docs-lead">{page.summary[locale]}</p>
            <Content />
            {api && (
              <section className="api-reference">
                <p>{labels[locale].apiNote}</p>
                {api.sections.map(section => (
                  <section key={section.title}>
                    <h2 id={apiAnchor(section.title, section.title)}>{section.title}</h2>
                    {section.symbols.map(symbol => (
                      <section className="api-symbol" id={apiAnchor(section.title, symbol.name)} key={symbol.name}>
                        <span>{symbol.kind}</span>
                        <h3 data-api-symbol>{symbol.name}</h3>
                        {symbol.description && <p>{symbol.description}</p>}
                        <HighlightedCode code={symbol.signatures.join('\n')} />
                      </section>
                    ))}
                  </section>
                ))}
              </section>
            )}
            <nav aria-label="Pagination" className="docs-pager">
              {previous
                ? (
                    <Link href={docHref(locale, previous.slug)}>
                      <span>{labels[locale].previous}</span>
                      <strong>{previous.title[locale]}</strong>
                    </Link>
                  )
                : <span />}
              {next && (
                <Link href={docHref(locale, next.slug)}>
                  <span>{labels[locale].next}</span>
                  <strong>{next.title[locale]}</strong>
                </Link>
              )}
            </nav>
          </article>
        </main>
        <DocsToc locale={locale} />
      </div>
    </>
  )
}
