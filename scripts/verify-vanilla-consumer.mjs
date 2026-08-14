#!/usr/bin/env node

import { readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const app = path.join(root, 'apps/vanilla-consumer')
const manifest = JSON.parse(readFileSync(path.join(app, 'package.json'), 'utf8'))
const declared = {
  ...manifest.dependencies,
  ...manifest.devDependencies,
}
const failures = []

if ('react' in declared || 'react-dom' in declared)
  failures.push('vanilla consumer declares a React dependency')

const assets = path.join(app, 'dist/assets')
const bundle = readdirSync(assets)
  .filter(file => file.endsWith('.js'))
  .map(file => readFileSync(path.join(assets, file), 'utf8'))
  .join('\n')
if (/(?:^|[^a-z])react(?:[^a-z]|$)|react\//i.test(bundle))
  failures.push('vanilla consumer production bundle contains React runtime code')

if (failures.length) {
  for (const failure of failures)
    console.error(`[consumer] ${failure}`)
  process.exitCode = 1
}
else {
  console.log('[consumer] React-free manifest and production bundle verified')
}
