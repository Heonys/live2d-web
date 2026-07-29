import { defineConfig } from 'tsdown'

export default defineConfig({
  entry: {
    'index': 'src/index.ts',
    'adapters/pixi-v6': 'src/adapters/pixi-v6/index.ts',
  },
  format: 'esm',
  dts: true,
  clean: true,
})
