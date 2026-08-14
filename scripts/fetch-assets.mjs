#!/usr/bin/env node
// Cubism Core + Hiyori 샘플 모델을 공식 배포처에서 준비한다.
// 프로젝트가 배포하는 자산이 아니므로 커밋하지 않는다(.gitignore의 apps/playground/public/assets/).
// 멱등: 이미 있으면 건너뛴다.

import { Buffer } from 'node:buffer'
import { execSync } from 'node:child_process'
import { existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'apps/playground/public')
const assetsDir = path.join(publicDir, 'assets')
const cacheDir = path.join(root, 'tmp/asset-cache')

// Versioned Core URL: avoid the compatibility drift explicitly warned about
// for Live2D's unversioned "Latest" URL.
// Core 06 is Cubism 5.3 and matches Framework 5-r.5. Keeping the destination
// versioned prevents a stale Core 05 file from being silently reused.
const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/core/06/live2dcubismcore.min.js'
const HIYORI_URL = 'https://cubism.live2d.com/sample-data/bin/hiyori/hiyori_en.zip'
const TERMS = [
  'https://www.live2d.com/en/sdk/download/web/',
  'https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html',
  'https://www.live2d.com/en/learn/sample/momose-hiyori/',
]

function assertTermsAccepted() {
  if (process.env.LIVE2D_ACCEPT_TERMS === '1')
    return
  throw new Error(
    `공식 Cubism Core/Hiyori를 처음 내려받기 전에 아래 현재 약관을 확인한 뒤 `
    + `\`LIVE2D_ACCEPT_TERMS=1 pnpm fetch-assets\`로 다시 실행하세요.\n${
      TERMS.map(url => `- ${url}`).join('\n')}`,
  )
}

async function download(url, dest) {
  if (existsSync(dest))
    return
  assertTermsAccepted()
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

// 1. Cubism Core — <Live2DStage coreUrl> 경로와 일치해야 한다
const coreDest = path.join(assetsDir, 'js/cubism/5.3/live2dcubismcore.min.js')
if (existsSync(coreDest)) {
  console.log('[skip] Cubism Core')
}
else {
  await download(CUBISM_CORE_URL, coreDest)
  console.log(`[ok] Cubism Core → ${path.relative(root, coreDest)}`)
}

// 2. Hiyori 샘플 모델 (Live2D 공식 무료 샘플)
const hiyoriDir = path.join(assetsDir, 'live2d/hiyori')
let model3 = findFile(hiyoriDir, name => name.endsWith('.model3.json'))
if (model3) {
  console.log('[skip] Hiyori')
}
else {
  const zip = path.join(cacheDir, 'hiyori_en.zip')
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
