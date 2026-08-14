import type { Page } from '@playwright/test'
import type { BenchmarkEnvironment } from './schema'
import { execFileSync } from 'node:child_process'
import os from 'node:os'

export function gitCommit() {
  return execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
}

export async function readBenchmarkEnvironment(page: Page): Promise<BenchmarkEnvironment> {
  const browser = await page.evaluate(() => navigator.userAgent)
  const webglRenderer = await page.evaluate(() => {
    const canvas = document.createElement('canvas')
    const gl = canvas.getContext('webgl2')
    if (!gl)
      return 'WebGL2 unavailable'
    const debug = gl.getExtension('WEBGL_debug_renderer_info')
    return debug
      ? String(gl.getParameter(debug.UNMASKED_RENDERER_WEBGL))
      : String(gl.getParameter(gl.RENDERER))
  })
  return {
    browser,
    cpu: os.cpus()[0]?.model ?? 'unknown',
    memoryBytes: os.totalmem(),
    os: `${os.type()} ${os.release()} ${os.arch()}`,
    webglRenderer,
  }
}
