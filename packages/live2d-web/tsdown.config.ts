import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { defineConfig } from 'tsdown'

const packageRoot = path.dirname(fileURLToPath(import.meta.url))

export default defineConfig({
  alias: {
    '#cubism-framework': path.join(
      packageRoot,
      'vendor/cubism-web-framework-5-r.5/src',
    ),
  },
  // The Pixi v6 backend is deliberately absent: it stays in the repository as
  // the A/B benchmark counterpart, but shipping it would put Pixi packages
  // into the published dependency graph for a path almost nobody takes.
  entry: {
    'index': 'src/index.ts',
    'react': 'src/react.ts',
    'backends/cubism-webgl': 'src/backends/cubism-webgl/index.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
})
