'use client'

import { useEffect, useState } from 'react'
import { useSiteMessages } from '../i18n/SiteLocale'

const DEFAULT_REVEAL_DELAY_MS = 350

interface StageLoadingProps {
  delayMs?: number
}

/**
 * One loading state for the whole demo. Brief loads stay visually quiet so
 * that the loading character never flashes between the stage and the model.
 */
export function StageLoading({ delayMs = DEFAULT_REVEAL_DELAY_MS }: StageLoadingProps = {}) {
  const messages = useSiteMessages().stageLoading
  const [visible, setVisible] = useState(delayMs <= 0)

  useEffect(() => {
    if (delayMs <= 0)
      return

    const timer = window.setTimeout(setVisible, delayMs, true)
    return () => window.clearTimeout(timer)
  }, [delayMs])

  return (
    <div
      aria-hidden={!visible}
      className="stage-loading"
      data-visible={visible}
      role={visible ? 'status' : undefined}
    >
      <div className="stage-loading-mark" aria-hidden="true">
        <span className="stage-loading-character" />
      </div>
      <p className="stage-loading-label">{messages.preparing}</p>
    </div>
  )
}
