import { expect, test } from '@playwright/test'
import { expectModelReady, expectNoHorizontalOverflow, gotoScenario } from './helpers'

test.describe('real model integration', { tag: '@smoke' }, () => {
  test('keeps one React canvas while adding, controlling and removing a guest', async ({ page }) => {
    await gotoScenario(page, '/studio')
    await expectModelReady(page, 'studio-status')
    await expect(page.getByText('1 loaded')).toBeVisible()

    await page.getByTestId('toggle-guest').click()
    await expect(page.getByText('2 loaded')).toBeVisible({ timeout: 45_000 })
    await expect(page.locator('.studio-canvas canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Play motion' }).click()
    await expect(page.getByTestId('studio-result')).toContainText('motion', { timeout: 30_000 })
    await page.getByLabel('Placement overlay').check()
    await page.getByLabel('Viewport').selectOption('portrait')
    await expect(page.getByTestId('studio-stage')).toHaveAttribute('data-aspect', 'portrait')
    await page.getByLabel('Broadcast scene').selectOption('game')
    await expect(page.getByTestId('studio-stage')).toHaveAttribute('data-scene', 'game')
    await page.getByLabel('Canvas semantics').selectOption('decorative')
    await expect(page.locator('.studio-canvas canvas')).toHaveAttribute('aria-hidden', 'true')

    await page.getByTestId('toggle-guest').click()
    await expect(page.getByText('1 loaded')).toBeVisible()
    const snapshot = await page.evaluate(() => window.__live2dLab?.snapshot())
    expect(snapshot).toMatchObject({ canvases: 1, models: 1, status: 'ready' })

    await page.locator('.lab-brand').click()
    await expect(page.locator('.scenario-card').filter({ hasText: 'Stream Studio' })).toContainText('disposed')
  })

  test('disposes an individual vanilla model and recreates the runtime', async ({ page }) => {
    await gotoScenario(page, '/lifecycle')
    await expectModelReady(page, 'lifecycle-status')
    await page.getByRole('button', { name: 'Add guest' }).click()
    await expect(page.getByTestId('lifecycle-status')).toContainText('2 models')
    await expect(page.locator('.runtime-stage canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Dispose guest' }).click()
    await expect(page.getByTestId('lifecycle-result')).toContainText('primary model remains')
    await expect(page.getByTestId('lifecycle-status')).toContainText('1 models')
    await expect(page.locator('.runtime-stage canvas')).toHaveCount(1)

    await page.getByTestId('run-cycles').click()
    await expect(page.getByText('Completed cycles').locator('..').locator('strong')).toHaveText('5', { timeout: 60_000 })
    const snapshot = await page.evaluate(() => window.__live2dLab?.snapshot())
    expect(snapshot?.errors).toEqual([])
    expect(snapshot?.canvases).toBe(1)
  })

  test('keeps the OBS page transparent and resizes its canvas', async ({ page }) => {
    await page.goto('/overlay.html?scale=0.7&x=0.05&fps=30')
    await expect(page.locator('canvas')).toHaveCount(1, { timeout: 45_000 })
    const before = await page.locator('canvas').evaluate(canvas => ({
      height: canvas.height,
      width: canvas.width,
    }))
    expect(await page.evaluate(() => getComputedStyle(document.body).backgroundColor)).toBe('rgba(0, 0, 0, 0)')

    await page.setViewportSize({ height: 720, width: 405 })
    await expect.poll(async () => page.locator('canvas').evaluate(canvas => canvas.width)).not.toBe(before.width)
    await expectNoHorizontalOverflow(page)
  })

  test('inspects reserved paths and exposes public load failures', async ({ page }) => {
    await gotoScenario(page, '/assets')
    await expectModelReady(page, 'tools-status')
    await page.getByRole('button', { name: 'CJK + reserved paths' }).click()
    await expect(page.getByTestId('asset-result')).toContainText('reserved:')
    await expect(page.getByTestId('asset-result')).toContainText('테스트 #1')
    await page.getByLabel('Placement overlay').check()
    await page.getByLabel('Mount devtools').check()
    await expect.poll(async () => ({
      errors: await page.evaluate(() => window.__live2dLab?.snapshot().errors ?? []),
      mounted: await page.locator('[data-live2d-devtools]').count(),
    }), { timeout: 30_000 }).toMatchObject({ errors: [], mounted: 1 })
    await page.getByLabel('Mount devtools').uncheck()
    await expect(page.getByTestId('lab-devtools')).toBeHidden()
    await expect(page.locator('.tools-stage canvas')).toHaveCount(1)

    await page.getByRole('button', { name: 'Load 404' }).click()
    await expect.poll(async () => page.evaluate(() => window.__live2dLab?.snapshot().status)).toBe('error')
    const snapshot = await page.evaluate(() => window.__live2dLab?.snapshot())
    expect(snapshot?.status).toBe('error')
    expect(snapshot?.errors.length).toBeGreaterThan(0)
  })
})
