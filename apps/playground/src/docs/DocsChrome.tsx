'use client'

import type { DocLocale, DocPageMeta } from './manifest'
import Link from 'next/link'
import { useEffect, useRef, useState } from 'react'
import { docHref } from './manifest'

const mobileLabels: Record<DocLocale, { close: string, menu: string, onPage: string }> = {
  en: { close: 'Close documentation menu', menu: 'Browse documentation', onPage: 'On this page' },
  ja: { close: 'ドキュメントメニューを閉じる', menu: 'ドキュメントを探す', onPage: 'このページ' },
  ko: { close: '문서 메뉴 닫기', menu: '문서 둘러보기', onPage: '이 페이지에서' },
}

export function ReadingProgress() {
  const [progress, setProgress] = useState(0)
  useEffect(() => {
    const update = () => {
      const total = document.documentElement.scrollHeight - window.innerHeight
      setProgress(total > 0 ? Math.min(1, window.scrollY / total) : 0)
    }
    const frame = requestAnimationFrame(update)
    window.addEventListener('scroll', update, { passive: true })
    return () => {
      cancelAnimationFrame(frame)
      window.removeEventListener('scroll', update)
    }
  }, [])
  return <div className="reading-progress" style={{ transform: `scaleX(${progress})` }} />
}

export function DocsMobileNavigation({ current, locale, pages }: {
  current: string
  locale: DocLocale
  pages: readonly DocPageMeta[]
}) {
  const [open, setOpen] = useState(false)
  const triggerRef = useRef<HTMLButtonElement>(null)
  const drawerRef = useRef<HTMLDivElement>(null)
  const label = pages.find(page => page.slug === current)?.title[locale]
  useEffect(() => {
    if (!open)
      return
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    drawerRef.current?.querySelector<HTMLElement>('button')?.focus()
    const handleKeyDown = (event: KeyboardEvent) => {
      const drawer = drawerRef.current
      if (event.key === 'Escape') {
        event.preventDefault()
        setOpen(false)
        requestAnimationFrame(() => triggerRef.current?.focus())
        return
      }
      if (event.key !== 'Tab' || !drawer)
        return
      const focusable = [...drawer.querySelectorAll<HTMLElement>('button, a[href]')]
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
    return () => {
      document.body.style.overflow = previous
      document.removeEventListener('keydown', handleKeyDown)
    }
  }, [open])
  const close = () => {
    setOpen(false)
    requestAnimationFrame(() => triggerRef.current?.focus())
  }
  return (
    <div className="docs-mobile-navigation">
      <button ref={triggerRef} aria-expanded={open} type="button" onClick={() => setOpen(true)}>
        <span>{mobileLabels[locale].menu}</span>
        <strong>{label}</strong>
      </button>
      {open && (
        <div ref={drawerRef} className="docs-mobile-drawer" role="dialog" aria-modal="true">
          <div>
            <strong>live2d-web</strong>
            <button aria-label={mobileLabels[locale].close} type="button" onClick={close}>×</button>
          </div>
          <nav aria-label="Documentation">
            {pages.map(page => (
              <Link
                key={page.slug}
                aria-current={page.slug === current ? 'page' : undefined}
                href={docHref(locale, page.slug)}
                onClick={close}
              >
                {page.title[locale]}
              </Link>
            ))}
          </nav>
        </div>
      )}
    </div>
  )
}

interface TocHeading { depth: number, id: string, text: string }

export function DocsToc({ locale }: { locale: DocLocale }) {
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
  }, [])
  if (!headings.length)
    return <aside aria-label="On this page" className="docs-toc" />
  return (
    <aside aria-label="On this page" className="docs-toc">
      <strong>{mobileLabels[locale].onPage}</strong>
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
