import { describe, expect, it, vi } from 'vitest'
import { LifecycleScope } from './lifecycle'

describe('lifecycleScope', () => {
  it('disposes registered features in reverse order', () => {
    const order: string[] = []
    const scope = new LifecycleScope()
    scope.add(() => order.push('gaze'))
    scope.add(() => order.push('parameter-driver'))

    scope.disposeAll()

    expect(order).toEqual(['parameter-driver', 'gaze'])
  })

  it('makes individual and bulk cleanup idempotent', () => {
    const cleanup = vi.fn()
    const scope = new LifecycleScope()
    const remove = scope.add(cleanup)

    remove()
    remove()
    scope.disposeAll()

    expect(cleanup).toHaveBeenCalledOnce()
  })
})
