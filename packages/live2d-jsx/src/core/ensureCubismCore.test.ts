import { afterEach, describe, expect, it } from 'vitest'
import { ensureCubismCore } from './ensureCubismCore'
import { Live2DError } from './errors'

// node 환경 테스트 — window를 globalThis에 직접 심어 시뮬레이션한다
const g = globalThis as { window?: { Live2DCubismCore?: unknown } }

describe('ensureCubismCore', () => {
  afterEach(() => {
    delete g.window
  })

  it('core가 전역에 있으면 통과한다', () => {
    g.window = { Live2DCubismCore: {} }
    expect(() => ensureCubismCore()).not.toThrow()
  })

  it('window가 없으면(SSR) core-missing을 던진다', () => {
    expect(() => ensureCubismCore()).toThrowError(Live2DError)
    try {
      ensureCubismCore()
    }
    catch (error) {
      expect((error as Live2DError).code).toBe('core-missing')
    }
  })

  it('core가 없으면 로드 방법을 담은 core-missing을 던진다', () => {
    g.window = {}
    try {
      ensureCubismCore()
      expect.unreachable('threw expected')
    }
    catch (error) {
      expect(error).toBeInstanceOf(Live2DError)
      expect((error as Live2DError).code).toBe('core-missing')
      expect((error as Live2DError).message).toContain('live2d.com')
    }
  })
})
