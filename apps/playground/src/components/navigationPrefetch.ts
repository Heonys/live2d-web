'use client'

interface NetworkInformationLike {
  effectiveType?: string
  saveData?: boolean
}

export function canBackgroundPrefetch() {
  if (typeof navigator === 'undefined')
    return false
  const connection = (navigator as Navigator & {
    connection?: NetworkInformationLike
  }).connection
  return !connection?.saveData && !connection?.effectiveType?.includes('2g')
}

export function scheduleIdle(
  callback: () => void,
  options: { delay?: number, timeout?: number } = {},
) {
  if (typeof window === 'undefined')
    return () => {}

  let idleHandle: number | undefined
  const timeoutHandle = window.setTimeout(() => {
    if (window.requestIdleCallback) {
      idleHandle = window.requestIdleCallback(callback, {
        timeout: options.timeout ?? 2_000,
      })
    }
    else {
      callback()
    }
  }, options.delay ?? 0)

  return () => {
    window.clearTimeout(timeoutHandle)
    if (idleHandle !== undefined)
      window.cancelIdleCallback(idleHandle)
  }
}

/**
 * Waits until the browser has painted the current UI before running optional
 * work. The timeout is started immediately, so an always-busy main thread can
 * delay the callback by at most the configured amount while the page is
 * visible.
 */
export function scheduleAfterPaintIdle(callback: () => void, timeout = 500) {
  if (typeof window === 'undefined')
    return () => {}

  let cancelled = false
  let started = false
  let secondFrame: number | undefined
  let idleHandle: number | undefined

  const run = () => {
    if (cancelled || started)
      return
    started = true
    callback()
  }

  const forceHandle = window.setTimeout(run, timeout)
  const firstFrame = window.requestAnimationFrame(() => {
    secondFrame = window.requestAnimationFrame(() => {
      if (window.requestIdleCallback) {
        idleHandle = window.requestIdleCallback(run, { timeout })
      }
      else {
        run()
      }
    })
  })

  return () => {
    cancelled = true
    window.clearTimeout(forceHandle)
    if (firstFrame !== undefined)
      window.cancelAnimationFrame(firstFrame)
    if (secondFrame !== undefined)
      window.cancelAnimationFrame(secondFrame)
    if (idleHandle !== undefined)
      window.cancelIdleCallback(idleHandle)
  }
}
