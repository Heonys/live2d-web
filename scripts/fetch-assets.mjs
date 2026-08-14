#!/usr/bin/env node
// Cubism Core + Hiyori 샘플 모델을 공식 배포처에서 준비한다.
// 프로젝트가 배포하는 자산이 아니므로 커밋하지 않는다(.gitignore의 apps/playground/public/assets/).
// 멱등: 이미 있으면 건너뛴다.

import { Buffer } from 'node:buffer'
import { execFileSync } from 'node:child_process'
import {
  cpSync,
  existsSync,
  mkdirSync,
  readdirSync,
  readFileSync,
  writeFileSync,
} from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { validateModelAssets } from './lib/cubism-benchmark-assets.mjs'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const publicDir = path.join(root, 'apps/playground/public')
const assetsDir = path.join(publicDir, 'assets')
const cacheDir = path.join(root, 'tmp/asset-cache')

// Versioned Core URL: avoid the compatibility drift explicitly warned about
// for Live2D's unversioned "Latest" URL.
// Core 06 is Cubism 5.3 and matches Framework 5-r.5. Keeping the destination
// versioned prevents a stale Core 05 file from being silently reused.
const CUBISM_CORE_URL = 'https://cubism.live2d.com/sdk-web/core/06/live2dcubismcore.min.js'
const CUBISM_PIXI_CORE_URL = 'https://cubism.live2d.com/sdk-web/core/05/live2dcubismcore.min.js'
const HIYORI_URL = 'https://cubism.live2d.com/sample-data/bin/hiyori/hiyori_en.zip'
const CUBISM_SAMPLES_REPOSITORY = 'https://github.com/Live2D/CubismWebSamples.git'
const CUBISM_SAMPLES_REF = '5-r.5'
const BENCHMARK_SAMPLE_MODELS = [
  { id: 'mark', name: 'Mark', role: 'lightweight' },
  { id: 'mao', name: 'Mao', role: 'expressions-pose' },
  { id: 'rice', name: 'Rice', role: 'masking' },
  { id: 'ren', name: 'Ren', role: 'cubism-5.3' },
]
const TERMS = [
  'https://www.live2d.com/en/sdk/download/web/',
  'https://www.live2d.com/eula/live2d-free-material-license-agreement_en.html',
  'https://www.live2d.com/en/learn/sample/model-terms/',
  'https://www.live2d.com/en/learn/sample/momose-hiyori/',
  'https://github.com/Live2D/CubismWebSamples/tree/5-r.5/Samples/Resources',
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

async function download(url, dest, { force = false } = {}) {
  if (!force && existsSync(dest))
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
  execFileSync('unzip', ['-oq', zipPath, '-d', destDir], { stdio: 'inherit' })
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

function toPublicUrl(filePath) {
  return `/${path.relative(publicDir, filePath).split(path.sep).join('/')}`
}

function prepareCubismSamples() {
  const checkoutDir = path.join(cacheDir, `CubismWebSamples-${CUBISM_SAMPLES_REF}`)
  const resources = BENCHMARK_SAMPLE_MODELS.map(
    model => `Samples/Resources/${model.name}`,
  )
  if (!existsSync(path.join(checkoutDir, '.git'))) {
    assertTermsAccepted()
    mkdirSync(path.dirname(checkoutDir), { recursive: true })
    execFileSync('git', [
      'clone',
      '--depth',
      '1',
      '--filter=blob:none',
      '--sparse',
      '--branch',
      CUBISM_SAMPLES_REF,
      CUBISM_SAMPLES_REPOSITORY,
      checkoutDir,
    ], { stdio: 'inherit' })
    execFileSync('git', ['-C', checkoutDir, 'sparse-checkout', 'set', ...resources], {
      stdio: 'inherit',
    })
  }

  const exactTagCommit = execFileSync(
    'git',
    ['-C', checkoutDir, 'rev-list', '-n', '1', CUBISM_SAMPLES_REF],
    { encoding: 'utf8' },
  ).trim()
  const checkedOutCommit = execFileSync(
    'git',
    ['-C', checkoutDir, 'rev-parse', 'HEAD'],
    { encoding: 'utf8' },
  ).trim()
  if (checkedOutCommit !== exactTagCommit) {
    throw new Error(
      `CubismWebSamples cache가 ${CUBISM_SAMPLES_REF}와 다르다. ignored cache를 확인하세요.`,
    )
  }

  return { checkoutDir, commit: checkedOutCommit }
}

// 1. Cubism Core — <Live2DStage coreUrl> 경로와 일치해야 한다
const coreDest = path.join(assetsDir, 'js/cubism/5.3/live2dcubismcore.min.js')
const currentCoreSource = existsSync(coreDest) ? readFileSync(coreDest, 'utf8') : ''
const hasCubism53Core = currentCoreSource.includes('MocVersion_53')
  && currentCoreSource.includes('ColorBlendType_Normal')
if (hasCubism53Core) {
  console.log('[skip] Cubism Core')
}
else {
  await download(CUBISM_CORE_URL, coreDest, { force: true })
  console.log(`[ok] Cubism Core → ${path.relative(root, coreDest)}`)
}

// pixi-live2d-display@0.4 embeds an older Framework that cannot consume the
// Core 5.3 drawable blend-mode layout. Keep its A/B fixture on the final
// pre-5.3 Core instead of swapping the process-global Core in one page.
const pixiCoreDest = path.join(assetsDir, 'js/cubism/5.2/live2dcubismcore.min.js')
const currentPixiCoreSource = existsSync(pixiCoreDest)
  ? readFileSync(pixiCoreDest, 'utf8')
  : ''
if (currentPixiCoreSource.includes('MocVersion_50')) {
  console.log('[skip] Cubism Core for pixi-v6')
}
else {
  await download(CUBISM_PIXI_CORE_URL, pixiCoreDest, { force: true })
  console.log(`[ok] Cubism Core for pixi-v6 → ${path.relative(root, pixiCoreDest)}`)
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
  model3: toPublicUrl(model3),
}
writeFileSync(path.join(hiyoriDir, 'manifest.json'), `${JSON.stringify(manifest, null, 2)}\n`)

// 4. 공식 SDK sample 모델 — 고정 Framework tag의 runtime Resources만 준비한다.
const { checkoutDir: samplesCheckout, commit: samplesCommit } = prepareCubismSamples()
const benchmarkModels = [{
  expected: validateModelAssets(model3),
  id: 'hiyori',
  model3: toPublicUrl(model3),
  motion: { group: 'Idle', index: 0 },
  name: 'Hiyori',
  role: 'standard',
  source: 'official-sample-download',
}]
for (const sample of BENCHMARK_SAMPLE_MODELS) {
  const sourceDir = path.join(samplesCheckout, 'Samples/Resources', sample.name)
  const destinationDir = path.join(assetsDir, 'live2d', sample.id)
  cpSync(sourceDir, destinationDir, { recursive: true })
  const sampleModel3 = path.join(destinationDir, `${sample.name}.model3.json`)
  benchmarkModels.push({
    expected: validateModelAssets(sampleModel3),
    id: sample.id,
    model3: toPublicUrl(sampleModel3),
    motion: { group: 'Idle', index: 0 },
    name: sample.name,
    role: sample.role,
    source: `CubismWebSamples@${CUBISM_SAMPLES_REF}`,
  })
  console.log(`[ok] ${sample.name} → ${path.relative(root, sampleModel3)}`)
}

writeFileSync(
  path.join(assetsDir, 'live2d/benchmark-models.json'),
  `${JSON.stringify({
    models: benchmarkModels,
    source: {
      commit: samplesCommit,
      ref: CUBISM_SAMPLES_REF,
      repository: CUBISM_SAMPLES_REPOSITORY,
    },
    version: 1,
  }, null, 2)}\n`,
)
console.log('done.')
