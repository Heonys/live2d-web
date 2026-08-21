import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 15_000 },
  projects: [{ name: 'chromium', use: { ...devices['Desktop Chrome'] } }],
  reporter: 'list',
  testDir: './e2e',
  testMatch: 'soak.spec.ts',
  timeout: (Number(process.env.LIVE2D_SOAK_MINUTES ?? 120) + 5) * 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3100',
    reuseExistingServer: false,
    timeout: 120_000,
    url: 'http://127.0.0.1:3100',
  },
})
