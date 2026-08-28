'use client'

import type { DocLocale } from './manifest'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { lockPageScroll } from '../components/pageScrollLock'
import { useSiteMessages } from '../i18n/SiteLocale'
import { DocsSearchTrigger } from './DocSearch'
import { DocsIntentLink } from './DocsNavigation'
import { DOC_GROUP_NAMES, DOC_GROUPS, DOC_PAGES, docHref, getDocPage } from './manifest'

export function MobileDocsNavigation({ locale }: { locale: DocLocale }) {
  const pathname = usePathname()
  const messages = useSiteMessages().docs
  const detailsRef = useRef<HTMLDetailsElement>(null)
  const summaryRef = useRef<HTMLElement>(null)
  const currentSlug = pathname.match(/^\/docs\/(?:en|ko|ja)(?:\/(.*))?$/u)?.[1] ?? ''
  const currentPage = getDocPage(currentSlug) ?? DOC_PAGES[0]

  useEffect(() => {
    const details = detailsRef.current
    if (details) {
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLElement
        && activeElement !== summaryRef.current
        && details.contains(activeElement)
      ) {
        activeElement.blur()
      }
      details.open = false
    }
  }, [pathname])

  useEffect(() => {
    const details = detailsRef.current
    if (!details)
      return

    let releaseScrollLock = () => {}

    const handleKeyDown = (event: KeyboardEvent) => {
      if (!details.open)
        return
      if (event.key === 'Escape') {
        event.preventDefault()
        details.open = false
        requestAnimationFrame(() => summaryRef.current?.focus())
        return
      }
      if (event.key !== 'Tab')
        return

      const focusable = [...details.querySelectorAll<HTMLElement>(
        'summary, button:not([disabled]), a[href], [tabindex]:not([tabindex="-1"])',
      )].filter(element => !element.hasAttribute('hidden'))
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
    const handleToggle = () => {
      releaseScrollLock()
      releaseScrollLock = () => {}
      if (!details.open)
        return

      releaseScrollLock = lockPageScroll()
      window.dispatchEvent(new CustomEvent('live2d-web:mobile-menu-open', { detail: 'docs' }))
    }
    const closeForOtherMenu = (event: Event) => {
      if ((event as CustomEvent<string>).detail !== 'docs')
        details.open = false
    }

    details.addEventListener('toggle', handleToggle)
    document.addEventListener('keydown', handleKeyDown)
    window.addEventListener('live2d-web:mobile-menu-open', closeForOtherMenu)
    return () => {
      releaseScrollLock()
      details.removeEventListener('toggle', handleToggle)
      document.removeEventListener('keydown', handleKeyDown)
      window.removeEventListener('live2d-web:mobile-menu-open', closeForOtherMenu)
    }
  }, [])

  const close = () => {
    if (detailsRef.current) {
      const activeElement = document.activeElement
      if (
        activeElement instanceof HTMLElement
        && activeElement !== summaryRef.current
        && detailsRef.current.contains(activeElement)
      ) {
        activeElement.blur()
      }
      detailsRef.current.open = false
    }
  }

  return (
    <details ref={detailsRef} className="docs-mobile-navigation">
      <summary ref={summaryRef} aria-label={messages.menu} className="docs-mobile-summary">
        <span>{messages.label}</span>
        <strong>{currentPage?.title[locale]}</strong>
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="m4 6 4 4 4-4" />
        </svg>
      </summary>
      <div
        aria-label={messages.menu}
        aria-modal="true"
        className="docs-mobile-panel"
        data-page-scroll-region
        role="dialog"
      >
        <div className="docs-mobile-search">
          <DocsSearchTrigger />
        </div>
        <nav aria-label={messages.navigation}>
          {DOC_GROUPS.map(group => (
            <section key={group}>
              <h2>{DOC_GROUP_NAMES[locale][group]}</h2>
              {DOC_PAGES.filter(page => page.group === group).map(page => (
                <DocsIntentLink
                  key={page.slug}
                  aria-current={page.slug === currentSlug ? 'page' : undefined}
                  href={docHref(locale, page.slug)}
                  onClick={close}
                >
                  {page.title[locale]}
                </DocsIntentLink>
              ))}
            </section>
          ))}
        </nav>
      </div>
    </details>
  )
}
