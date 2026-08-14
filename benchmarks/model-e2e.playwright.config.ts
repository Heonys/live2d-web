import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 30_000 },
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
  ],
  reporter: 'list',
  testDir: '.',
  testMatch: 'model-e2e.spec.ts',
  timeout: 90_000,
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
