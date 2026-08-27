import { notFound, redirect } from 'next/navigation'
import { isPrefixedSiteLocale, localizedDocPath } from '../../../i18n/site'

export default async function LocalizedExamplesPage({ params }: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await params
  if (!isPrefixedSiteLocale(locale))
    notFound()
  redirect(localizedDocPath(locale, 'examples'))
}
