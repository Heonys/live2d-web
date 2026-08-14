import path from 'node:path'
import { defineConfig } from 'vite'

export default defineConfig({
  publicDir: path.resolve(import.meta.dirname, '../playground/public'),
})
