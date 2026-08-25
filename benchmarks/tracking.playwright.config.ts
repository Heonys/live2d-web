import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 180_000 },
  fullyParallel: false,
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    { name: 'firefox', timeout: 300_000, use: { ...devices['Desktop Firefox'], headless: !process.env.CI } },
  ],
  reporter: 'list',
  testDir: '.',
  testMatch: 'tracking.spec.ts',
  timeout: 5 * 60_000,
  use: { baseURL: 'http://127.0.0.1:3112' },
  webServer: {
    command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3112',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3112/benchmark/tracking',
  },
  workers: 1,
})
