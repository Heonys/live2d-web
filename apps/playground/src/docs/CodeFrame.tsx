'use client'

import type { HTMLAttributes } from 'react'
import { useRef, useState } from 'react'

export function CodeFrame({ children, ...props }: HTMLAttributes<HTMLPreElement>) {
  const preRef = useRef<HTMLPreElement>(null)
  const [copied, setCopied] = useState(false)
  const language = String(props['data-language' as keyof typeof props] ?? '')
    || String((children as { props?: { className?: string } })?.props?.className ?? '')
      .replace(/^language-/, '')

  return (
    <div className="docs-code">
      <div className="docs-code-header">
        <span>{language || 'code'}</span>
        <button
          type="button"
          onClick={() => {
            const value = preRef.current?.textContent ?? ''
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(setCopied, 1_500, false)
            })
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre {...props} ref={preRef}>{children}</pre>
    </div>
  )
}
