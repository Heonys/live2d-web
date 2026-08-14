#!/usr/bin/env node

import { cpSync, mkdirSync, readdirSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const source = path.join(
  root,
  'packages/live2d-jsx/vendor/cubism-web-framework-5-r.5/Shaders/WebGL',
)
const target = path.join(
  root,
  'packages/live2d-jsx/dist/adapters/cubism-webgl-shaders',
)
const shaders = readdirSync(source).filter(file => /\.(?:frag|vert)$/i.test(file))

if (shaders.length !== 13) {
  console.error(`[package] expected 13 Cubism WebGL shaders, found ${shaders.length}`)
  process.exit(1)
}

mkdirSync(target, { recursive: true })
for (const shader of shaders)
  cpSync(path.join(source, shader), path.join(target, shader))

console.log(`[package] copied ${shaders.length} Cubism WebGL shaders`)
