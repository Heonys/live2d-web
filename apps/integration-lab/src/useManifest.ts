import type { AssetManifest } from './constants'
import { useEffect, useState } from 'react'
import { loadManifest } from './constants'

export function useManifest() {
  const [manifest, setManifest] = useState<AssetManifest | null>(null)
  const [error, setError] = useState('')
  const [attempt, setAttempt] = useState(0)

  useEffect(() => {
    const controller = new AbortController()
    // Each retry owns a fresh request and clears the prior attempt's error.
    // eslint-disable-next-line react/set-state-in-effect
    setError('')
    loadManifest(controller.signal)
      .then(setManifest)
      .catch((caught: unknown) => {
        if (!controller.signal.aborted)
          setError(caught instanceof Error ? caught.message : String(caught))
      })
    return () => controller.abort()
  }, [attempt])

  return {
    error,
    manifest,
    retry: () => setAttempt(value => value + 1),
  }
}
