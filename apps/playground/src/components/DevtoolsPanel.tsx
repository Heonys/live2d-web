'use client'

import type { Live2DDevtools } from 'live2d-web/devtools'
import type { Live2DModelController } from 'live2d-web/react'
import { useEffect, useRef } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'

/**
 * Mounts the devtools panel on the loaded model.
 *
 * The panel fills its container rather than floating, so it needs a sized host;
 * an unsized div renders it at zero height and it looks like nothing happened.
 * `Live2DModelController` already satisfies `Live2DDevtoolsTarget`, so the
 * controller the page already holds is enough and this need not sit inside
 * `<Live2DModel>`.
 */
export function DevtoolsPanel({ target }: { target: Live2DModelController | null }) {
  const messages = useSiteMessages().playground
  const hostRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const host = hostRef.current
    if (!target || !host)
      return
    let devtools: Live2DDevtools | undefined
    let cancelled = false
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

  if (!target) {
    return (
      <div className="devtools-pending" role="status">
        <span aria-hidden="true" className="devtools-pending-dot" />
        <p>{messages.modelControlsPending}</p>
      </div>
    )
  }

  return <div className="devtools-host" data-testid="devtools-host" ref={hostRef} />
}
