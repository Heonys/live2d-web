import process from 'node:process'
import { defineConfig, devices } from '@playwright/test'

const source = process.env.LIVE2D_LAB_SOURCE === 'release' ? 'release' : 'local'
const suite = process.env.LIVE2D_LAB_SUITE ?? 'deep'
const grep = suite === 'ui'
  ? /@ui/
  : suite === 'smoke'
    ? /@(ui|smoke)/
    : suite === 'soak'
      ? /@soak/
      : /@(ui|smoke|deep)/

export default defineConfig({
  expect: { timeout: 20_000 },
  fullyParallel: false,
  grep,
  outputDir: 'test-results/integration-lab',
  // WebGL contexts and MediaPipe WASM are the subjects under test. Keeping the
  // browser matrix bounded avoids turning host GPU contention into false failures.
  workers: process.env.CI ? 1 : 2,
  projects: [
    {
      name: 'chromium',
      use: {
        ...devices['Desktop Chrome'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
    { name: 'webkit', use: { ...devices['Desktop Safari'] } },
    {
      name: 'firefox',
      use: {
        ...devices['Desktop Firefox'],
        headless: !process.env.CI,
      },
    },
    {
      name: 'mobile-chromium',
      use: {
        ...devices['Pixel 7'],
        launchOptions: {
          args: [
            '--use-fake-device-for-media-stream',
            '--use-fake-ui-for-media-stream',
          ],
        },
      },
    },
    { name: 'mobile-webkit', use: { ...devices['iPhone 14'] } },
  ],
  reporter: process.env.CI ? [['list'], ['github']] : 'list',
  testDir: './apps/integration-lab/e2e',
  timeout: suite === 'soak' ? 35 * 60_000 : 90_000,
  use: {
    baseURL: 'http://127.0.0.1:3120',
    screenshot: process.env.CI ? 'off' : 'only-on-failure',
    trace: process.env.CI ? 'off' : 'retain-on-failure',
    video: 'off',
  },
  webServer: {
    command: `pnpm -F @live2d-web/integration-lab ${source === 'release' ? 'dev' : 'dev:local'} --host 127.0.0.1 --port 3120`,
    reuseExistingServer: !process.env.CI,
    timeout: 120_000,
    url: 'http://127.0.0.1:3120',
  },
})
