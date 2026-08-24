import type {
  MotionPlaybackResult,
  MotionPlaybackStatus,
} from '../../core/contract'
import type { Live2DError } from '../../core/errors'

interface PendingMotion {
  reason: Extract<MotionPlaybackStatus, 'completed' | 'interrupted'>
  reject: (error: Live2DError) => void
  resolve: (result: MotionPlaybackResult) => void
}

export class MotionStateTracker<Handle> {
  private disposed = false
  private failure: Live2DError | undefined
  private readonly pending = new Map<Handle, PendingMotion>()

  track(handle: Handle): Promise<MotionPlaybackResult> {
    if (this.failure)
      return Promise.reject(this.failure)
    if (this.disposed)
      return Promise.resolve({ status: 'disposed' })
    return new Promise((resolve, reject) => {
      this.pending.set(handle, { reason: 'completed', reject, resolve })
    })
  }

  interruptActive() {
    for (const pending of this.pending.values())
      pending.reason = 'interrupted'
  }

  settleFinished(isFinished: (handle: Handle) => boolean) {
    for (const [handle, pending] of [...this.pending]) {
      if (!isFinished(handle))
        continue
      this.pending.delete(handle)
      pending.resolve({ status: pending.reason })
    }
  }

  fail(error: Live2DError) {
    this.failure ??= error
    for (const pending of this.takeAll())
      pending.reject(this.failure)
  }

  dispose() {
    if (this.disposed)
      return
    this.disposed = true
    for (const pending of this.takeAll())
      pending.resolve({ status: 'disposed' })
  }

  private takeAll() {
    const pending = [...this.pending.values()]
    this.pending.clear()
    return pending
  }
}
