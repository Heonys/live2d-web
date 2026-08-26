'use client'

import type { DocGroup, DocLocale } from './manifest'
import { usePathname } from 'next/navigation'
import { useEffect, useRef } from 'react'
import { DocSearch } from './DocSearch'
import { DocsIntentLink } from './DocsNavigation'
import { DOC_PAGES, docHref } from './manifest'

const groupNames: Record<DocLocale, Record<DocGroup, string>> = {
  en: { Integrate: 'Integrate', Reference: 'Reference', Start: 'Start', Use: 'Use' },
  ja: { Integrate: '統合', Reference: 'リファレンス', Start: '導入', Use: '使い方' },
  ko: { Integrate: '통합', Reference: '레퍼런스', Start: '시작', Use: '사용' },
}

export function DocsSidebar({ locale }: { locale: DocLocale }) {
  const pathname = usePathname()
  const sidebarRef = useRef<HTMLElement>(null)
  const groups: readonly DocGroup[] = ['Start', 'Use', 'Integrate', 'Reference']

  useEffect(() => {
    const sidebar = sidebarRef.current
    const current = sidebar?.querySelector<HTMLElement>('nav a[aria-current="page"]')
    if (!sidebar || !current)
      return
    const sidebarRect = sidebar.getBoundingClientRect()
    const currentRect = current.getBoundingClientRect()
    if (currentRect.top < sidebarRect.top || currentRect.bottom > sidebarRect.bottom)
      current.scrollIntoView({ block: 'nearest' })
  }, [pathname])

  return (
    <aside ref={sidebarRef} aria-label="Documentation navigation" className="docs-sidebar">
      <DocsIntentLink className="docs-sidebar-brand" href={docHref(locale, '')}>
        Documentation
      </DocsIntentLink>
      <DocSearch key={pathname} locale={locale} />
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
