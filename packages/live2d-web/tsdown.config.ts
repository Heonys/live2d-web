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
  entry: {
    'index': 'src/index.ts',
    'react': 'src/react.ts',
    'backends/cubism-webgl': 'src/backends/cubism-webgl/index.ts',
    'backends/pixi-v6': 'src/backends/pixi-v6/index.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
})
