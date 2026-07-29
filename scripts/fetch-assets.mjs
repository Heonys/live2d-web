#!/usr/bin/env node
// Cubism Core + Hiyori 샘플 모델 다운로드.
// 라이선스상 재배포 금지 자산이라 커밋하지 않는다(.gitignore의 apps/playground/public/assets/).
// 멱등: 이미 있으면 건너뛴다.

import { Buffer } from 'node:buffer'
import { execSync } from 'node:child_process'
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'apps/playground/public')
const assetsDir = path.join(publicDir, 'assets')
const cacheDir = path.join(root, 'tmp/asset-cache')

const CUBISM_SDK_URL = 'https://cubism.live2d.com/sdk-web/bin/CubismSdkForWeb-5-r.3.zip'
const HIYORI_URL = 'https://dist.ayaka.moe/live2d-models/hiyori_free_zh.zip'

async function download(url, dest) {
  if (existsSync(dest))
    return
  console.log(`[download] ${url}`)
  const res = await fetch(url)
  if (!res.ok)
    throw new Error(`다운로드 실패(${res.status}): ${url} — 수동 다운로드가 필요할 수 있다`)
  mkdirSync(path.dirname(dest), { recursive: true })
  writeFileSync(dest, Buffer.from(await res.arrayBuffer()))
}

function unzip(zipPath, destDir) {
  mkdirSync(destDir, { recursive: true })
  execSync(`unzip -oq "${zipPath}" -d "${destDir}"`, { stdio: 'inherit' })
}

function findFile(dir, predicate) {
  if (!existsSync(dir))
    return null
  const entries = readdirSync(dir, { withFileTypes: true, recursive: true })
  for (const entry of entries) {
    if (entry.isFile() && predicate(entry.name))
      return path.join(entry.parentPath, entry.name)
  }
  return null
}

// 1. Cubism Core — layout.tsx의 <Script> 경로와 일치해야 한다
const coreDest = path.join(assetsDir, 'js/cubism/live2dcubismcore.min.js')
if (existsSync(coreDest)) {
  console.log('[skip] Cubism Core')
}
else {
  const sdkZip = path.join(cacheDir, 'CubismSdkForWeb.zip')
  await download(CUBISM_SDK_URL, sdkZip)
  const sdkDir = path.join(cacheDir, 'cubism-sdk')
  unzip(sdkZip, sdkDir)
  const core = findFile(sdkDir, name => name === 'live2dcubismcore.min.js')
  if (!core)
    throw new Error('SDK zip에서 live2dcubismcore.min.js를 찾지 못했다')
  mkdirSync(path.dirname(coreDest), { recursive: true })
  copyFileSync(core, coreDest)
  console.log(`[ok] Cubism Core → ${path.relative(root, coreDest)}`)
}

// 2. Hiyori 샘플 모델 (Live2D 공식 무료 샘플)
const hiyoriDir = path.join(assetsDir, 'live2d/hiyori')
let model3 = findFile(hiyoriDir, name => name.endsWith('.model3.json'))
if (model3) {
  console.log('[skip] Hiyori')
}
else {
  const zip = path.join(cacheDir, 'hiyori_free_zh.zip')
  await download(HIYORI_URL, zip)
  unzip(zip, hiyoriDir)
  model3 = findFile(hiyoriDir, name => name.endsWith('.model3.json'))
  if (!model3)
    throw new Error('Hiyori zip에서 model3.json을 찾지 못했다')
  console.log(`[ok] Hiyori → ${path.relative(root, model3)}`)
}

// 3. manifest — 앱 코드가 모델 경로를 하드코딩하지 않게 하는 간접층
const manifest = {
  model3: `/${path.relative(publicDir, model3).split(path.sep).join('/')}`,
}
writeFileSync(path.join(hiyoriDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)
console.log('done.')
