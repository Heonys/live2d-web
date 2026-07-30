type Cleanup = () => void

function once(cleanup: Cleanup): Cleanup {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

/** A reusable LIFO cleanup scope for model features. */
export class LifecycleScope {
  private cleanups = new Set<Cleanup>()

  add(cleanup: Cleanup): Cleanup {
    const wrapped = once(() => {
      this.cleanups.delete(wrapped)
      cleanup()
    })
    this.cleanups.add(wrapped)
    return wrapped
  }

  disposeAll(): void {
    const cleanups = Array.from(this.cleanups).reverse()
    for (const cleanup of cleanups)
      cleanup()
  }
}
