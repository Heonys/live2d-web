'use client'

import type { MouseEvent as ReactMouseEvent, ReactNode } from 'react'
import type { DocLocale } from './manifest'
import { usePathname } from 'next/navigation'
import { useEffect, useLayoutEffect, useRef, useState } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'
import { useDocsNavigation } from './docsNavigationContext'

const tocLabels: Record<DocLocale, string> = {
  en: 'On this page',
  ja: 'このページ',
  ko: '이 페이지에서',
}

export function DocsMain({ children }: { children: ReactNode }) {
  const { pending } = useDocsNavigation()
  return <main aria-busy={pending || undefined} className="docs-main">{children}</main>
}

interface TocHeading { depth: number, id: string, text: string }

export function DocsToc({ locale }: { locale: DocLocale }) {
  const messages = useSiteMessages().docs
  const pathname = usePathname()
  const [headings, setHeadings] = useState<TocHeading[]>([])
  const [active, setActive] = useState('')
  const indicatorRef = useRef<HTMLSpanElement>(null)
  const linkElementsRef = useRef(new Map<string, HTMLAnchorElement>())
  const manualTargetRef = useRef<string | undefined>(undefined)
  const navRef = useRef<HTMLElement>(null)
  const releaseTimerRef = useRef<number | undefined>(undefined)
  const updateActiveRef = useRef<() => void>(() => {})

  useEffect(() => {
    const scheduleRelease = () => {
      if (!manualTargetRef.current)
        return
      window.clearTimeout(releaseTimerRef.current)
      releaseTimerRef.current = window.setTimeout(() => {
        manualTargetRef.current = undefined
        updateActiveRef.current()
      }, 140)
    }
    window.addEventListener('scroll', scheduleRelease, { passive: true })
    return () => {
      window.clearTimeout(releaseTimerRef.current)
      window.removeEventListener('scroll', scheduleRelease)
    }
  }, [])

  useEffect(() => {
    let observer: IntersectionObserver | undefined
    let endObserver: IntersectionObserver | undefined
    manualTargetRef.current = undefined
    window.clearTimeout(releaseTimerRef.current)
    const frame = requestAnimationFrame(() => {
      const elements = Array.from(document.querySelectorAll<HTMLHeadingElement>('.docs-article h2[id], .docs-article h3[id]:not([data-api-symbol])'))
      setHeadings(elements.map(element => ({
        depth: element.tagName === 'H3' ? 3 : 2,
        id: element.id,
        text: element.textContent ?? element.id,
      })))
      const pager = document.querySelector<HTMLElement>('.docs-pager')
      const last = elements.at(-1)
      const updateActive = () => {
        if (manualTargetRef.current) {
          setActive(manualTargetRef.current)
          return
        }
        if (pager && last && pager.getBoundingClientRect().top < window.innerHeight * 0.92) {
          setActive(last.id)
          return
        }
        let current = elements[0]
        for (const element of elements) {
          if (element.getBoundingClientRect().top > 96)
            break
          current = element
        }
        setActive(current?.id ?? '')
      }
      updateActiveRef.current = updateActive
      updateActive()
      observer = new IntersectionObserver(updateActive, { rootMargin: '-84px 0px -72% 0px' })
      elements.forEach(element => observer?.observe(element))
      if (pager && last) {
        endObserver = new IntersectionObserver(updateActive, { rootMargin: '0px 0px -8% 0px' })
        endObserver.observe(pager)
      }
    })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
      endObserver?.disconnect()
      updateActiveRef.current = () => {}
    }
  }, [pathname])

  useLayoutEffect(() => {
    const updateIndicator = () => {
      const indicator = indicatorRef.current
      const nav = navRef.current
      const link = linkElementsRef.current.get(active)
      if (!indicator || !nav || !link) {
        if (indicator)
          indicator.style.opacity = '0'
        return
      }
      const navRect = nav.getBoundingClientRect()
      const linkRect = link.getBoundingClientRect()
      indicator.style.height = `${linkRect.height}px`
      indicator.style.opacity = '1'
      indicator.style.transform = `translate3d(0, ${linkRect.top - navRect.top}px, 0)`
    }
    updateIndicator()
    window.addEventListener('resize', updateIndicator)
    return () => window.removeEventListener('resize', updateIndicator)
  }, [active, headings])

  const handleHeadingClick = (event: ReactMouseEvent<HTMLAnchorElement>, heading: TocHeading) => {
    if (event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || event.button !== 0)
      return
    const target = document.getElementById(heading.id)
    if (!target)
      return
    event.preventDefault()
    manualTargetRef.current = heading.id
    setActive(heading.id)
    window.clearTimeout(releaseTimerRef.current)
    releaseTimerRef.current = window.setTimeout(() => {
      manualTargetRef.current = undefined
      updateActiveRef.current()
    }, 1200)
    const hash = `#${encodeURIComponent(heading.id)}`
    if (window.location.hash !== hash)
      window.history.pushState(null, '', hash)
    target.scrollIntoView({
      behavior: window.matchMedia('(prefers-reduced-motion: reduce)').matches ? 'auto' : 'smooth',
      block: 'start',
    })
  }
  if (!headings.length)
    return <aside aria-label={messages.onPage} className="docs-toc" />
  return (
    <aside aria-label={messages.onPage} className="docs-toc">
      <strong>{tocLabels[locale]}</strong>
      <nav ref={navRef}>
        <span
          ref={indicatorRef}
          aria-hidden="true"
          className="docs-toc-indicator"
        />
        {headings.map(heading => (
          <a
            key={heading.id}
            ref={(node) => {
              if (node)
                linkElementsRef.current.set(heading.id, node)
              else
                linkElementsRef.current.delete(heading.id)
            }}
            className={heading.depth === 3 ? 'is-child' : undefined}
            aria-current={active === heading.id ? 'location' : undefined}
            href={`#${encodeURIComponent(heading.id)}`}
            onClick={event => handleHeadingClick(event, heading)}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  )
}
