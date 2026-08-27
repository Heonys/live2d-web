'use client'

import type { ReactNode } from 'react'
import type { DocLocale } from './manifest'
import { usePathname } from 'next/navigation'
import { useEffect, useRef, useState } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'
import { useDocsNavigation } from './docsNavigationContext'

const tocLabels: Record<DocLocale, string> = {
  en: 'On this page',
  ja: 'このページ',
  ko: '이 페이지에서',
}

export function ReadingProgress() {
  const pathname = usePathname()
  const progressRef = useRef<HTMLDivElement>(null)
  useEffect(() => {
    let frame = 0
    const update = () => {
      frame = 0
      const total = document.documentElement.scrollHeight - window.innerHeight
      const progress = total > 0 ? Math.min(1, window.scrollY / total) : 0
      progressRef.current?.style.setProperty('--docs-reading-progress', String(progress))
    }
    const schedule = () => {
      if (!frame)
        frame = requestAnimationFrame(update)
    }
    schedule()
    window.addEventListener('scroll', schedule, { passive: true })
    window.addEventListener('resize', schedule, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', schedule)
      window.removeEventListener('resize', schedule)
    }
  }, [pathname])
  return <div ref={progressRef} className="reading-progress" />
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
  useEffect(() => {
    let observer: IntersectionObserver | undefined
    const frame = requestAnimationFrame(() => {
      const elements = Array.from(document.querySelectorAll<HTMLHeadingElement>('.docs-article h2[id], .docs-article h3[id]:not([data-api-symbol])'))
      setHeadings(elements.map(element => ({
        depth: element.tagName === 'H3' ? 3 : 2,
        id: element.id,
        text: element.textContent ?? element.id,
      })))
      setActive(elements[0]?.id ?? '')
      observer = new IntersectionObserver((entries) => {
        for (const entry of entries) {
          if (entry.isIntersecting)
            setActive(entry.target.id)
        }
      }, { rootMargin: '0px 0px -72% 0px' })
      elements.forEach(element => observer?.observe(element))
    })
    return () => {
      cancelAnimationFrame(frame)
      observer?.disconnect()
    }
  }, [pathname])
  if (!headings.length)
    return <aside aria-label={messages.onPage} className="docs-toc" />
  return (
    <aside aria-label={messages.onPage} className="docs-toc">
      <strong>{tocLabels[locale]}</strong>
      <nav>
        {headings.map(heading => (
          <a
            key={heading.id}
            className={heading.depth === 3 ? 'is-child' : undefined}
            aria-current={active === heading.id ? 'location' : undefined}
            href={`#${encodeURIComponent(heading.id)}`}
          >
            {heading.text}
          </a>
        ))}
      </nav>
    </aside>
  )
}
