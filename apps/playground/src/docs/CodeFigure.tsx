'use client'

import type { HTMLAttributes, ReactElement, ReactNode } from 'react'
import { Children, isValidElement, useRef } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'
import { CodeCopyButton } from './CodeCopyButton'

// Under this a caption alone reads the block, and a number column only weighs
// down a one-line command.
const LINE_NUMBER_THRESHOLD = 5

function propsOf(element: ReactElement) {
  return element.props as { children?: ReactNode } & Record<string, unknown>
}

function countLines(pre: ReactElement) {
  const code = Children.toArray(propsOf(pre).children).find(child => isValidElement(child))
  if (!isValidElement(code))
    return 0
  return Children.toArray(propsOf(code).children)
    .filter(child => isValidElement(child) && 'data-line' in propsOf(child))
    .length
}

export function CodeFigure({ children, ...props }: HTMLAttributes<HTMLElement>) {
  const messages = useSiteMessages().docs
  const figureRef = useRef<HTMLElement>(null)
  const items = Children.toArray(children)
  const pre = items.find(item => isValidElement(item) && item.type === 'pre')
  const captioned = items.some(item => isValidElement(item) && item.type === 'figcaption')
  const code = isValidElement(pre) ? pre : undefined

  return (
    <figure
      {...props}
      ref={figureRef}
      data-line-numbers={code && countLines(code) >= LINE_NUMBER_THRESHOLD ? '' : undefined}
    >
      <CodeCopyButton
        readText={() => figureRef.current?.querySelector('pre')?.textContent ?? ''}
      />
      {/* Same fallback order as CodeFrame, so a fenced block and a rendered one
          carry the same header instead of leaving the copy button alone. */}
      {code && !captioned && (
        <figcaption>{String(propsOf(code)['data-language'] ?? '') || messages.code}</figcaption>
      )}
      {children}
    </figure>
  )
}
