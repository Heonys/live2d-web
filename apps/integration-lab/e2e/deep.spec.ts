import { expect, test } from '@playwright/test'
import { expectModelReady, expectNoHorizontalOverflow, gotoScenario } from './helpers'

test.describe('browser and input integration', { tag: '@deep' }, () => {
  test('surfaces a missing Core error and retries after the asset returns', async ({ page }) => {
    const corePattern = '**/assets/js/cubism/5.3/live2dcubismcore.min.js'
    await page.route(corePattern, route => route.fulfill({ status: 404 }))
    await gotoScenario(page, '/studio')
    const runtimeError = page.locator('.stage-error')
    await expect(runtimeError).toBeVisible({ timeout: 30_000 })
    await expect(runtimeError).toContainText(/core|script|load/i)

    await page.unroute(corePattern)
    await runtimeError.getByRole('button', { name: 'Retry runtime' }).click()
    await expectModelReady(page, 'studio-status')
  })

  test('recovers a vanilla runtime after a context-loss signal', async ({ page }) => {
    await gotoScenario(page, '/lifecycle')
    await expectModelReady(page, 'lifecycle-status')
    await page.getByRole('button', { name: 'Lose context' }).click()
    await expect(page.getByTestId('lifecycle-result')).toContainText('webglcontextlost dispatched')
    await page.getByRole('button', { name: 'Retry runtime' }).click()
    await expect(page.getByTestId('lifecycle-result')).toContainText('Runtime recreated', { timeout: 45_000 })
    await expect(page.locator('.runtime-stage canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Dispose all' }).click()
    await expect(page.locator('.runtime-stage canvas')).toHaveCount(0)
    const snapshot = await page.evaluate(() => window.__live2dLab?.snapshot())
    expect(snapshot).toMatchObject({ canvases: 0, models: 0, status: 'disposed' })
  })

  test('runs MediaPipe main and Worker on the deterministic portrait', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name.startsWith('mobile'), 'Desktop projects cover the heavy tracking matrix.')
    await gotoScenario(page, '/inputs')
    await expectModelReady(page, 'input-status')

    await page.getByRole('button', { name: 'Run portrait' }).click()
    await expect(page.getByTestId('input-status')).toContainText(/face.*(tracked|lost)/, { timeout: 45_000 })
    await page.getByRole('button', { name: 'Simulate face lost' }).click()
    await expect(page.getByTestId('input-status')).toContainText(/face.*lost/, { timeout: 45_000 })

    await page.getByLabel('Face tracking execution').selectOption('worker')
    await page.getByRole('button', { name: 'Run portrait' }).click()
    await expect(page.getByTestId('input-status')).toContainText(/face.*(tracked|lost|error)/, { timeout: 45_000 })
    const workerStatus = await page.getByTestId('input-status').textContent()
    const snapshot = await page.evaluate(() => window.__live2dLab?.snapshot())
    if (testInfo.project.name === 'firefox' && /face.*error/.test(workerStatus)) {
      testInfo.annotations.push({
        description: 'MediaPipe 1.0.1 Worker WASM loader reports ModuleFactory not set in Firefox.',
        type: 'known-issue',
      })
      await expect(page.getByRole('alert')).toContainText('ModuleFactory not set')
    }
    else {
      expect(workerStatus, snapshot?.errors.join('\n')).toMatch(/face.*(tracked|lost)/)
    }
    await page.getByRole('button', { name: 'Stop tracking' }).click()
    await expect(page.getByTestId('input-status')).toContainText(/face.*disposed/)
  })

  test('restarts fake microphone input without leaving live tracks', async ({ page }, testInfo) => {
    test.skip(testInfo.project.name !== 'chromium', 'Fake media is deterministic in desktop Chromium.')
    await page.addInitScript(() => {
      const original = navigator.mediaDevices.getUserMedia.bind(navigator.mediaDevices)
      const streams: MediaStream[] = []
      Object.defineProperty(window, '__labStreams', { value: streams })
      navigator.mediaDevices.getUserMedia = async (constraints) => {
        const stream = await original(constraints)
        streams.push(stream)
        return stream
      }
    })
    await gotoScenario(page, '/inputs')
    await expectModelReady(page, 'input-status')

    const start = page.getByRole('button', { name: 'Start microphone' })
    const stop = page.getByRole('button', { name: 'Stop microphone' })
    const lipSyncStatus = page.locator('.control-group').filter({ hasText: 'Lip sync input' }).locator('.status-pill')
    await start.click()
    await expect(lipSyncStatus).toHaveText('active')
    await stop.click()
    await expect(lipSyncStatus).toHaveText('idle')
    await start.click()
    await expect(lipSyncStatus).toHaveText('active')
    await stop.click()

    await page.getByRole('button', { name: 'Start camera' }).click()
    await expect(page.getByTestId('input-status')).not.toContainText('requesting', { timeout: 45_000 })
    await page.getByRole('button', { name: 'Stop tracking' }).click()

    const states = await page.evaluate(() => {
      const streams = (window as unknown as { __labStreams: MediaStream[] }).__labStreams
      return streams.flatMap(stream => stream.getTracks().map(track => track.readyState))
    })
    expect(states.length).toBeGreaterThanOrEqual(3)
    expect(states.every(state => state === 'ended')).toBe(true)
  })

  test('isolates the live2d-web and Pixi Core versions', async ({ page }, testInfo) => {
    if (testInfo.project.name !== 'chromium') {
      const errors: string[] = []
      page.on('pageerror', error => errors.push(error.message))
      for (const frame of ['live2d', 'pixi']) {
        await page.goto(`/frames/${frame}.html`)
        await expect(page.locator('canvas')).toHaveCount(1, { timeout: 60_000 })
        await expect(page.locator('html')).toHaveAttribute('data-frame-status', 'ready', { timeout: 60_000 })
      }
      expect(errors).toEqual([])
      return
    }
    await gotoScenario(page, '/compare')
    const live2d = page.locator('[data-backend="live2d-web"]')
    const pixi = page.locator('[data-backend="pixi-v6"]')
    await expect(live2d).toContainText('ready', { timeout: 60_000 })
    await expect(pixi).toContainText('ready', { timeout: 60_000 })
    await expect(page.getByTitle('live2d-web renderer').contentFrame().locator('canvas')).toHaveCount(1)
    await expect(page.getByTitle('Pixi renderer').contentFrame().locator('canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Play both motions' }).click()
    await expect(page.getByTestId('comparison-budget')).toHaveText('pass', { timeout: 30_000 })
  })

  test('supports touch scrolling and portrait-to-landscape layout', async ({ page }, testInfo) => {
    test.skip(!testInfo.project.name.startsWith('mobile'), 'Covered by mobile emulation projects.')
    await gotoScenario(page, '/studio')
    await expectModelReady(page, 'studio-status')
    await expectNoHorizontalOverflow(page)
    await expect(page.locator('.studio-canvas canvas')).toHaveCSS('touch-action', 'pan-y')

    await page.setViewportSize({ height: 430, width: 860 })
    await expectNoHorizontalOverflow(page)
    await page.setViewportSize({ height: 860, width: 430 })
    await expectNoHorizontalOverflow(page)

    const before = await page.evaluate(() => window.scrollY)
    if (testInfo.project.name === 'mobile-webkit')
      await page.evaluate(() => window.scrollBy(0, 700))
    else
      await page.mouse.wheel(0, 700)
    await expect.poll(async () => page.evaluate(() => window.scrollY)).toBeGreaterThan(before)
  })
})
