import type { DocLocale } from '../../../docs/manifest'
import { notFound } from 'next/navigation'
import { ReadingProgress } from '../../../docs/DocsChrome'
import { DocsSearchProvider } from '../../../docs/DocSearch'
import { DocsSidebar } from '../../../docs/DocsSidebar'
import { DOC_LOCALES } from '../../../docs/manifest'

function isLocale(value: string): value is DocLocale {
  return DOC_LOCALES.includes(value as DocLocale)
}

export function generateStaticParams() {
  return DOC_LOCALES.map(locale => ({ locale }))
}

export default async function DocumentationLayout({ children, params }: {
  children: React.ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isLocale(locale))
    notFound()
  return (
    <DocsSearchProvider locale={locale}>
      <ReadingProgress />
      <div className="docs-layout" lang={locale}>
        <DocsSidebar locale={locale} />
        {children}
      </div>
    </DocsSearchProvider>
  )
}
