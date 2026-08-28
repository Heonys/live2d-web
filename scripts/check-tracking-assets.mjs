// The public demo shipped for two releases with face tracking dead: the deploy
// build called fetch-assets but not fetch-mediapipe-assets, so every file under
// /assets/mediapipe/ was a 404. Nothing caught it because CI runs both scripts
// and no gate looks at the deployed site. This guard lives in the app's own
// build rather than the host config, which is what vanished in the migration.
import { existsSync, statSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const assets = path.join(root, 'apps/playground/public/assets/mediapipe')
const required = [
  'asset-manifest.json',
  'face_landmarker.task',
  'wasm/vision_wasm_internal.js',
  'wasm/vision_wasm_internal.wasm',
  'wasm/vision_wasm_module_internal.js',
  'wasm/vision_wasm_module_internal.wasm',
  'wasm/vision_wasm_nosimd_internal.js',
  'wasm/vision_wasm_nosimd_internal.wasm',
]

const missing = required.filter((file) => {
  const target = path.join(assets, file)
  return !existsSync(target) || statSync(target).size === 0
})

if (missing.length > 0) {
  process.exitCode = 1
  throw new Error(
    `MediaPipe tracking assets are missing, so the built site would serve 404s `
    + `for them and face tracking would fail in every browser:\n`
    + `${missing.map(file => `  - assets/mediapipe/${file}`).join('\n')}\n`
    + `Run \`pnpm -w fetch-mediapipe-assets\` before building. Deploy builds must `
    + `run it too: see buildCommand in apps/playground/vercel.json.`,
  )
}
