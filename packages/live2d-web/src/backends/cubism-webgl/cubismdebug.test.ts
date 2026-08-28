import { afterEach, describe, expect, it, vi } from 'vitest'
import { CSM_ASSERT } from '#cubism-framework/utils/cubismdebug'

describe('cubism framework assertions', () => {
  afterEach(() => {
    vi.restoreAllMocks()
  })

  it('does not forward successful assertions to the browser console', () => {
    const assert = vi.spyOn(console, 'assert').mockImplementation(() => {})

    CSM_ASSERT(true)

    expect(assert).not.toHaveBeenCalled()
  })

  it('keeps reporting failed assertions', () => {
    const assert = vi.spyOn(console, 'assert').mockImplementation(() => {})

    CSM_ASSERT(false)

    expect(assert).toHaveBeenCalledOnce()
    expect(assert).toHaveBeenCalledWith(false)
  })
})
