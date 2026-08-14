import { describe, expect, it } from 'vitest'
import {
  assertHardwareRenderer,
  isHardwareRenderer,
} from '../../../../benchmarks/lib/environment'
import { renderBenchmarkReport } from '../../../../benchmarks/lib/report'
import { BENCHMARK_SCHEMA_VERSION } from '../../../../benchmarks/lib/schema'

describe('hardware renderer gate', () => {
  it('accepts identifiable hardware renderers', () => {
    expect(isHardwareRenderer(
      'ANGLE (Apple, ANGLE Metal Renderer: Apple M2 Pro, Unspecified Version)',
    )).toBe(true)
  })

  it.each([
    'ANGLE (Google, Vulkan 1.3.0 (SwiftShader Device), SwiftShader driver)',
    'llvmpipe (LLVM 17.0.0)',
    'Software Renderer',
    'ANGLE',
    'WebGL',
    'WebGL2 unavailable',
    'unknown',
    '',
  ])('rejects software or unknown renderer %j', (renderer) => {
    expect(isHardwareRenderer(renderer)).toBe(false)
    expect(() => assertHardwareRenderer(renderer)).toThrow('Hardware GPU benchmark')
  })

  it('refuses to promote a hardware suite captured with software rendering', () => {
    expect(() => renderBenchmarkReport({
      capturedAt: '2026-08-15T00:00:00.000Z',
      environment: {
        browser: 'Chromium',
        cpu: 'Test CPU',
        memoryBytes: 8 * 1024 ** 3,
        os: 'Test OS',
        webglRenderer: 'ANGLE (SwiftShader)',
      },
      gitCommit: 'abc123',
      metadata: { core: '5.3', framework: '5-r.5', sampleRef: '5-r.5' },
      runs: [],
      schemaVersion: BENCHMARK_SCHEMA_VERSION,
      suite: 'hardware-smoke',
    })).toThrow('Hardware GPU benchmark')
  })
})
