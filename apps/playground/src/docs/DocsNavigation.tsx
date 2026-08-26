'use client'

import type { AnchorHTMLAttributes, FocusEvent, PointerEvent, ReactNode } from 'react'
import type { DocsNavigationValue } from './docsNavigationContext'
import Link from 'next/link'
import { usePathname, useRouter } from 'next/navigation'
import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { DocsNavigationContext, useDocsNavigation } from './docsNavigationContext'

export function DocsNavigationProvider({ children }: { children: ReactNode }) {
  const pathname = usePathname()
  const router = useRouter()
  const prefetchedRef = useRef(new Set<string>())
  const [pendingFrom, setPendingFrom] = useState<string>()
  const pending = pendingFrom === pathname

  useEffect(() => {
    if (!pending)
      return
    const timeout = setTimeout(setPendingFrom, 15_000, undefined)
    return () => clearTimeout(timeout)
  }, [pending])

  const prefetch = useCallback((href: string) => {
    if (prefetchedRef.current.has(href))
      return
    prefetchedRef.current.add(href)
    router.prefetch(href)
  }, [router])
  const value = useMemo<DocsNavigationValue>(() => ({
    markPending: () => setPendingFrom(pathname),
    pending,
    prefetch,
  }), [pathname, pending, prefetch])

  return (
    <DocsNavigationContext value={value}>
      <span
        aria-hidden="true"
        className={pending ? 'docs-navigation-progress is-active' : 'docs-navigation-progress'}
      />
      {children}
    </DocsNavigationContext>
  )
}

interface DocsIntentLinkProps extends Omit<AnchorHTMLAttributes<HTMLAnchorElement>, 'href'> {
  children: ReactNode
  href: string
}

export function DocsIntentLink({
  children,
  href,
  onClick,
  onFocus,
  onPointerEnter,
  ...props
}: DocsIntentLinkProps) {
  const pathname = usePathname()
  const { markPending, prefetch } = useDocsNavigation()
  const handleIntent = (
    event: FocusEvent<HTMLAnchorElement> | PointerEvent<HTMLAnchorElement>,
  ) => {
    prefetch(href)
    if (event.type === 'focus')
      onFocus?.(event as FocusEvent<HTMLAnchorElement>)
    else
      onPointerEnter?.(event as PointerEvent<HTMLAnchorElement>)
  }
  return (
    <Link
      {...props}
      href={href}
      prefetch={false}
      onClick={(event) => {
        onClick?.(event)
        if (
          !event.defaultPrevented
          && !event.metaKey
          && !event.ctrlKey
          && !event.shiftKey
          && event.button === 0
          && href.split('#')[0] !== pathname
        ) {
          markPending()
        }
      }}
      onFocus={handleIntent}
      onPointerEnter={handleIntent}
    >
      {children}
    </Link>
  )
}
