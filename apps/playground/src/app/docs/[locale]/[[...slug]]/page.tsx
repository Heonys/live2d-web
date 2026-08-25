import type { Metadata } from 'next'
import type { DocLocale } from '../../../../docs/content'
import Link from 'next/link'
import { notFound } from 'next/navigation'
import { readApiReference } from '../../../../docs/apiReference'
import { CodeBlock } from '../../../../docs/CodeBlock'
import { DOC_LOCALES, DOC_PAGES, docHref, getDocPage } from '../../../../docs/content'
import { DocSearch } from '../../../../docs/DocSearch'

const SITE_URL = 'https://live2d-web-demo.netlify.app'
const localeNames: Record<DocLocale, string> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}
const groupNames: Record<DocLocale, Record<string, string>> = {
  en: { Integrate: 'Integrate', Reference: 'Reference', Start: 'Start', Use: 'Use' },
  ja: { Integrate: '統合', Reference: 'リファレンス', Start: '導入', Use: '使い方' },
  ko: { Integrate: '통합', Reference: '레퍼런스', Start: '시작', Use: '사용' },
}
const headings: Record<DocLocale, { apiNote: string, inspector: string }> = {
  en: { apiNote: 'Signatures are generated from the public TypeScript source. Descriptions are shared in English.', inspector: 'Model inspector' },
  ja: { apiNote: 'signature は公開 TypeScript source から生成されます。説明文は英語原文を共通利用します。', inspector: 'モデル検査' },
  ko: { apiNote: '시그니처는 공개 TypeScript 소스에서 생성되며 설명은 영어 원문을 공통 사용합니다.', inspector: '모델 검사기' },
}

interface PageParameters {
  locale: string
  slug?: string[]
}

function isLocale(value: string): value is DocLocale {
  return DOC_LOCALES.includes(value as DocLocale)
}

function routeSlug(slug?: string[]) {
  return slug?.join('/') ?? ''
}

function apiAnchor(section: string, symbol: string) {
  return `${section.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${symbol}`
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
  const path = docHref(locale, page.slug)
  return {
    alternates: {
      canonical: `${SITE_URL}${path}`,
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
  const page = getDocPage(routeSlug(slug))
  if (!page)
    notFound()

  const reference = readApiReference()
  const searchEntries = DOC_PAGES.map(entry => ({
    href: docHref(locale, entry.slug),
    summary: entry.summary[locale],
    title: entry.title[locale],
  })).concat(reference.sections.flatMap(section => section.symbols.map(symbol => ({
    href: `${docHref(locale, 'api')}#${apiAnchor(section.title, symbol.name)}`,
    summary: symbol.description || `${section.title} ${symbol.kind}`,
    title: symbol.name,
  }))))
  const api = page.slug === 'api' ? reference : undefined
  const groups = ['Start', 'Use', 'Integrate', 'Reference'] as const

  return (
    <div className="docs-shell" lang={locale}>
      <aside className="docs-sidebar">
        <Link className="docs-brand" href={docHref(locale, '')}>live2d-web</Link>
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
        <header className="docs-topbar">
          <div className="docs-locales">
            {DOC_LOCALES.map(language => (
              <Link
                key={language}
                aria-current={language === locale ? 'page' : undefined}
                href={docHref(language, page.slug)}
                hrefLang={language}
              >
                {localeNames[language]}
              </Link>
            ))}
          </div>
          <Link href="/inspect">{headings[locale].inspector}</Link>
        </header>
        <article className="docs-article">
          <p className="eyebrow">live2d-web documentation</p>
          <h1>{page.title[locale]}</h1>
          <p className="docs-lead">{page.summary[locale]}</p>
          {page.sections.map(section => (
            <section key={section.heading.en}>
              <h2>{section.heading[locale]}</h2>
              {section.paragraphs[locale].map(paragraph => <p key={paragraph}>{paragraph}</p>)}
              {section.bullets && (
                <ul>
                  {section.bullets[locale].map(bullet => <li key={bullet}>{bullet}</li>)}
                </ul>
              )}
              {section.links && (
                <ul className="docs-links">
                  {section.links.map(link => (
                    <li key={link.href}>
                      <a href={link.href}>{link.label[locale]}</a>
                    </li>
                  ))}
                </ul>
              )}
              {section.code?.map(block => (
                <CodeBlock key={`${block.language}:${block.value}`} {...block} />
              ))}
            </section>
          ))}
          {api && (
            <section className="api-reference">
              <p>{headings[locale].apiNote}</p>
              {api.sections.map(section => (
                <div key={section.title}>
                  <h2>{section.title}</h2>
                  {section.symbols.map(symbol => (
                    <section
                      id={apiAnchor(section.title, symbol.name)}
                      key={symbol.name}
                    >
                      <span>{symbol.kind}</span>
                      <h3>{symbol.name}</h3>
                      {symbol.description && <p>{symbol.description}</p>}
                      <pre><code>{symbol.signatures.join('\n')}</code></pre>
                    </section>
                  ))}
                </div>
              ))}
            </section>
          )}
        </article>
      </main>
    </div>
  )
}
