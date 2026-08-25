#!/usr/bin/env node

import { Buffer } from 'node:buffer'
import { createHash } from 'node:crypto'
import {
  copyFileSync,
  existsSync,
  mkdirSync,
  readFileSync,
  renameSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageDirectory = path.join(
  root,
  'packages/live2d-web/node_modules/@mediapipe/tasks-vision',
)
const outputDirectory = path.join(
  root,
  'apps/playground/public/assets/mediapipe',
)
const wasmOutputDirectory = path.join(outputDirectory, 'wasm')

// Each asset carries its own provenance: the npm license check below covers
// only the package, not these downloads.
const remoteAssets = [
  {
    file: 'face_landmarker.task',
    license: 'Apache-2.0 (Google model card)',
    sha256: '64184e229b263107bc2b804c6625db1341ff2bb731874b0bcc2fe6544e0bc9ff',
    url: 'https://storage.googleapis.com/mediapipe-models/face_landmarker/face_landmarker/float16/1/face_landmarker.task',
  },
  {
    file: 'portrait.jpg',
    license: 'MediaPipe sample asset; test fixture only',
    sha256: 'a6f11efaa834706db23f275b6115058fa87fc7f14362681e6abe14e82749de3e',
    url: 'https://storage.googleapis.com/mediapipe-assets/portrait.jpg',
  },
]

const wasmHashes = {
  'vision_wasm_internal.js': 'e170ee67dd4e16c1a6fcd8840a206687e5a59b22c20e4a902bc445b095454d73',
  'vision_wasm_internal.wasm': '8da277a733926eacd0474b8704b36742d6ec3231c57a860c5b889dff8f1df886',
  'vision_wasm_module_internal.js': 'da8934057f147b622e82cfb4c0dbd85461c598e268588b5a8ba9ca963a8ff82d',
  'vision_wasm_module_internal.wasm': '2dabd8e23c60984628beb7bb338764c81a08e6837145273f59578684b5d53c1b',
  'vision_wasm_nosimd_internal.js': 'e81d715a3d42cc3373602eb2f7aff795d164934db680e32496b65dab537f9658',
  'vision_wasm_nosimd_internal.wasm': 'a28483cd42e74e855bf5ebdb6b40d9b66a5b49e35e95020bc97669e6822a3192',
}

function sha256(file) {
  return createHash('sha256').update(readFileSync(file)).digest('hex')
}

function verify(file, expected) {
  if (!existsSync(file))
    return false
  const actual = sha256(file)
  if (actual !== expected)
    throw new Error(`SHA-256 mismatch for ${file}: expected ${expected}, received ${actual}`)
  return true
}

async function download(asset) {
  const destination = path.join(outputDirectory, asset.file)
  if (verify(destination, asset.sha256))
    return
  const response = await fetch(asset.url)
  if (!response.ok)
    throw new Error(`Failed to download ${asset.url}: HTTP ${response.status}`)
  const temporary = `${destination}.download`
  writeFileSync(temporary, Buffer.from(await response.arrayBuffer()))
  try {
    verify(temporary, asset.sha256)
    renameSync(temporary, destination)
  }
  finally {
    rmSync(temporary, { force: true })
  }
}

if (!existsSync(path.join(packageDirectory, 'package.json'))) {
  throw new Error(
    '@mediapipe/tasks-vision 1.0.1 is not installed. Run pnpm install first.',
  )
}

const installed = JSON.parse(readFileSync(path.join(packageDirectory, 'package.json'), 'utf8'))
if (installed.version !== '1.0.1') {
  throw new Error(
    `Expected @mediapipe/tasks-vision 1.0.1, received ${installed.version}. Update pinned hashes before continuing.`,
  )
}
if (installed.license !== 'Apache-2.0') {
  throw new Error(
    `Expected @mediapipe/tasks-vision to use Apache-2.0, received ${installed.license}.`,
  )
}

mkdirSync(wasmOutputDirectory, { recursive: true })
for (const [file, expected] of Object.entries(wasmHashes)) {
  const source = path.join(packageDirectory, 'wasm', file)
  verify(source, expected)
  const destination = path.join(wasmOutputDirectory, file)
  if (!verify(destination, expected))
    copyFileSync(source, destination)
}
for (const asset of remoteAssets)
  await download(asset)

writeFileSync(path.join(outputDirectory, 'asset-manifest.json'), `${JSON.stringify({
  generatedAt: new Date().toISOString(),
  mediaPipeTasksVision: { license: installed.license, version: installed.version },
  model: remoteAssets[0],
  portrait: remoteAssets[1],
  wasm: wasmHashes,
}, null, 2)}\n`)

console.log(`[mediapipe] verified ignored assets in ${path.relative(root, outputDirectory)}`)
