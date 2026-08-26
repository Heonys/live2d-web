import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: { timeout: 45_000 },
  fullyParallel: false,
  preserveOutput: 'always',
  projects: [
    { name: 'chromium', use: { ...devices['Desktop Chrome'] } },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    // Firefox infers an order of magnitude slower; give WASM startup room.
    { name: 'firefox', timeout: 240_000, use: { ...devices['Desktop Firefox'], headless: !process.env.CI } },
  ],
  // The github reporter turns failures into check-run annotations, which are
  // readable without a token when the run's log is not.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  testDir: './e2e/tracking',
  timeout: 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3102',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: {
    command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3102',
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3102/tracking-e2e',
  },
})
