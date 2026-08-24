import type { ModelHandle } from './contract'

type Cleanup = () => void

export interface RuntimeFeature {
  attach: (model: ModelHandle) => void
  detach: () => void
}

function once(cleanup: Cleanup): Cleanup {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

/** Owns one model-bound feature across runtime model generations. */
export class ManagedFeature implements RuntimeFeature {
  private cleanup: Cleanup | undefined
  private generation = 0

  constructor(
    private readonly setup: (model: ModelHandle) => Cleanup | Promise<Cleanup>,
    private readonly report: (error: unknown) => void,
  ) {}

  attach(model: ModelHandle) {
    this.detach()
    const generation = this.generation
    try {
      const result = this.setup(model)
      if (result instanceof Promise) {
        void result.then((cleanup) => {
          if (generation !== this.generation) {
            cleanup()
            return
          }
          this.cleanup = once(cleanup)
        }).catch((error) => {
          if (generation === this.generation)
            this.report(error)
        })
      }
      else {
        this.cleanup = once(result)
      }
    }
    catch (error) {
      this.report(error)
    }
  }

  detach() {
    this.generation++
    this.cleanup?.()
    this.cleanup = undefined
  }
}
