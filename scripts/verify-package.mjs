#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath, pathToFileURL } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageDirectory = path.join(root, 'packages/live2d-web')
const dist = path.join(packageDirectory, 'dist')
const entry = readFileSync(path.join(dist, 'index.mjs'), 'utf8')
const react = readFileSync(path.join(dist, 'react.mjs'), 'utf8')
const cubismAdapter = readFileSync(path.join(dist, 'backends/cubism-webgl.mjs'), 'utf8')
const reactDeclaration = readFileSync(path.join(dist, 'react.d.mts'), 'utf8')

function collectGraph(entryFile, includeDynamic) {
  const visited = new Set()
  const sources = []
  const visit = (file) => {
    const absolute = path.resolve(dist, file)
    if (visited.has(absolute))
      return
    visited.add(absolute)
    const source = readFileSync(absolute, 'utf8')
    sources.push(source)
    const patterns = [/from\s*["'](\.[^"']+\.mjs)["']/g]
    if (includeDynamic)
      patterns.push(/import\(["'](\.[^"']+\.mjs)["']\)/g)
    for (const pattern of patterns) {
      for (const match of source.matchAll(pattern)) {
        visit(path.relative(dist, path.resolve(path.dirname(absolute), match[1])))
      }
    }
  }
  visit(entryFile)
  return sources.join('\n')
}

const rootBundle = collectGraph('index.mjs', false)
const cubismBundle = collectGraph('backends/cubism-webgl.mjs', true)

const failures = []
if (entry.includes('"use client"') || entry.includes('\'use client\''))
  failures.push('dist/index.mjs must stay React-free and cannot contain "use client"')
if (rootBundle.includes('from "react"') || rootBundle.includes('from \'react\''))
  failures.push('root bundle contains a React dependency')
if (!react.startsWith('"use client"') && !react.startsWith('\'use client\''))
  failures.push('dist/react.mjs does not preserve the "use client" directive')
if (!/\bLive2DCanvas\b/.test(reactDeclaration) || !/\buseLive2DCanvas\b/.test(reactDeclaration))
  failures.push('React declarations are missing the Live2DCanvas public API')
if (/\bLive2DStage\b|\bLive2DStageProps\b|\bStageQualityProps\b|\bStageState\b|\buseStage\b/.test(reactDeclaration))
  failures.push('React declarations still expose removed Stage API names')
if (rootBundle.includes('@pixi/') || rootBundle.includes('pixi-live2d-display'))
  failures.push('root bundle contains a PIXI dependency')
if (rootBundle.includes('CubismFramework') || rootBundle.includes('csmGetVersion'))
  failures.push('root bundle appears to contain Cubism runtime code')
if (Buffer.byteLength(rootBundle) > 100_000)
  failures.push('root bundle unexpectedly exceeds 100 kB')
if (!rootBundle.includes('import("./backends/cubism-webgl.mjs")'))
  failures.push('root runtime does not dynamically import the default cubism-webgl adapter')
if (!cubismBundle.includes('CubismFramework') || !cubismBundle.includes('Live2DCubismCore'))
  failures.push('cubism-webgl adapter does not contain the bundled Framework runtime')
if (cubismBundle.includes('@pixi/') || cubismBundle.includes('pixi-live2d-display'))
  failures.push('cubism-webgl adapter contains a PIXI dependency')
if (!rootBundle.includes('import("wlipsync")'))
  failures.push('wlipsync must remain a browser-time dynamic import')
if (rootBundle.includes('wlipsync-single') || rootBundle.includes('audio-processor.js'))
  failures.push('root bundle appears to inline the wlipsync runtime')

const bundledAssets = readdirSync(dist, { recursive: true })
  .map(file => String(file))
  .filter(file => /\.(?:bin|json|wasm)$/i.test(file))
if (bundledAssets.length)
  failures.push(`package dist contains forbidden profile/runtime assets: ${bundledAssets.join(', ')}`)

const shaderDirectory = path.join(dist, 'backends/cubism-webgl-shaders')
const shaders = readdirSync(shaderDirectory)
  .filter(file => /\.(?:frag|vert)$/i.test(file))
if (shaders.length !== 13)
  failures.push(`package dist must contain 13 Cubism WebGL shaders, found ${shaders.length}`)
if (!cubismAdapter.includes('cubism-webgl-shaders') || !cubismAdapter.includes('import.meta.url'))
  failures.push('cubism-webgl default shader URL is not adapter-relative')

const packResult = JSON.parse(execFileSync(
  'npm',
  ['pack', '--dry-run', '--json'],
  { cwd: packageDirectory, encoding: 'utf8' },
))[0]
const tarballFiles = packResult.files.map(file => file.path)
const forbiddenTarballFiles = tarballFiles.filter(file =>
  /benchmark|live2dcubismcore|core-compat|hiyori|profile|fixture/i.test(file),
)
if (forbiddenTarballFiles.length) {
  failures.push(
    `npm tarball contains forbidden Core/model/profile/fixture files: ${forbiddenTarballFiles.join(', ')}`,
  )
}
const declarationFiles = readdirSync(dist, { recursive: true })
  .map(file => String(file))
  .filter(file => /\.d\.m?ts$/.test(file))
for (const declarationFile of declarationFiles) {
  const source = readFileSync(path.join(dist, declarationFile), 'utf8')
  if (/BenchmarkDiagnostics|benchmark-models/i.test(source))
    failures.push(`public declaration exposes benchmark internals: ${declarationFile}`)
}
for (const requiredFile of [
  'LICENSE',
  'LICENSES.md',
  'THIRD_PARTY_NOTICES.md',
  'vendor/cubism-web-framework-5-r.5/LICENSE.md',
]) {
  if (!tarballFiles.includes(requiredFile))
    failures.push(`npm tarball is missing ${requiredFile}`)
}
const tarballShaders = tarballFiles.filter(file =>
  file.startsWith('dist/backends/cubism-webgl-shaders/')
  && /\.(?:frag|vert)$/.test(file),
)
if (tarballShaders.length !== 13)
  failures.push(`npm tarball must contain 13 Cubism shaders, found ${tarballShaders.length}`)

try {
  await import(pathToFileURL(path.join(dist, 'index.mjs')).href)
}
catch (error) {
  failures.push(`root bundle is not SSR-evaluation safe: ${String(error)}`)
}

try {
  await import(pathToFileURL(path.join(dist, 'backends/cubism-webgl.mjs')).href)
}
catch (error) {
  failures.push(`cubism-webgl adapter is not SSR-evaluation safe: ${String(error)}`)
}

if (failures.length) {
  for (const failure of failures)
    console.error(`[package] ${failure}`)
  process.exitCode = 1
}
else {
  console.log('[package] vanilla/react/cubism boundaries verified')
}
