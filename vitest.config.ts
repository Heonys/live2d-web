import { fileURLToPath } from 'node:url'
import { defineConfig } from 'vitest/config'

// *.test.ts = node. DOM/WebGL이 필요한 건 *.browser.test.ts로 분리해
// 브라우저 프로젝트를 추가한다(도입 시 @vitest/browser-playwright).
export default defineConfig({
  resolve: {
    alias: {
      '#cubism-framework': fileURLToPath(new URL(
        './packages/live2d-web/vendor/cubism-web-framework-5-r.5/src',
        import.meta.url,
      )),
    },
  },
  test: {
    include: [
      'packages/**/src/**/*.test.{ts,tsx}',
      'packages/**/test/**/*.test.{ts,tsx}',
      'apps/**/src/**/*.test.{ts,tsx}',
    ],
    exclude: ['**/*.browser.test.ts', '**/node_modules/**'],
  },
})
