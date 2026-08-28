'use client'

import type { KeyboardEvent as ReactKeyboardEvent, MouseEvent as ReactMouseEvent } from 'react'
import type { SiteLocale } from '../i18n/site'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useEffect, useRef, useState, useSyncExternalStore } from 'react'
import { DocsIntentLink } from '../docs/DocsNavigation'
import { useDocsNavigation } from '../docs/docsNavigationContext'
import { warmLocaleFonts } from '../docs/searchClient'
import {
  languageNames,
  localizedDocPath,
  localizedPath,
  SITE_LOCALES,
  stripSiteLocale,
  switchLocalePath,
} from '../i18n/site'
import { useSiteLocale, useSiteMessages } from '../i18n/SiteLocale'
import { lockPageScroll } from './pageScrollLock'

function subscribeToLocation(callback: () => void) {
  window.addEventListener('popstate', callback)
  return () => window.removeEventListener('popstate', callback)
}

function getLocationSearch() {
  return window.location.search
}

function getServerSearch() {
  return ''
}

export function SiteHeader() {
  const pathname = usePathname()
  const router = useRouter()
  const currentLocale = useSiteLocale()
  const messages = useSiteMessages()
  const { markPending, prefetch } = useDocsNavigation()
  const [languageOpen, setLanguageOpen] = useState(false)
  const search = useSyncExternalStore(subscribeToLocation, getLocationSearch, getServerSearch)
  const languageRootRef = useRef<HTMLDivElement>(null)
  const languageTriggerRef = useRef<HTMLButtonElement>(null)
  const mobileMenuRef = useRef<HTMLDetailsElement>(null)
  const mobileSummaryRef = useRef<HTMLElement>(null)
  const skipInitialLanguageFocusRef = useRef(false)
  const docsMatch = pathname.match(/^\/docs\/(?:en|ko|ja)(?:\/(.*))?$/)
  const currentDocSlug = docsMatch?.[1] ?? ''

  useEffect(() => {
    const details = mobileMenuRef.current
    if (!details)
      return
    const closeForRoute = () => {
      details.open = false
    }
    closeForRoute()
  }, [pathname])

  useEffect(() => {
    const details = mobileMenuRef.current
    if (!details)
      return
    let removeOpenListeners = () => {}
    let releaseScrollLock = () => {}
    const handleToggle = () => {
      removeOpenListeners()
      releaseScrollLock()
      releaseScrollLock = () => {}
      if (!details.open)
        return
      releaseScrollLock = lockPageScroll()
      window.dispatchEvent(new CustomEvent('live2d-web:mobile-menu-open', { detail: 'site' }))
      const handleKeyDown = (event: KeyboardEvent) => {
        if (event.key === 'Escape') {
          event.preventDefault()
          details.open = false
          requestAnimationFrame(() => mobileSummaryRef.current?.focus())
          return
        }
        if (event.key !== 'Tab')
          return
        const focusable = [...details.querySelectorAll<HTMLElement>(
          'summary, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
        )].filter(element => !element.hasAttribute('hidden') && element.tabIndex >= 0)
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
      document.addEventListener('keydown', handleKeyDown)
      removeOpenListeners = () => {
        document.removeEventListener('keydown', handleKeyDown)
        removeOpenListeners = () => {}
      }
    }
    const closeForOtherMenu = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== 'site')
        details.open = false
    }
    details.addEventListener('toggle', handleToggle)
    window.addEventListener('live2d-web:mobile-menu-open', closeForOtherMenu)
    return () => {
      removeOpenListeners()
      releaseScrollLock()
      details.removeEventListener('toggle', handleToggle)
      window.removeEventListener('live2d-web:mobile-menu-open', closeForOtherMenu)
    }
  }, [])

  const prepareLanguage = (language: SiteLocale) => {
    const href = switchLocalePath(pathname, language)
    prefetch(href)
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
    if (mobileMenuRef.current)
      mobileMenuRef.current.open = false
    setLanguageOpen(false)
  }
  const openLanguageMenu = () => {
    skipInitialLanguageFocusRef.current = true
    setLanguageOpen(true)
    requestAnimationFrame(() => {
      const current = languageRootRef.current
        ?.querySelector<HTMLAnchorElement>('[role="menuitem"][aria-current="page"]')
      ;(current ?? languageRootRef.current?.querySelector<HTMLAnchorElement>('[role="menuitem"]'))?.focus()
    })
  }
  const handleLanguageFocus = (language: SiteLocale) => {
    if (skipInitialLanguageFocusRef.current) {
      skipInitialLanguageFocusRef.current = false
      return
    }
    void prepareLanguage(language)
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
  const currentToolPath = stripSiteLocale(pathname)
  const isCurrent = (href: string) => currentToolPath === href || currentToolPath.startsWith(`${href}/`)
  const examplesCurrent = /^\/docs\/(?:en|ko|ja)\/examples(?:\/|$)/.test(pathname)
  const documentationCurrent = pathname.startsWith('/docs/') && !examplesCurrent
  const handleLanguageClick = async (
    event: ReactMouseEvent<HTMLAnchorElement>,
    language: SiteLocale,
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
    const href = `${switchLocalePath(pathname, language)}${window.location.search}`
    await Promise.race([
      prepareLanguage(language),
      new Promise<void>(resolve => setTimeout(resolve, 250)),
    ])
    markPending()
    router.push(href)
  }

  if (/^\/(?:benchmark|e2e)(?:\/|$)/.test(pathname))
    return null

  return (
    <>
      <header className="site-header">
        <div className="site-header-inner">
          <DocsIntentLink className="site-wordmark" href={localizedPath(currentLocale, '/')} onClick={closeNavigation}>
            <img alt="" height="28" src="/brand/live2d-web-avatar.png" width="28" />
            <span>live2d-web</span>
          </DocsIntentLink>
          <details ref={mobileMenuRef} className="site-mobile-menu">
            <summary ref={mobileSummaryRef} aria-label={messages.header.toggle} className="site-menu-button">
              <span />
              <span />
            </summary>
            <button
              aria-label={messages.header.close}
              className="site-mobile-backdrop"
              tabIndex={-1}
              type="button"
              onClick={closeNavigation}
            />
            <div className="site-mobile-panel" data-page-scroll-region>
              <nav aria-label={messages.header.navigation} className="site-mobile-global-links">
                <div className="site-mobile-link-group">
                  <p>{messages.header.learn}</p>
                  <DocsIntentLink aria-current={documentationCurrent ? 'page' : undefined} href={localizedDocPath(currentLocale)} onClick={closeNavigation}>{messages.docs.label}</DocsIntentLink>
                  <DocsIntentLink aria-current={examplesCurrent ? 'page' : undefined} href={localizedDocPath(currentLocale, 'examples')} onClick={closeNavigation}>{messages.header.examples}</DocsIntentLink>
                </div>
                <div className="site-mobile-link-group">
                  <p>{messages.header.tools}</p>
                  <DocsIntentLink aria-current={isCurrent('/playground') ? 'page' : undefined} href={localizedPath(currentLocale, '/playground')} onClick={closeNavigation}>{messages.header.playground}</DocsIntentLink>
                  <DocsIntentLink aria-current={isCurrent('/inspect') ? 'page' : undefined} href={localizedPath(currentLocale, '/inspect')} onClick={closeNavigation}>{messages.header.inspector}</DocsIntentLink>
                </div>
                <div className="site-mobile-link-group">
                  <p>{messages.header.project}</p>
                  <a href="https://github.com/Heonys/live2d-web" onClick={closeNavigation}>GitHub</a>
                </div>
              </nav>
              <div className="site-mobile-languages" aria-label={messages.header.language}>
                {SITE_LOCALES.map(language => (
                  <Link
                    key={language}
                    aria-current={language === currentLocale ? 'page' : undefined}
                    href={`${switchLocalePath(pathname, language)}${search}`}
                    hrefLang={language}
                    lang={language}
                    prefetch={false}
                    onClick={closeNavigation}
                  >
                    {languageNames[language]}
                  </Link>
                ))}
              </div>
            </div>
          </details>
          <nav aria-label={messages.header.navigation} className="site-nav">
            <div className="site-nav-links">
              <DocsIntentLink
                aria-current={documentationCurrent ? 'page' : undefined}
                href={localizedDocPath(currentLocale)}
                onClick={closeNavigation}
              >
                {messages.docs.label}
              </DocsIntentLink>
              <DocsIntentLink
                aria-current={isCurrent('/playground') ? 'page' : undefined}
                href={localizedPath(currentLocale, '/playground')}
                onClick={closeNavigation}
              >
                {messages.header.playground}
              </DocsIntentLink>
              <DocsIntentLink
                aria-current={isCurrent('/inspect') ? 'page' : undefined}
                href={localizedPath(currentLocale, '/inspect')}
                onClick={closeNavigation}
              >
                {messages.header.inspector}
              </DocsIntentLink>
              <DocsIntentLink
                aria-current={examplesCurrent ? 'page' : undefined}
                href={localizedDocPath(currentLocale, 'examples')}
                onClick={closeNavigation}
              >
                {messages.header.examples}
              </DocsIntentLink>
            </div>
            <div className="site-utilities">
              <a
                aria-label={messages.header.github}
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
                  aria-label={messages.header.language}
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
                    aria-label={messages.header.language}
                    className="site-language-menu"
                    role="menu"
                    onKeyDown={handleLanguageKeyDown}
                  >
                    {SITE_LOCALES.map(language => (
                      <Link
                        key={language}
                        aria-current={language === currentLocale ? 'page' : undefined}
                        href={`${switchLocalePath(pathname, language)}${search}`}
                        hrefLang={language}
                        lang={language}
                        prefetch={false}
                        role="menuitem"
                        onClick={event => void handleLanguageClick(event, language)}
                        onFocus={() => handleLanguageFocus(language)}
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
      <div aria-hidden="true" className="site-header-spacer" />
    </>
  )
}
