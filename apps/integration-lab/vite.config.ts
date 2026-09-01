import { readFileSync, realpathSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const appRoot = path.dirname(fileURLToPath(import.meta.url))
const repositoryRoot = path.resolve(appRoot, '../..')
const packageRoot = path.join(repositoryRoot, 'packages/live2d-web')
const releaseVersion = '0.9.0'

function findPackageRoot(entry: string) {
  let directory = path.dirname(realpathSync(entry))
  while (directory !== path.dirname(directory)) {
    try {
      const manifest = JSON.parse(readFileSync(path.join(directory, 'package.json'), 'utf8')) as {
        name?: string
      }
      if (manifest.name === 'live2d-web')
        return directory
    }
    catch {}
    directory = path.dirname(directory)
  }
  throw new Error(`Could not locate the live2d-web package for ${entry}.`)
}

function releaseMetadata() {
  const require = createRequire(path.join(appRoot, 'package.json'))
  const entry = require.resolve('live2d-web')
  const installedRoot = findPackageRoot(entry)
  const manifest = JSON.parse(readFileSync(path.join(installedRoot, 'package.json'), 'utf8')) as {
    version?: string
  }
  if (manifest.version !== releaseVersion) {
    throw new Error(
      `Integration lab expected npm live2d-web@${releaseVersion}, received ${manifest.version ?? 'unknown'}.`,
    )
  }
  const realEntry = realpathSync(entry)
  if (!realEntry.includes(`${path.sep}dist${path.sep}`)) {
    throw new Error(
      `Release mode resolved to a non-dist entry (${realEntry}). The lab must not use a workspace link.`,
    )
  }
  return { entry: realEntry, packageVersion: manifest.version }
}

const localEntries = [
  ['live2d-web/tracking/mediapipe/worker', 'src/tracking/mediapipe/worker.ts'],
  ['live2d-web/tracking/mediapipe', 'src/tracking/mediapipe/index.ts'],
  ['live2d-web/backends/cubism-webgl', 'src/backends/cubism-webgl/index.ts'],
  ['live2d-web/devtools', 'src/devtools/index.ts'],
  ['live2d-web/inspect', 'src/inspect/index.ts'],
  ['live2d-web/debug', 'src/debug/index.ts'],
  ['live2d-web/react', 'src/react.ts'],
  ['live2d-web', 'src/index.ts'],
] as const

export default defineConfig(({ mode }) => {
  const source = mode === 'workspace' ? 'local' : 'release'
  const release = source === 'release' ? releaseMetadata() : undefined
  const metadata = source === 'local'
    ? {
        entry: path.join(packageRoot, 'src/index.ts'),
        packageVersion: JSON.parse(
          readFileSync(path.join(packageRoot, 'package.json'), 'utf8'),
        ).version as string,
        source,
      }
    : { ...release!, source }

  return {
    base: '/',
    build: {
      copyPublicDir: false,
      rollupOptions: {
        input: {
          'app': path.join(appRoot, 'index.html'),
          'frame-live2d': path.join(appRoot, 'frames/live2d.html'),
          'frame-pixi': path.join(appRoot, 'frames/pixi.html'),
          'overlay': path.join(appRoot, 'overlay.html'),
        },
      },
    },
    define: {
      __LIVE2D_LAB_META__: JSON.stringify(metadata),
    },
    optimizeDeps: source === 'local'
      ? { exclude: localEntries.map(([name]) => name) }
      : undefined,
    plugins: [react()],
    publicDir: path.join(repositoryRoot, 'apps/playground/public'),
    resolve: {
      alias: source === 'local'
        ? localEntries.map(([find, relative]) => ({
            find: new RegExp(`^${find.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`),
            replacement: path.join(packageRoot, relative),
          }))
        : [],
      dedupe: ['react', 'react-dom'],
    },
    server: {
      fs: { allow: [repositoryRoot] },
    },
  }
})
