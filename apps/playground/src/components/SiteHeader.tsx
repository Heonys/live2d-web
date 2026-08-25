'use client'

import type { DocLocale } from '../docs/manifest'
import Link from 'next/link'
import { useState } from 'react'
import { docHref } from '../docs/manifest'

const languageNames: Record<DocLocale, string> = { en: 'EN', ja: 'JA', ko: 'KO' }

export function SiteHeader({ docSlug = '', locale = 'en' }: {
  docSlug?: string
  locale?: DocLocale
}) {
  const [open, setOpen] = useState(false)
  return (
    <header className="site-header">
      <div className="site-header-inner">
        <Link className="site-wordmark" href="/">live2d-web</Link>
        <button
          aria-expanded={open}
          aria-label="Toggle navigation"
          className="site-menu-button"
          type="button"
          onClick={() => setOpen(value => !value)}
        >
          <span />
          <span />
        </button>
        <nav aria-label="Primary" className={open ? 'site-nav is-open' : 'site-nav'}>
          <Link href={docHref(locale, '')}>Documentation</Link>
          <Link href="/playground">Playground</Link>
          <Link href="/inspect">Model inspector</Link>
          <Link href={docHref(locale, 'examples')}>Examples</Link>
          <a href="https://github.com/Heonys/live2d-web">GitHub</a>
          <span className="site-languages">
            {(['en', 'ko', 'ja'] as const).map(language => (
              <Link
                key={language}
                aria-current={language === locale ? 'page' : undefined}
                href={docHref(language, docSlug)}
                hrefLang={language}
              >
                {languageNames[language]}
              </Link>
            ))}
          </span>
        </nav>
      </div>
    </header>
  )
}
