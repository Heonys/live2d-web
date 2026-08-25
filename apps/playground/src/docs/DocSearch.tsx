'use client'

import type { DocLocale } from './manifest'
import Link from 'next/link'
import { useMemo, useState } from 'react'

export interface DocSearchEntry {
  href: string
  summary: string
  text: string
  title: string
}

const labels: Record<DocLocale, { label: string, noResults: string }> = {
  en: { label: 'Search documentation', noResults: 'No matching pages.' },
  ja: { label: 'ドキュメントを検索', noResults: '該当するページがありません。' },
  ko: { label: '문서 검색', noResults: '일치하는 문서가 없습니다.' },
}

export function DocSearch({ entries, locale }: {
  entries: readonly DocSearchEntry[]
  locale: DocLocale
}) {
  const [query, setQuery] = useState('')
  const results = useMemo(() => {
    const normalized = query.trim().toLocaleLowerCase(locale)
    if (!normalized)
      return []
    return entries.filter(entry =>
      `${entry.title} ${entry.summary} ${entry.text}`.toLocaleLowerCase(locale).includes(normalized))
  }, [entries, locale, query])

  return (
    <div className="docs-search">
      <label>
        {labels[locale].label}
        <input
          type="search"
          value={query}
          onChange={event => setQuery(event.target.value)}
        />
      </label>
      {query.trim() && (
        <div className="docs-search-results">
          {results.length
            ? results.map(entry => (
                <Link key={entry.href} href={entry.href}>
                  <strong>{entry.title}</strong>
                  <span>{entry.summary}</span>
                </Link>
              ))
            : <span>{labels[locale].noResults}</span>}
        </div>
      )}
    </div>
  )
}
