import { writeFileSync } from 'node:fs'
import process from 'node:process'
import { expect, test } from '@playwright/test'

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

test('keeps MediaPipe inference and lifecycle stable', async ({ page }) => {
  const minutes = Number(process.env.LIVE2D_TRACKING_SOAK_MINUTES ?? 5)
  const errors: string[] = []
  const heap: number[] = []
  let restarts = 0
  page.on('console', (message) => {
    const isMediaPipeDelegateInfo = message.text().includes(
      'Created TensorFlow Lite XNNPACK delegate for CPU.',
    )
    if (message.type() === 'error' && !isMediaPipeDelegateInfo)
      errors.push(message.text())
  })
  page.on('pageerror', error => errors.push(error.message))
  await page.goto('/tracking-e2e?soak=1')
  await expect(page.getByTestId('tracking-status')).toHaveText('tracked')

  const deadline = Date.now() + minutes * 60_000
  const restartEveryMs = Math.min(
    5 * 60_000,
    Math.max(10_000, minutes * 30_000),
  )
  let nextRestart = Date.now() + restartEveryMs
  while (Date.now() < deadline) {
    const now = Date.now()
    await page.waitForTimeout(Math.min(
      60_000,
      Math.max(1, deadline - now),
      Math.max(1, nextRestart - now),
    ))
    const usedHeap = await page.evaluate(() => {
      const memory = performance as Performance & {
        memory?: { usedJSHeapSize: number }
      }
      return memory.memory?.usedJSHeapSize ?? 0
    })
    if (usedHeap > 0)
      heap.push(usedHeap)
    if (Date.now() >= nextRestart && Date.now() < deadline) {
      await page.getByRole('button', { name: 'Restart' }).click()
      await expect(page.getByTestId('tracking-status')).toHaveText('tracked')
      restarts++
      nextRestart += restartEveryMs
    }
  }

  await page.getByRole('button', { name: 'Dispose' }).click()
  await expect(page.getByTestId('tracking-status')).toHaveText('disposed')
  expect(errors).toEqual([])
  expect(restarts).toBeGreaterThanOrEqual(1)
  if (heap.length >= 5) {
    const stable = median(heap.slice(0, 2))
    const last = median(heap.slice(-2))
    expect(last).toBeLessThanOrEqual(stable * 1.25)
  }
  const artifact = test.info().outputPath('tracking-soak.json')
  writeFileSync(artifact, `${JSON.stringify({ errors, heap, minutes, restarts }, null, 2)}\n`)
  await test.info().attach('tracking-soak.json', {
    contentType: 'application/json',
    path: artifact,
  })
})
