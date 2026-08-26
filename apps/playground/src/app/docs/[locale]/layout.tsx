import type { DocLocale } from '../../../docs/manifest'
import { notFound } from 'next/navigation'
import { SiteHeader } from '../../../components/SiteHeader'
import { ReadingProgress } from '../../../docs/DocsChrome'
import { DocsNavigationProvider } from '../../../docs/DocsNavigation'
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
    <DocsNavigationProvider>
      <ReadingProgress />
      <SiteHeader locale={locale} />
      <div className="docs-layout" lang={locale}>
        <DocsSidebar locale={locale} />
        {children}
      </div>
    </DocsNavigationProvider>
  )
}
