#!/usr/bin/env node

import { readdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const sourceDirectory = path.join(
  root,
  'packages/live2d-jsx/vendor/cubism-web-framework-5-r.5/Shaders/WebGL',
)
const output = path.join(
  root,
  'packages/live2d-jsx/src/adapters/cubism-webgl/shaderSources.generated.ts',
)
const files = readdirSync(sourceDirectory)
  .filter(file => /\.(?:frag|vert)$/i.test(file))
  .sort()

if (files.length !== 13)
  throw new Error(`Expected 13 Cubism WebGL shaders, found ${files.length}.`)

const sources = Object.fromEntries(files.map(file => [
  file,
  readFileSync(path.join(sourceDirectory, file), 'utf8'),
]))
const generated = `// Generated from the vendored Framework shaders. Do not edit by hand.\nexport const CUBISM_WEBGL_SHADER_SOURCES = ${JSON.stringify(sources, null, 2)} as const\n`

writeFileSync(output, generated)
console.log(`[package] generated ${files.length} bundled shader sources`)
