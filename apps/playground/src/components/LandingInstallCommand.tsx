'use client'

import { useEffect, useRef, useState } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'

const INSTALL_COMMAND = 'npm install live2d-web'

export function LandingInstallCommand() {
  const messages = useSiteMessages().docs
  const [copied, setCopied] = useState(false)
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current)
      clearTimeout(resetTimerRef.current)
  }, [])

  return (
    <button
      aria-label={copied ? messages.copied : messages.copy}
      className="landing-install"
      data-copied={copied}
      title={copied ? messages.copied : messages.copy}
      type="button"
      onClick={() => {
        if (resetTimerRef.current)
          clearTimeout(resetTimerRef.current)

        void navigator.clipboard.writeText(INSTALL_COMMAND).then(() => {
          setCopied(true)
          resetTimerRef.current = setTimeout(setCopied, 1_500, false)
        })
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16">
        {copied
          ? <path d="m3.25 8.2 2.7 2.7 6.8-6.8" />
          : (
              <>
                <rect height="8" rx="1.25" width="7" x="5.25" y="5.25" />
                <path d="M10.5 5.25v-1.5h-6.75v7H5.3" />
              </>
            )}
      </svg>
      <code>{INSTALL_COMMAND}</code>
      <span aria-live="polite" className="landing-visually-hidden">
        {copied ? messages.copied : ''}
      </span>
    </button>
  )
}
