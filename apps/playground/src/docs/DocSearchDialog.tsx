'use client'

import type { KeyboardEvent as ReactKeyboardEvent } from 'react'
import type { DocLocale } from './manifest'
import type { DocSearchEntry } from './searchTypes'
import { usePathname, useRouter } from 'next/navigation'
import { useDeferredValue, useEffect, useId, useMemo, useRef, useState } from 'react'
import { createPortal } from 'react-dom'
import { useDocsNavigation } from './docsNavigationContext'
import { loadDocSearch } from './searchClient'

const labels: Record<DocLocale, {
  api: string
  clear: string
  close: string
  failed: string
  hint: string
  label: string
  loading: string
  navigate: string
  noResults: string
  openResult: string
  page: string
  placeholder: string
}> = {
  en: { api: 'API', clear: 'Clear search', close: 'Close documentation search', failed: 'Search could not be loaded.', hint: 'Search guides and the generated API reference.', label: 'Search documentation', loading: 'Loading search…', navigate: 'Navigate', noResults: 'No matching pages.', openResult: 'Open', page: 'Guide', placeholder: 'Search documentation' },
  ja: { api: 'API', clear: '検索をクリア', close: 'ドキュメント検索を閉じる', failed: '検索を読み込めませんでした。', hint: 'ガイドと自動生成された API リファレンスを検索します。', label: 'ドキュメントを検索', loading: '検索を読み込み中…', navigate: '移動', noResults: '一致するページがありません。', openResult: '開く', page: 'ガイド', placeholder: 'ドキュメントを検索' },
  ko: { api: 'API', clear: '검색 지우기', close: '문서 검색 닫기', failed: '검색을 불러오지 못했습니다.', hint: '가이드와 자동 생성된 API 레퍼런스를 검색합니다.', label: '문서 검색', loading: '검색 불러오는 중…', navigate: '이동', noResults: '일치하는 문서가 없습니다.', openResult: '열기', page: '가이드', placeholder: '문서 검색' },
}

export function DocSearchDialog({ locale, onClose }: { locale: DocLocale, onClose: (restoreFocus?: boolean) => void }) {
  const pathname = usePathname()
  const router = useRouter()
  const { markPending, prefetch } = useDocsNavigation()
  const dialogRef = useRef<HTMLDivElement>(null)
  const inputRef = useRef<HTMLInputElement>(null)
  const resultsId = useId()
  const [active, setActive] = useState(0)
  const [entries, setEntries] = useState<readonly DocSearchEntry[]>([])
  const [failed, setFailed] = useState(false)
  const [loading, setLoading] = useState(true)
  const [query, setQuery] = useState('')
  const deferredQuery = useDeferredValue(query)

  useEffect(() => {
    let cancelled = false
    void loadDocSearch(locale)
      .then((result) => {
        if (!cancelled)
          setEntries(result)
      })
      .catch(() => {
        if (!cancelled)
          setFailed(true)
      })
      .finally(() => {
        if (!cancelled)
          setLoading(false)
      })
    return () => {
      cancelled = true
    }
  }, [locale])
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    requestAnimationFrame(() => inputRef.current?.focus())
    return () => {
      document.body.style.overflow = previous
    }
  }, [])

  const results = useMemo(() => {
    const normalized = deferredQuery.trim().toLocaleLowerCase(locale)
    if (!normalized)
      return []
    return entries.filter(entry => `${entry.title} ${entry.summary} ${entry.text}`.toLocaleLowerCase(locale).includes(normalized)).slice(0, 8)
  }, [deferredQuery, entries, locale])
  const navigate = (entry: DocSearchEntry) => {
    onClose(false)
    if (entry.href.split('#')[0] !== pathname)
      markPending()
    router.push(entry.href)
  }
  const handleInputKeyDown = (event: ReactKeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
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
  const handleDialogKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    if (event.key === 'Escape') {
      event.preventDefault()
      onClose()
      return
    }
    if (event.key !== 'Tab')
      return
    const focusable = [...(dialogRef.current?.querySelectorAll<HTMLElement>('input, button, a[href]') ?? [])]
    const first = focusable[0]
    const last = focusable.at(-1)
    if (!first || !last)
      return
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault()
      last.focus()
    }
    else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault()
      first.focus()
    }
  }
  const showResults = Boolean(query.trim())
  return createPortal(
    <div
      className="docs-search-backdrop"
      onPointerDown={(event) => {
        if (event.target === event.currentTarget)
          onClose()
      }}
    >
      <div ref={dialogRef} aria-label={labels[locale].label} aria-modal="true" className="docs-search-dialog" role="dialog" onKeyDown={handleDialogKeyDown}>
        <div className="docs-search-dialog-header">
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
              }}
              onKeyDown={handleInputKeyDown}
            />
            {query && (
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
            )}
          </label>
          <button aria-label={labels[locale].close} className="docs-search-close" type="button" onClick={() => onClose()}>Esc</button>
        </div>
        <div id={resultsId} className="docs-search-results" role="listbox">
          {!showResults && <span>{labels[locale].hint}</span>}
          {showResults && loading && <span>{labels[locale].loading}</span>}
          {showResults && failed && <span>{labels[locale].failed}</span>}
          {showResults && !loading && !failed && !results.length && <span>{labels[locale].noResults}</span>}
          {showResults && results.map((entry, index) => (
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
        <footer className="docs-search-footer">
          <span>
            <kbd>↑</kbd>
            <kbd>↓</kbd>
            {' '}
            {labels[locale].navigate}
          </span>
          <span>
            <kbd>↵</kbd>
            {' '}
            {labels[locale].openResult}
          </span>
        </footer>
      </div>
    </div>,
    document.body,
  )
}
