'use client'

import type { DocLocale } from './manifest'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useMemo, useRef } from 'react'
import { canBackgroundPrefetch, scheduleIdle } from '../components/navigationPrefetch'
import { useSiteMessages } from '../i18n/SiteLocale'
import { DocsSearchTrigger } from './DocSearch'
import { DocsIntentLink } from './DocsNavigation'
import { useDocsNavigation } from './docsNavigationContext'
import { DOC_GROUP_NAMES, DOC_GROUPS, DOC_PAGES, docHref, getDocPage, navLabel } from './manifest'

const SIDEBAR_SCROLL_KEY = 'live2d-web:docs-sidebar-scroll'

export function DocsSidebar({ locale }: { locale: DocLocale }) {
  const messages = useSiteMessages().docs
  const pathname = usePathname()
  const { prefetch } = useDocsNavigation()
  const sidebarRef = useRef<HTMLElement>(null)
  const currentSlug = pathname.match(/^\/docs\/(?:en|ko|ja)(?:\/(.*))?$/)?.[1] ?? ''
  const currentPage = getDocPage(currentSlug)
  const adjacentHrefs = useMemo(() => {
    if (!currentPage)
      return []
    const index = DOC_PAGES.findIndex(page => page.slug === currentPage.slug)
    const candidates = [DOC_PAGES[index - 1], DOC_PAGES[index + 1]]
    return [...new Set(candidates
      .filter(page => page && page.slug !== currentPage.slug && page.slug !== 'api')
      .map(page => docHref(locale, page!.slug)))]
  }, [currentPage, locale])
  const groupHrefs = useMemo(() => currentPage
    ? DOC_PAGES
        .filter(page => page.group === currentPage.group && page.slug !== currentPage.slug && page.slug !== 'api')
        .map(page => docHref(locale, page.slug))
    : [], [currentPage, locale])

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
    if (!canBackgroundPrefetch())
      return
    adjacentHrefs.forEach(prefetch)
  }, [adjacentHrefs, prefetch])

  useEffect(() => {
    if (!groupHrefs.length || !canBackgroundPrefetch())
      return
    let cancelled = false
    const timers: number[] = []
    let cancelIdle = () => {}
    void document.fonts.ready.then(() => {
      if (cancelled)
        return
      cancelIdle = scheduleIdle(() => {
        groupHrefs.forEach((href, index) => {
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
  }, [groupHrefs, prefetch])

  return (
    <aside ref={sidebarRef} aria-label={messages.navigation} className="docs-sidebar">
      <DocsIntentLink className="docs-sidebar-brand" href={docHref(locale, '')}>
        {messages.label}
      </DocsIntentLink>
      <div className="docs-sidebar-search">
        <DocsSearchTrigger />
      </div>
      <nav aria-label={messages.label}>
        {DOC_GROUPS.map(group => (
          <section key={group}>
            <h2>{DOC_GROUP_NAMES[locale][group]}</h2>
            {DOC_PAGES.filter(entry => entry.group === group).map((entry) => {
              const href = docHref(locale, entry.slug)
              return (
                <DocsIntentLink
                  key={entry.slug}
                  aria-current={pathname === href ? 'page' : undefined}
                  href={href}
                >
                  {navLabel(entry, locale)}
                </DocsIntentLink>
              )
            })}
          </section>
        ))}
      </nav>
    </aside>
  )
}
