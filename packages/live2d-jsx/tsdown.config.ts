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
    'adapters/cubism-webgl': 'src/adapters/cubism-webgl/index.ts',
    'adapters/pixi-v6': 'src/adapters/pixi-v6/index.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
})
