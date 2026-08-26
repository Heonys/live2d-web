import type { DocLocale } from '../../../docs/manifest'
import { DOC_LOCALES } from '../../../docs/manifest'
import { readCombinedDocSearch } from '../../../docs/searchIndex'

export const dynamic = 'force-static'

function isLocale(value: string): value is DocLocale {
  return DOC_LOCALES.includes(value as DocLocale)
}

export function generateStaticParams() {
  return DOC_LOCALES.map(locale => ({ locale }))
}

export async function GET(_request: Request, context: {
  params: Promise<{ locale: string }>
}) {
  const { locale } = await context.params
  if (!isLocale(locale))
    return Response.json({ error: 'not-found' }, { status: 404 })
  return Response.json(readCombinedDocSearch(locale), {
    headers: {
      'Cache-Control': 'public, max-age=0, must-revalidate',
    },
  })
}
