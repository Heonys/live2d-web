import type { Page } from '@playwright/test'
import { expect } from '@playwright/test'

export async function gotoScenario(page: Page, route: string) {
  await page.goto(`/#${route}`)
  await expect(page.locator('.source-badge')).toBeVisible()
}

export async function expectNoHorizontalOverflow(page: Page) {
  const dimensions = await page.evaluate(() => ({
    clientWidth: document.documentElement.clientWidth,
    scrollWidth: document.documentElement.scrollWidth,
  }))
  expect(dimensions.scrollWidth).toBeLessThanOrEqual(dimensions.clientWidth + 1)
}

export async function expectModelReady(page: Page, testId: string) {
  const status = page.getByTestId(testId)
  await expect(status.locator('b')).toHaveText('ready', { timeout: 45_000 })
  await expect(page.locator('canvas')).toHaveCount(1)
}
