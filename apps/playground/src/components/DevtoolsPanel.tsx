'use client'

import type { Live2DDevtools } from 'live2d-web/devtools'
import type { Live2DModelController } from 'live2d-web/react'
import { useEffect, useRef } from 'react'

/**
 * Mounts the devtools panel on the loaded model.
 *
 * Development only. A debugging surface has no place on the public demo, but
 * the graduation condition for the `/devtools` entry is one real consumer, and
 * judging it without ever using it would be guesswork.
 *
 * The panel fills its container rather than floating, so it needs a sized host;
 * an unsized div renders it at zero height and it looks like nothing happened.
 * `Live2DModelController` already satisfies `Live2DDevtoolsTarget`, so the
 * controller the page already holds is enough and this need not sit inside
 * `<Live2DModel>`.
 */
export function DevtoolsPanel({ target }: { target: Live2DModelController | null }) {
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!target || !host)
      return
    let devtools: Live2DDevtools | undefined
    let cancelled = false
    // Static import would put the entry in the bundle even though the render
    // gate never runs in production.
    void import('live2d-web/devtools').then(({ mountLive2DDevtools }) => {
      if (cancelled)
        return
      devtools = mountLive2DDevtools({ container: host, target })
    })
    return () => {
      cancelled = true
      devtools?.dispose()
    }
  }, [target])

  return (
    <div
      ref={hostRef}
      data-testid="devtools-host"
      style={{ display: 'flex', minHeight: 420 }}
    />
  )
}
