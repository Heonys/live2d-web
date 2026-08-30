'use client'

import type { ReactNode } from 'react'
import dynamic from 'next/dynamic'
import { usePathname } from 'next/navigation'
import { createContext, use, useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useSiteLocale } from '../i18n/SiteLocale'

const SearchDialog = dynamic(
  () => import('./DocSearchDialog').then(module => module.DocSearchDialog),
  { ssr: false },
)

const triggerLabels = {
  en: 'Search',
  ja: '検索',
  ko: '검색',
} as const

interface DocsSearchContextValue {
  open: boolean
  openSearch: (opener?: HTMLElement | null) => void
  triggerLabel: string
}

const DocsSearchContext = createContext<DocsSearchContextValue>({
  open: false,
  openSearch: () => {},
  triggerLabel: triggerLabels.en,
})

export function DocsSearchProvider({ children }: { children: ReactNode }) {
  const locale = useSiteLocale()
  const pathname = usePathname()
  const openerRef = useRef<HTMLElement | null>(null)
  const [openPathname, setOpenPathname] = useState<string>()
  const open = openPathname === pathname

  const closeSearch = useCallback((restoreFocus = true) => {
    setOpenPathname(undefined)
    if (restoreFocus) {
      requestAnimationFrame(() => {
        if (openerRef.current?.isConnected)
          openerRef.current.focus()
      })
    }
  }, [])

  const openSearch = useCallback((opener?: HTMLElement | null) => {
    openerRef.current = opener ?? (document.activeElement instanceof HTMLElement
      ? document.activeElement
      : null)
    setOpenPathname(pathname)
  }, [pathname])

  useEffect(() => {
    const handleKeyDown = (event: KeyboardEvent) => {
      const target = event.target as HTMLElement | null
      const editable = target?.matches('input, textarea, select, [contenteditable="true"]')
      const commandSearch = (event.metaKey || event.ctrlKey) && event.key.toLowerCase() === 'k'
      const slashSearch = event.key === '/' && !event.metaKey && !event.ctrlKey && !event.altKey
      if ((!commandSearch && !slashSearch) || editable)
        return
      event.preventDefault()
      openSearch(target)
    }
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [openSearch])

  const value = useMemo(() => ({ open, openSearch, triggerLabel: triggerLabels[locale] }), [locale, open, openSearch])
  return (
    <DocsSearchContext value={value}>
      {children}
      {open && <SearchDialog key={locale} locale={locale} onClose={closeSearch} />}
    </DocsSearchContext>
  )
}

export function DocsSearchTrigger() {
  const { open, openSearch, triggerLabel } = use(DocsSearchContext)
  return (
    <button aria-expanded={open} aria-haspopup="dialog" className="docs-search-trigger" type="button" onClick={event => openSearch(event.currentTarget)}>
      <svg aria-hidden="true" viewBox="0 0 24 24">
        <circle cx="11" cy="11" r="6.5" />
        <path d="m16 16 4 4" />
      </svg>
      <span>{triggerLabel}</span>
      <kbd>/</kbd>
    </button>
  )
}
