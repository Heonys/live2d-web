#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const dist = path.join(root, 'packages/live2d-jsx/dist')
const entry = readFileSync(path.join(dist, 'index.mjs'), 'utf8')
const react = readFileSync(path.join(dist, 'react.mjs'), 'utf8')
const adapter = readFileSync(path.join(dist, 'adapters/pixi-v6.mjs'), 'utf8')
const rootBundle = readdirSync(dist)
  .filter(file => file.endsWith('.mjs') && file !== 'react.mjs')
  .map(file => readFileSync(path.join(dist, file), 'utf8'))
  .join('\n')

const failures = []
if (entry.includes('"use client"') || entry.includes('\'use client\''))
  failures.push('dist/index.mjs must stay React-free and cannot contain "use client"')
if (rootBundle.includes('from "react"') || rootBundle.includes('from \'react\''))
  failures.push('root bundle contains a React dependency')
if (!react.startsWith('"use client"') && !react.startsWith('\'use client\''))
  failures.push('dist/react.mjs does not preserve the "use client" directive')
if (rootBundle.includes('@pixi/') || rootBundle.includes('pixi-live2d-display'))
  failures.push('root bundle contains a PIXI dependency')
if (rootBundle.includes('CubismFramework') || rootBundle.includes('csmGetVersion'))
  failures.push('root bundle appears to contain Cubism runtime code')
if (Buffer.byteLength(rootBundle) > 100_000)
  failures.push('root bundle unexpectedly exceeds 100 kB')
if (!adapter.includes('import("pixi-live2d-display/cubism4")'))
  failures.push('pixi-live2d-display must remain a browser-time dynamic import')
if (!rootBundle.includes('import("wlipsync")'))
  failures.push('wlipsync must remain a browser-time dynamic import')
if (rootBundle.includes('wlipsync-single') || rootBundle.includes('audio-processor.js'))
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
  console.log('[package] vanilla/react/adapter boundaries verified')
}
