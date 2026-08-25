'use client'

import { useState } from 'react'

export function CodeBlock({ language, value }: { language: string, value: string }) {
  const [copied, setCopied] = useState(false)

  return (
    <div className="docs-code">
      <div>
        <span>{language}</span>
        <button
          type="button"
          onClick={() => {
            void navigator.clipboard.writeText(value).then(() => {
              setCopied(true)
              window.setTimeout(setCopied, 1_500, false)
            })
          }}
        >
          {copied ? 'Copied' : 'Copy'}
        </button>
      </div>
      <pre><code>{value}</code></pre>
    </div>
  )
}
