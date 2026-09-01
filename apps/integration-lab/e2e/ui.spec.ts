import AxeBuilder from '@axe-core/playwright'
import { expect, test } from '@playwright/test'
import { expectNoHorizontalOverflow } from './helpers'

test.describe('assetless consumer shell', { tag: '@ui' }, () => {
  test('shows the selected package source and routes without licensed assets', async ({ page }) => {
    await page.route('**/assets/live2d/hiyori/manifest.json', route => route.fulfill({ status: 404 }))
    await page.goto('/')

    const expected = process.env.LIVE2D_LAB_SOURCE === 'release' ? 'npm 0.9.0' : 'local source'
    await expect(page.getByTestId('package-source')).toHaveText(expected)
    await expect(page.locator('.source-badge')).toHaveText(expected)
    await expect(page.getByRole('heading', { name: 'v0.9 consumer lab' })).toBeVisible()

    await page.getByRole('link', { exact: true, name: 'Studio' }).click()
    await expect(page.getByRole('heading', { name: 'Stream Studio' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Demo assets unavailable')

    await page.getByRole('link', { exact: true, name: 'Lifecycle' }).click()
    await expect(page.getByRole('heading', { name: 'Runtime Lifecycle' })).toBeVisible()
    await expect(page.getByRole('alert')).toContainText('Demo assets unavailable')
  })

  test('has an accessible dashboard and mobile-safe navigation', async ({ page }, testInfo) => {
    await page.route('**/assets/**', route => route.fulfill({ status: 404 }))
    await page.goto('/')
    const results = await new AxeBuilder({ page }).analyze()
    expect(results.violations).toEqual([])

    if (testInfo.project.name.startsWith('mobile')) {
      await expectNoHorizontalOverflow(page)
      await page.getByRole('link', { exact: true, name: 'Assets' }).click()
      await expect(page.getByRole('heading', { name: 'Assets & Tools' })).toBeVisible()
      await expectNoHorizontalOverflow(page)
    }
  })
})
