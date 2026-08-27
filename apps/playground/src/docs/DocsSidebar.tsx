'use client'

import type { DocGroup, DocLocale } from './manifest'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { canBackgroundPrefetch, scheduleIdle } from '../components/navigationPrefetch'
import { DocsSearchTrigger } from './DocSearch'
import { DocsIntentLink } from './DocsNavigation'
import { useDocsNavigation } from './docsNavigationContext'
import { DOC_PAGES, docHref, getDocPage } from './manifest'

const SIDEBAR_SCROLL_KEY = 'live2d-web:docs-sidebar-scroll'

const groupNames: Record<DocLocale, Record<DocGroup, string>> = {
  en: { Integrate: 'Integrate', Reference: 'Reference', Start: 'Start', Use: 'Use' },
  ja: { Integrate: '統合', Reference: 'リファレンス', Start: '導入', Use: '使い方' },
  ko: { Integrate: '통합', Reference: '레퍼런스', Start: '시작', Use: '사용' },
}

export function DocsSidebar({ locale }: { locale: DocLocale }) {
  const pathname = usePathname()
  const { prefetch } = useDocsNavigation()
  const sidebarRef = useRef<HTMLElement>(null)
  const groups: readonly DocGroup[] = ['Start', 'Use', 'Integrate', 'Reference']
  const currentSlug = pathname.match(/^\/docs\/(?:en|ko|ja)(?:\/(.*))?$/)?.[1] ?? ''
  const currentPage = getDocPage(currentSlug)
  const backgroundHrefs = useMemo(() => {
    if (!currentPage)
      return []
    const index = DOC_PAGES.findIndex(page => page.slug === currentPage.slug)
    const candidates = [
      ...DOC_PAGES.filter(page => page.group === currentPage.group),
      DOC_PAGES[index - 1],
      DOC_PAGES[index + 1],
    ]
    return [...new Set(candidates
      .filter(page => page && page.slug !== currentPage.slug && page.slug !== 'api')
      .map(page => docHref(locale, page!.slug)))]
  }, [currentPage, locale])

  useLayoutEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar)
      return
    try {
      const stored = Number(sessionStorage.getItem(SIDEBAR_SCROLL_KEY))
      if (Number.isFinite(stored))
        sidebar.scrollTop = stored
    }
    catch {}
  }, [])

  useEffect(() => {
    const sidebar = sidebarRef.current
    if (!sidebar)
      return
    const persist = () => {
      try {
        sessionStorage.setItem(SIDEBAR_SCROLL_KEY, String(sidebar.scrollTop))
      }
      catch {}
    }
    sidebar.addEventListener('scroll', persist, { passive: true })
    return () => {
      persist()
      sidebar.removeEventListener('scroll', persist)
    }
  }, [])

  useEffect(() => {
    const sidebar = sidebarRef.current
    const current = sidebar?.querySelector<HTMLElement>('nav a[aria-current="page"]')
    if (!sidebar || !current)
      return
    const sidebarRect = sidebar.getBoundingClientRect()
    const currentRect = current.getBoundingClientRect()
    if (currentRect.top < sidebarRect.top)
      sidebar.scrollTop += currentRect.top - sidebarRect.top - 8
    else if (currentRect.bottom > sidebarRect.bottom)
      sidebar.scrollTop += currentRect.bottom - sidebarRect.bottom + 8
  }, [pathname])

  useEffect(() => {
    if (!backgroundHrefs.length || !canBackgroundPrefetch())
      return
    let cancelled = false
    const timers: number[] = []
    let cancelIdle = () => {}
    void document.fonts.ready.then(() => {
      if (cancelled)
        return
      cancelIdle = scheduleIdle(() => {
        backgroundHrefs.forEach((href, index) => {
          const timer = window.setTimeout(prefetch, index * 140, href)
          timers.push(timer)
        })
      }, { delay: 650 })
    })
    return () => {
      cancelled = true
      cancelIdle()
      timers.forEach(timer => window.clearTimeout(timer))
    }
  }, [backgroundHrefs, prefetch])

  return (
    <aside ref={sidebarRef} aria-label="Documentation navigation" className="docs-sidebar">
      <DocsIntentLink className="docs-sidebar-brand" href={docHref(locale, '')}>
        Documentation
      </DocsIntentLink>
      <DocsSearchTrigger />
      <nav aria-label="Documentation">
        {groups.map(group => (
          <section key={group}>
            <h2>{groupNames[locale][group]}</h2>
            {DOC_PAGES.filter(entry => entry.group === group).map((entry) => {
              const href = docHref(locale, entry.slug)
              return (
                <DocsIntentLink
                  key={entry.slug}
                  aria-current={pathname === href ? 'page' : undefined}
                  href={href}
                >
                  {entry.title[locale]}
                </DocsIntentLink>
              )
            })}
          </section>
        ))}
      </nav>
    </aside>
  )
}
