'use client'

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { DocLocale } from '../docs/manifest'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useDocsNavigation } from '../docs/docsNavigationContext'
import { docHref } from '../docs/manifest'
import { warmLocaleFonts } from '../docs/searchClient'

const languageNames: Record<DocLocale, string> = {
  en: 'English',
  ja: '日本語',
  ko: '한국어',
}

const languages = ['en', 'ko', 'ja'] as const

export function SiteHeader({ docSlug = '', locale = 'en' }: {
  docSlug?: string
  locale?: DocLocale
}) {
  const pathname = usePathname()
  const router = useRouter()
  const { markPending } = useDocsNavigation()
  const [navigationOpen, setNavigationOpen] = useState(false)
  const [languageOpen, setLanguageOpen] = useState(false)
  const languageRootRef = useRef<HTMLDivElement>(null)
  const languageTriggerRef = useRef<HTMLButtonElement>(null)
  const prefetchedRef = useRef(new Set<string>())
  const docsMatch = pathname.match(/^\/docs\/(en|ko|ja)(?:\/(.*))?$/)
  const currentLocale = (docsMatch?.[1] as DocLocale | undefined) ?? locale
  const currentDocSlug = docsMatch?.[2] ?? docSlug

  const prepareLanguage = (language: DocLocale) => {
    const href = docHref(language, currentDocSlug)
    if (!prefetchedRef.current.has(href)) {
      prefetchedRef.current.add(href)
      router.prefetch(href)
    }
    return warmLocaleFonts(language, currentDocSlug)
  }

  useEffect(() => {
    if (!languageOpen)
      return
    const handlePointerDown = (event: PointerEvent) => {
      if (!languageRootRef.current?.contains(event.target as Node))
        setLanguageOpen(false)
    }
    const handleKeyDown = (event: KeyboardEvent) => {
      if (event.key !== 'Escape')
        return
      setLanguageOpen(false)
      languageTriggerRef.current?.focus()
    }
    document.addEventListener('pointerdown', handlePointerDown)
    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('pointerdown', handlePointerDown)
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [languageOpen])

  const closeNavigation = () => {
    setNavigationOpen(false)
    setLanguageOpen(false)
  }
  const openLanguageMenu = () => {
    setLanguageOpen(true)
    for (const language of languages) {
      if (language !== currentLocale)
        void prepareLanguage(language)
    }
    requestAnimationFrame(() => {
      languageRootRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]')?.focus()
    })
  }
  const handleLanguageKeyDown = (event: ReactKeyboardEvent<HTMLDivElement>) => {
    const items = [...event.currentTarget.querySelectorAll<HTMLAnchorElement>('[role="menuitem"]')]
    const current = items.indexOf(document.activeElement as HTMLAnchorElement)
    let next = current
    if (event.key === 'ArrowDown')
      next = current < items.length - 1 ? current + 1 : 0
    else if (event.key === 'ArrowUp')
      next = current > 0 ? current - 1 : items.length - 1
    else if (event.key === 'Home')
      next = 0
    else if (event.key === 'End')
      next = items.length - 1
    else
      return
    event.preventDefault()
    items[next]?.focus()
  }
  const isCurrent = (href: string) => pathname === href || pathname.startsWith(`${href}/`)
  const handleLanguageClick = async (
    event: ReactMouseEvent<HTMLAnchorElement>,
    language: DocLocale,
  ) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0) {
      closeNavigation()
      return
    }
    event.preventDefault()
    if (language === currentLocale) {
      setLanguageOpen(false)
      languageTriggerRef.current?.focus()
      return
    }
    setLanguageOpen(false)
    const href = docHref(language, currentDocSlug)
    await Promise.race([
      prepareLanguage(language),
      new Promise<void>(resolve => setTimeout(resolve, 250)),
    ])
    markPending()
    router.push(href)
  }

  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-wordmark" href="/" onClick={closeNavigation}>
          <img alt="" height="28" src="/brand/live2d-web-avatar.png" width="28" />
          <span>live2d-web</span>
        </Link>
        <button
          aria-expanded={navigationOpen}
          aria-label="Toggle navigation"
          className="site-menu-button"
          type="button"
          onClick={() => setNavigationOpen(value => !value)}
        >
          <span />
          <span />
        </button>
        <nav aria-label="Primary" className={navigationOpen ? 'site-nav is-open' : 'site-nav'}>
          <div className="site-nav-links">
            <Link
              aria-current={pathname.startsWith('/docs/') ? 'page' : undefined}
              href={docHref(currentLocale, '')}
              prefetch={false}
              onClick={closeNavigation}
            >
              Documentation
            </Link>
            <Link
              aria-current={isCurrent('/playground') ? 'page' : undefined}
              href="/playground"
              prefetch={false}
              onClick={closeNavigation}
            >
              Playground
            </Link>
            <Link
              aria-current={isCurrent('/inspect') ? 'page' : undefined}
              href="/inspect"
              prefetch={false}
              onClick={closeNavigation}
            >
              Inspector
            </Link>
            <Link
              aria-current={pathname.includes('/examples') ? 'page' : undefined}
              href={docHref(currentLocale, 'examples')}
              prefetch={false}
              onClick={closeNavigation}
            >
              Examples
            </Link>
          </div>
          <div className="site-utilities">
            <a
              aria-label="GitHub repository"
              className="site-github"
              href="https://github.com/Heonys/live2d-web"
            >
              <svg aria-hidden="true" viewBox="0 0 24 24">
                <path d="M12 2a10 10 0 0 0-3.16 19.49c.5.09.68-.22.68-.48v-1.87c-2.78.6-3.37-1.18-3.37-1.18-.45-1.16-1.11-1.47-1.11-1.47-.91-.62.07-.61.07-.61 1 .07 1.53 1.03 1.53 1.03.9 1.53 2.35 1.09 2.92.83.09-.65.35-1.09.64-1.34-2.22-.25-4.56-1.11-4.56-4.94 0-1.09.39-1.98 1.03-2.68-.1-.25-.45-1.27.1-2.64 0 0 .84-.27 2.75 1.02A9.55 9.55 0 0 1 12 6.82c.85 0 1.71.12 2.51.34 1.91-1.29 2.75-1.02 2.75-1.02.55 1.37.2 2.39.1 2.64.64.7 1.03 1.59 1.03 2.68 0 3.84-2.34 4.68-4.57 4.93.36.31.68.92.68 1.86V21c0 .27.18.58.69.48A10 10 0 0 0 12 2Z" />
              </svg>
              <span>GitHub</span>
            </a>
            <div ref={languageRootRef} className="site-language">
              <button
                ref={languageTriggerRef}
                aria-expanded={languageOpen}
                aria-haspopup="menu"
                aria-label="Documentation language"
                className="site-language-trigger"
                type="button"
                onClick={() => languageOpen ? setLanguageOpen(false) : openLanguageMenu()}
                onKeyDown={(event) => {
                  if (event.key === 'ArrowDown') {
                    event.preventDefault()
                    openLanguageMenu()
                  }
                }}
              >
                <svg aria-hidden="true" viewBox="0 0 24 24">
                  <circle cx="12" cy="12" r="9" />
                  <path d="M3 12h18M12 3c2.3 2.46 3.5 5.46 3.5 9s-1.2 6.54-3.5 9c-2.3-2.46-3.5-5.46-3.5-9S9.7 5.46 12 3Z" />
                </svg>
                <span lang={currentLocale}>{languageNames[currentLocale]}</span>
                <span aria-hidden="true" className="site-language-chevron">⌄</span>
              </button>
              {languageOpen && (
                <div
                  aria-label="Documentation language"
                  className="site-language-menu"
                  role="menu"
                  onKeyDown={handleLanguageKeyDown}
                >
                  {languages.map(language => (
                    <Link
                      key={language}
                      aria-current={language === currentLocale ? 'page' : undefined}
                      href={docHref(language, currentDocSlug)}
                      hrefLang={language}
                      lang={language}
                      prefetch={false}
                      role="menuitem"
                      onClick={event => void handleLanguageClick(event, language)}
                      onFocus={() => void prepareLanguage(language)}
                      onPointerEnter={() => void prepareLanguage(language)}
                    >
                      <span>{languageNames[language]}</span>
                      <span aria-hidden="true" className="site-language-check">
                        {language === currentLocale ? '✓' : ''}
                      </span>
                    </Link>
                  ))}
                </div>
              )}
            </div>
          </div>
        </nav>
      </div>
    </header>
  )
}
