'use client'

import type { HTMLAttributes } from 'react'
import { useRef } from 'react'
import { CodeCopyButton } from './CodeCopyButton'

export function CodeFigure({ children, ...props }: HTMLAttributes<HTMLElement>) {
  const figureRef = useRef<HTMLElement>(null)
  return (
    <figure {...props} ref={figureRef}>
      <CodeCopyButton
        readText={() => figureRef.current?.querySelector('pre')?.textContent ?? ''}
      />
      {children}
    </figure>
  )
}
