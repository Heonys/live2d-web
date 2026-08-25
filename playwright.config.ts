import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

export default defineConfig({
  expect: {
    timeout: 15_000,
  },
  fullyParallel: false,
  projects: [
    {
      name: 'chromium',
      use: { ...devices['Desktop Chrome'] },
    },
    {
      name: 'webkit',
      use: { ...devices['Desktop Safari'] },
    },
    {
      name: 'firefox',
      // Headless Firefox on the Linux runner has no WebGL2 even with
      // webgl.force-enabled (tried 2026-08-25). CI runs it headed under Xvfb,
      // where Mesa's software GL is available.
      use: { ...devices['Desktop Firefox'], headless: !process.env.CI },
    },
  ],
  // The github reporter turns failures into check-run annotations, which are
  // readable without a token when the run's log is not.
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  testDir: './e2e',
  testIgnore: ['soak.spec.ts', 'tracking/**', 'tracking-soak/**'],
  timeout: 60_000,
  use: {
    baseURL: 'http://127.0.0.1:3100',
    screenshot: 'only-on-failure',
    trace: 'retain-on-failure',
  },
  webServer: [
    {
      command: 'pnpm -F @live2d-web/playground start --hostname 127.0.0.1 --port 3100',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: 'http://127.0.0.1:3100',
    },
    {
      command: 'pnpm -F @live2d-web/vanilla-consumer dev --host 127.0.0.1 --port 3101',
      reuseExistingServer: !process.env.CI,
      timeout: 120_000,
      url: 'http://127.0.0.1:3101',
    },
  ],
})
