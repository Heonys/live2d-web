'use client'

import { useEffect, useRef, useState } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'

type CopyState = 'idle' | 'copied' | 'error'

export function CodeCopyButton({ readText }: {
  readText: () => string
}) {
  const messages = useSiteMessages().docs
  const [state, setState] = useState<CopyState>('idle')
  const resetTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null)

  useEffect(() => () => {
    if (resetTimerRef.current)
      clearTimeout(resetTimerRef.current)
  }, [])

  const label = state === 'copied'
    ? messages.copied
    : state === 'error' ? messages.copyFailed : messages.copy

  return (
    <button
      className="docs-code-copy"
      type="button"
      onClick={() => {
        if (resetTimerRef.current)
          clearTimeout(resetTimerRef.current)
        void navigator.clipboard.writeText(readText()).then(
          () => setState('copied'),
          () => setState('error'),
        ).finally(() => {
          resetTimerRef.current = setTimeout(setState, 1_500, 'idle')
        })
      }}
    >
      <svg aria-hidden="true" viewBox="0 0 16 16">
        {state === 'copied'
          ? <path d="m3.25 8.2 2.7 2.7 6.8-6.8" />
          : (
              <>
                <rect height="8" rx="1.25" width="7" x="5.25" y="5.25" />
                <path d="M10.5 5.25v-1.5h-6.75v7H5.3" />
              </>
            )}
      </svg>
      <span aria-live="polite">{label}</span>
    </button>
  )
}
