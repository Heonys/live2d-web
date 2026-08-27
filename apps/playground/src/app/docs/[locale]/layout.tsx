import type { DocLocale } from '../../../docs/manifest'
import { notFound } from 'next/navigation'
import { ReadingProgress } from '../../../docs/DocsChrome'
import { DocsSidebar } from '../../../docs/DocsSidebar'
import { DOC_LOCALES } from '../../../docs/manifest'
import { MobileDocsNavigation } from '../../../docs/MobileDocsNavigation'

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
    <>
      <ReadingProgress />
      <MobileDocsNavigation locale={locale} />
      <div className="docs-layout" lang={locale}>
        <DocsSidebar locale={locale} />
        {children}
      </div>
    </>
  )
}
