'use client'

import type { ReactNode } from 'react'
import type { SiteLocale } from './site'
import { usePathname } from 'next/navigation'
import { createContext, use, useEffect, useMemo } from 'react'
import { getSiteMessages, siteLocaleFromPath } from './site'

const SiteLocaleContext = createContext<SiteLocale>('en')

export function SiteLocaleProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const locale = useMemo(() => siteLocaleFromPath(pathname), [pathname])

  useEffect(() => {
    document.documentElement.lang = locale
  }, [locale])

  return (
    <SiteLocaleContext value={locale}>
      {children}
    </SiteLocaleContext>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSiteLocale() {
  return use(SiteLocaleContext)
}

// eslint-disable-next-line react-refresh/only-export-components
export function useSiteMessages() {
  return getSiteMessages(useSiteLocale())
}
