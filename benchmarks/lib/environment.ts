import type { Page } from '@playwright/test'
import type { BenchmarkEnvironment } from './schema'
import { execFileSync } from 'node:child_process'
import os from 'node:os'

export function gitCommit() {
  const commit = execFileSync('git', ['rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  const dirty = execFileSync('git', ['status', '--porcelain'], { encoding: 'utf8' }).trim()
  return dirty ? `${commit}-dirty` : commit
}

const SOFTWARE_RENDERER_MARKERS = [
  'basic render driver',
  'lavapipe',
  'llvmpipe',
  'softpipe',
  'software',
  'swiftshader',
]

const UNKNOWN_RENDERERS = new Set([
  '',
  'angle',
  'default',
  'opengl',
  'unknown',
  'unavailable',
  'webgl',
  'webgl 2.0',
  'webgl2 unavailable',
  'webkit webgl',
])

export function isHardwareRenderer(renderer: string) {
  const normalized = renderer.trim().toLowerCase()
  return !UNKNOWN_RENDERERS.has(normalized)
    && !SOFTWARE_RENDERER_MARKERS.some(marker => normalized.includes(marker))
}

export function assertHardwareRenderer(renderer: string) {
  if (!isHardwareRenderer(renderer)) {
    throw new Error(
      `Hardware GPU benchmark requires an identifiable non-software renderer; received: ${renderer}`,
    )
  }
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
