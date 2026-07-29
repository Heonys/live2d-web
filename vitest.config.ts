import { defineConfig } from 'vitest/config'

// *.test.ts = node. DOM/WebGL이 필요한 건 *.browser.test.ts로 분리해
// 브라우저 프로젝트를 추가한다(도입 시 @vitest/browser-playwright).
export default defineConfig({
  test: {
    include: [
      'packages/**/src/**/*.test.ts',
      'packages/**/test/**/*.test.ts',
      'apps/**/src/**/*.test.ts',
    ],
    exclude: ['**/*.browser.test.ts', '**/node_modules/**'],
  },
})
