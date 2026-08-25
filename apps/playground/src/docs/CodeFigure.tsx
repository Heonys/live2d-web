'use client'

import type { HTMLAttributes } from 'react'
import { useRef, useState } from 'react'

export function CodeFigure({ children, ...props }: HTMLAttributes<HTMLElement>) {
  const figureRef = useRef<HTMLElement>(null)
  const [copied, setCopied] = useState(false)
  return (
    <figure {...props} ref={figureRef}>
      <button
        className="docs-code-copy"
        type="button"
        onClick={() => {
          const value = figureRef.current?.querySelector('pre')?.textContent ?? ''
          void navigator.clipboard.writeText(value).then(() => {
            setCopied(true)
            window.setTimeout(setCopied, 1_500, false)
          })
        }}
      >
        {copied ? 'Copied' : 'Copy'}
      </button>
      {children}
    </figure>
  )
}
