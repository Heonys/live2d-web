import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 20_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: 'list',
  testDir: '.',
  testMatch: 'model-benchmarks.spec.ts',
  timeout: 2 * 60 * 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3110',
    viewport: { height: 900, width: 1280 },
  },
  webServer: {
    command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3110',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3110',
  },
})
