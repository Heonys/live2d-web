import type { Metadata } from 'next'
import type { DocLocale } from '../../../../docs/manifest'
import { notFound } from 'next/navigation'
import { apiAnchor, readApiReference } from '../../../../docs/apiReference'
import { DocsMain, DocsToc } from '../../../../docs/DocsChrome'
import { DocsIntentLink } from '../../../../docs/DocsNavigation'
import { HighlightedCode } from '../../../../docs/HighlightedCode'
import { DOC_LOADERS } from '../../../../docs/loaders'
import { DOC_LOCALES, DOC_PAGES, docHref, getDocPage } from '../../../../docs/manifest'
import { siteUrl } from '../../../../lib/siteOrigin'

const labels: Record<DocLocale, { apiNote: string, eyebrow: string, pagination: string, next: string, previous: string }> = {
  en: { apiNote: 'Signatures are generated from the public TypeScript source.', eyebrow: 'live2d-web documentation', next: 'Next', pagination: 'Pagination', previous: 'Previous' },
  ja: { apiNote: '公開 TypeScript の型定義から自動生成しています。', eyebrow: 'live2d-web ドキュメント', next: '次へ', pagination: 'ページ移動', previous: '前へ' },
  ko: { apiNote: '공개 TypeScript 선언을 바탕으로 자동 생성합니다.', eyebrow: 'live2d-web 문서', next: '다음', pagination: '페이지 이동', previous: '이전' },
}

interface PageParameters { locale: string, slug?: string[] }

function isLocale(value: string): value is DocLocale {
  return DOC_LOCALES.includes(value as DocLocale)
}

function routeSlug(slug?: string[]) {
  return slug?.join('/') ?? ''
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
      canonical: siteUrl(pagePath),
      languages: Object.fromEntries(DOC_LOCALES.map(language => [
        language,
        siteUrl(docHref(language, page.slug)),
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
  const api = page.slug === 'api' ? readApiReference() : undefined
  const pageIndex = DOC_PAGES.findIndex(entry => entry.slug === page.slug)
  const previous = DOC_PAGES[pageIndex - 1]
  const next = DOC_PAGES[pageIndex + 1]

  return (
    <>
      <DocsMain>
        <article className="docs-article">
          <p className="eyebrow">{labels[locale].eyebrow}</p>
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
          <nav aria-label={labels[locale].pagination} className="docs-pager">
            {previous
              ? (
                  <DocsIntentLink href={docHref(locale, previous.slug)}>
                    <span>{labels[locale].previous}</span>
                    <strong>{previous.title[locale]}</strong>
                  </DocsIntentLink>
                )
              : <span />}
            {next && (
              <DocsIntentLink href={docHref(locale, next.slug)}>
                <span>{labels[locale].next}</span>
                <strong>{next.title[locale]}</strong>
              </DocsIntentLink>
            )}
          </nav>
        </article>
      </DocsMain>
      <DocsToc locale={locale} />
    </>
  )
}
