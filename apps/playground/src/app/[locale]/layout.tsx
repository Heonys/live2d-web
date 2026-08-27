import type { ReactNode } from 'react'
import { notFound } from 'next/navigation'
import { isPrefixedSiteLocale, PREFIXED_SITE_LOCALES } from '../../i18n/site'

export const dynamicParams = false

export function generateStaticParams() {
  return PREFIXED_SITE_LOCALES.map(locale => ({ locale }))
}

export default async function LocalizedLayout({
  children,
  params,
}: {
  children: ReactNode
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  return <div lang={locale}>{children}</div>
}
