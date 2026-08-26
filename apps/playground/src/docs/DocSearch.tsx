'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { DocLocale } from './manifest'
import type { DocSearchEntry } from './searchTypes'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { useDocsNavigation } from './docsNavigationContext'
import { loadDocSearch } from './searchClient'

const labels: Record<DocLocale, {
  api: string
  clear: string
  failed: string
  label: string
  loading: string
  noResults: string
  page: string
  placeholder: string
}> = {
  en: {
    api: 'API',
    clear: 'Clear search',
    failed: 'Search could not be loaded.',
    label: 'Search documentation',
    loading: 'Loading search…',
    noResults: 'No matching pages.',
    page: 'Guide',
    placeholder: 'Search docs',
  },
  ja: {
    api: 'API',
    clear: '検索をクリア',
    failed: '検索を読み込めませんでした。',
    label: 'ドキュメントを検索',
    loading: '検索を読み込み中…',
    noResults: '該当するページがありません。',
    page: 'ガイド',
    placeholder: 'ドキュメントを検索',
  },
  ko: {
    api: 'API',
    clear: '검색 지우기',
    failed: '검색을 불러오지 못했습니다.',
    label: '문서 검색',
    loading: '검색 불러오는 중…',
    noResults: '일치하는 문서가 없습니다.',
    page: '가이드',
    placeholder: '문서 검색',
  },
}

export function DocSearch({ locale }: { locale: DocLocale }) {
  const pathname = usePathname()
  const router = useRouter()
  const { markPending, prefetch } = useDocsNavigation()
  const rootRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const loadRef = useRef<Promise<void>>(undefined)
  const resultsId = useId()
  const [active, setActive] = useState(0)
  const [entries, setEntries] = useState<readonly DocSearchEntry[]>([])
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(false)
  const [open, setOpen] = useState(false)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  const ensureLoaded = useCallback(() => {
    if (loadRef.current)
      return
    setLoading(true)
    setFailed(false)
    const request = loadDocSearch(locale).then((result) => {
      setEntries(result)
    }).catch(() => {
      loadRef.current = undefined
      setFailed(true)
    }).finally(() => setLoading(false))
    loadRef.current = request
  }, [locale])
  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase(locale)
    if (!normalized)
      return []
    return entries.filter(entry =>
      `${entry.title} ${entry.summary} ${entry.text}`.toLocaleLowerCase(locale).includes(normalized)).slice(0, 8)
  }, [deferredQuery, entries, locale])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== '/' || event.metaKey || event.ctrlKey || event.altKey)
        return
      const target = event.target as HTMLElement | null
      if (target?.matches('input, textarea, select, [contenteditable="true"]'))
        return
      if (!inputRef.current || inputRef.current.offsetParent === null)
        return
      event.preventDefault()
      ensureLoaded()
      setOpen(true)
      inputRef.current.focus()
    }
    const handlePointerDown = (event: PointerEvent) => {
      if (!rootRef.current?.contains(event.target as Node))
        setOpen(false)
    }
    document.addEventListener('keydown', handleKeyDown)
    document.addEventListener('pointerdown', handlePointerDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      document.removeEventListener('pointerdown', handlePointerDown)
    }
  }, [ensureLoaded])

  const navigate = (entry: DocSearchEntry) => {
    setOpen(false)
    setQuery('')
    if (entry.href.split('#')[0] !== pathname)
      markPending()
    router.push(entry.href)
  }
  const handleKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      setOpen(false)
      inputRef.current?.blur()
      return
    }
    if (!results.length)
      return
    if (event.key === 'ArrowDown') {
      event.preventDefault()
      setActive(value => (value + 1) % results.length)
    }
    else if (event.key === 'ArrowUp') {
      event.preventDefault()
      setActive(value => (value - 1 + results.length) % results.length)
    }
    else if (event.key === 'Enter') {
      event.preventDefault()
      const entry = results[active]
      if (entry)
        navigate(entry)
    }
  }
  const showResults = open && Boolean(query.trim())

  return (
    <div ref={rootRef} className="docs-search">
      <label className="docs-search-field">
        <span className="docs-visually-hidden">{labels[locale].label}</span>
        <svg aria-hidden="true" viewBox="0 0 24 24">
          <circle cx="11" cy="11" r="6.5" />
          <path d="m16 16 4 4" />
        </svg>
        <input
          ref={inputRef}
          aria-activedescendant={showResults && results[active] ? `${resultsId}-${active}` : undefined}
          aria-autocomplete="list"
          aria-controls={resultsId}
          aria-expanded={showResults}
          aria-label={labels[locale].label}
          placeholder={labels[locale].placeholder}
          role="combobox"
          type="search"
          value={query}
          onChange={(event) => {
            setActive(0)
            setQuery(event.target.value)
            setOpen(true)
          }}
          onFocus={() => {
            ensureLoaded()
            setOpen(true)
          }}
          onKeyDown={handleKeyDown}
        />
        {query
          ? (
              <button
                aria-label={labels[locale].clear}
                className="docs-search-clear"
                type="button"
                onClick={() => {
                  setQuery('')
                  inputRef.current?.focus()
                }}
              >
                ×
              </button>
            )
          : <kbd aria-hidden="true">/</kbd>}
      </label>
      {showResults && (
        <div id={resultsId} className="docs-search-results" role="listbox">
          {loading && <span>{labels[locale].loading}</span>}
          {failed && <span>{labels[locale].failed}</span>}
          {!loading && !failed && !results.length && <span>{labels[locale].noResults}</span>}
          {results.map((entry, index) => (
            <a
              key={entry.href}
              id={`${resultsId}-${index}`}
              aria-selected={active === index}
              href={entry.href}
              role="option"
              onClick={(event) => {
                if (event.metaKey || event.ctrlKey || event.shiftKey || event.button !== 0)
                  return
                event.preventDefault()
                navigate(entry)
              }}
              onFocus={() => setActive(index)}
              onPointerEnter={() => {
                setActive(index)
                prefetch(entry.href)
              }}
            >
              <span>{entry.kind === 'api' ? labels[locale].api : labels[locale].page}</span>
              <strong>{entry.title}</strong>
              <small>{entry.summary}</small>
            </a>
          ))}
        </div>
      )}
    </div>
  )
}
