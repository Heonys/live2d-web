#!/usr/bin/env node

import { readdirSync, readFileSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'packages/live2d-jsx/dist')
const entry = readFileSync(path.join(dist, 'index.mjs'), 'utf8')
const adapter = readFileSync(path.join(dist, 'adapters/pixi-v6.mjs'), 'utf8')

const failures = []
if (!entry.startsWith('"use client"') && !entry.startsWith('\'use client\''))
  failures.push('dist/index.mjs does not preserve the "use client" directive')
if (entry.includes('@pixi/') || entry.includes('pixi-live2d-display'))
  failures.push('root bundle contains a PIXI dependency')
if (entry.includes('CubismFramework') || entry.includes('csmGetVersion'))
  failures.push('root bundle appears to contain Cubism runtime code')
if (statSync(path.join(dist, 'index.mjs')).size > 100_000)
  failures.push('root bundle unexpectedly exceeds 100 kB')
if (!adapter.includes('import("pixi-live2d-display/cubism4")'))
  failures.push('pixi-live2d-display must remain a browser-time dynamic import')
if (!entry.includes('import("wlipsync")'))
  failures.push('wlipsync must remain a browser-time dynamic import')
if (entry.includes('wlipsync-single') || entry.includes('audio-processor.js'))
  failures.push('root bundle appears to inline the wlipsync runtime')

const bundledAssets = readdirSync(dist, { recursive: true })
  .map(file => String(file))
  .filter(file => /\.(?:bin|json|wasm)$/i.test(file))
if (bundledAssets.length)
  failures.push(`package dist contains forbidden profile/runtime assets: ${bundledAssets.join(', ')}`)

try {
  await import(pathToFileURL(path.join(dist, 'index.mjs')).href)
}
catch (error) {
  failures.push(`root bundle is not SSR-evaluation safe: ${String(error)}`)
}

if (failures.length) {
  for (const failure of failures)
    console.error(`[package] ${failure}`)
  process.exitCode = 1
}
else {
  console.log('[package] root/adapter boundaries verified')
}
