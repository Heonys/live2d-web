import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [{
    name: 'chrome-hardware',
    use: {
      ...devices['Desktop Chrome'],
      channel: 'chrome',
      headless: false,
    },
  }],
  reporter: 'list',
  testDir: '.',
  testMatch: 'backend-comparison.spec.ts',
  timeout: 15 * 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3110',
    viewport: { height: 900, width: 1200 },
  },
  webServer: {
    command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3110',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3110',
  },
  workers: 1,
})
