import { readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'
import { Extractor, ExtractorConfig } from '@microsoft/api-extractor'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = path.join(root, 'packages/live2d-web')
const packageJsonPath = path.join(packageRoot, 'package.json')
const update = process.argv.includes('--update')

const entries = {
  'cubism-webgl': 'dist/backends/cubism-webgl.d.mts',
  'debug': 'dist/debug.d.mts',
  'devtools': 'dist/devtools.d.mts',
  'inspect': 'dist/inspect.d.mts',
  'mediapipe': 'dist/tracking/mediapipe.d.mts',
  'mediapipe-worker': 'dist/tracking/mediapipe/worker.d.mts',
  'react': 'dist/react.d.mts',
  'root': 'dist/index.d.mts',
}

let failed = false

for (const [name, entry] of Object.entries(entries)) {
  const config = ExtractorConfig.prepare({
    configObject: {
      apiReport: {
        enabled: true,
        includeForgottenExports: true,
        reportFileName: name,
        reportFolder: '<projectFolder>/etc/api',
        reportTempFolder: '<projectFolder>/../../tmp/api-contract',
      },
      compiler: {
        // Matches the repository default. With it false, an error inside a
        // dependency's own .d.ts turns api:check red on a failure that
        // pnpm typecheck never reproduces.
        skipLibCheck: true,
        tsconfigFilePath: '<projectFolder>/tsconfig.json',
      },
      docModel: { enabled: false },
      dtsRollup: { enabled: false },
      mainEntryPointFilePath: `<projectFolder>/${entry}`,
      messages: {
        compilerMessageReporting: {
          default: { logLevel: 'warning' },
        },
        extractorMessageReporting: {
          default: { logLevel: 'none' },
        },
        tsdocMessageReporting: {
          default: { logLevel: 'none' },
        },
      },
      projectFolder: packageRoot,
      tsdocMetadata: { enabled: false },
    },
    configObjectFullPath: path.join(root, 'scripts/api-contract.mjs'),
    packageJsonFullPath: packageJsonPath,
  })
  const result = Extractor.invoke(config, {
    localBuild: update,
    printApiReportDiff: !update,
    showVerboseMessages: false,
    typescriptCompilerFolder: path.dirname(
      fileURLToPath(import.meta.resolve('typescript/package.json')),
    ),
  })
  if (!result.succeeded)
    failed = true
}

if (update) {
  for (const name of Object.keys(entries)) {
    const reportPath = path.join(packageRoot, 'etc/api', `${name}.api.md`)
    const report = readFileSync(reportPath, 'utf8')
    writeFileSync(reportPath, report.replaceAll('\r\n', '\n'))
  }
}

if (failed)
  process.exitCode = 1
