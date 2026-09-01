import antfu from '@antfu/eslint-config'

export default antfu({
  react: true,
  typescript: true,
  formatters: true,
  ignores: [
    'docs/**',
    // Vendored Framework keeps its upstream formatting and license headers.
    'private/**',
    'packages/live2d-web/vendor/**',
    // API Extractor reports are generated contract snapshots, not authored Markdown.
    'packages/live2d-web/etc/api/**',
    'packages/live2d-web/src/backends/cubism-webgl/shaderSources.generated.ts',
    'tmp/**',
    'test-results/**',
    'apps/playground/public/assets/**',
    // Next가 dev마다 재생성 — 스타일 룰과 무한 핑퐁 방지
    'apps/playground/next-env.d.ts',
  ],
}, {
  // Public API supports React 18.2, so React 19-only context syntax is not used.
  files: ['packages/live2d-web/src/react/**/*.{ts,tsx}'],
  rules: {
    'react/no-context-provider': 'off',
    'react/no-use-context': 'off',
  },
}, {
  // Next App Router 규약(metadata/viewport 등 export)은 컴포넌트 외 export가 정상
  files: ['apps/playground/src/app/**'],
  rules: {
    'react-refresh/only-export-components': 'off',
  },
}, {
  // The release lab deliberately bypasses workspace/catalog substitution so
  // it can exercise the exact registry tarball under test.
  files: ['apps/integration-lab/package.json'],
  rules: {
    'pnpm/json-enforce-catalog': 'off',
  },
}, {
  // pixi 계열 catalog 항목은 M0 어댑터 구현 전 선등록(버전 고정 기록) — 미사용 경고 제외
  files: ['pnpm-workspace.yaml'],
  rules: {
    'pnpm/yaml-no-unused-catalog-item': 'off',
  },
})
