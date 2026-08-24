import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const minutes = Number(process.env.LIVE2D_TRACKING_SOAK_MINUTES ?? 5)

export default defineConfig({
  expect: { timeout: 60_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  preserveOutput: 'always',
  reporter: 'list',
  testDir: './e2e/tracking-soak',
  timeout: Math.max(1, minutes) * 60_000 + 120_000,
  use: {
    baseURL: 'http://127.0.0.1:3103',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3103',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3103/tracking-e2e',
  },
})
