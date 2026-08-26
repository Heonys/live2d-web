'use client'

import type { HTMLAttributes } from 'react'
import { useRef } from 'react'
import { CodeCopyButton } from './CodeCopyButton'

export function CodeFrame({ children, filename, ...props }: HTMLAttributes<HTMLPreElement> & {
  filename?: string
}) {
  const preRef = useRef<HTMLPreElement>(null)
  const language = String(props['data-language' as keyof typeof props] ?? '')
    || String((children as { props?: { className?: string } })?.props?.className ?? '')
      .replace(/^language-/, '')

  return (
    <div className="docs-code">
      <div className="docs-code-header">
        <span>{filename || language || 'code'}</span>
        <CodeCopyButton readText={() => preRef.current?.textContent ?? ''} />
      </div>
      <pre {...props} ref={preRef}>{children}</pre>
    </div>
  )
}
