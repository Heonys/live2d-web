import { Buffer } from 'node:buffer'
import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test } from '@playwright/test'

function median(values: readonly number[]) {
  const sorted = [...values].sort((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

// Both execution modes soak by default: main is what consumers get without
// asking and worker is the 0.6 path, and covering only one hid the other's
// leaks. The minute budget is split across modes so the wall-clock cost of a
// run does not change with the mode list.
const modes = (process.env.LIVE2D_TRACKING_SOAK_MODES ?? 'main,worker')
  .split(',')
  .map(mode => mode.trim())
  .filter((mode): mode is 'main' | 'worker' => mode === 'main' || mode === 'worker')

const totalMinutes = Number(process.env.LIVE2D_TRACKING_SOAK_MINUTES ?? 5)
const minutesPerMode = totalMinutes / Math.max(1, modes.length)

for (const execution of modes) {
  test(`keeps ${execution} MediaPipe inference and lifecycle stable`, async ({ page }, testInfo) => {
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
    await page.goto(`/tracking-e2e?execution=${execution}&soak=1`)
    await expect(page.getByTestId('tracking-status')).toHaveText('tracked')

    const deadline = Date.now() + minutesPerMode * 60_000
    const restartEveryMs = Math.min(
      5 * 60_000,
      Math.max(10_000, minutesPerMode * 30_000),
    )
    // At least six samples fit into any duration, so the heap assertion below
    // can be unconditional; at a fixed 60s cadence it silently never ran in
    // the release job's short soak.
    const sampleEveryMs = Math.max(1_000, Math.min(20_000, minutesPerMode * 10_000))
    let nextRestart = Date.now() + restartEveryMs
    while (Date.now() < deadline) {
      const now = Date.now()
      await page.waitForTimeout(Math.min(
        sampleEveryMs,
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

    // A weekly failure with no record is undebuggable; the summary rides the
    // report even on success.
    const summaryPath = testInfo.outputPath(`tracking-soak-${execution}.json`)
    await writeFile(summaryPath, Buffer.from(JSON.stringify({
      configuredTotalMinutes: totalMinutes,
      errors,
      execution,
      heapMiB: heap.map(bytes => Number((bytes / 1024 / 1024).toFixed(2))),
      modeCount: modes.length,
      minutes: minutesPerMode,
      minutesPerMode,
      restarts,
    }, null, 2)))
    await testInfo.attach(`tracking-soak-${execution}`, {
      contentType: 'application/json',
      path: summaryPath,
    })

    expect(errors).toEqual([])
    expect(restarts).toBeGreaterThanOrEqual(1)
    expect(heap.length).toBeGreaterThanOrEqual(5)
    const stable = median(heap.slice(0, 2))
    const last = median(heap.slice(-2))
    expect(last).toBeLessThanOrEqual(stable * 1.25)
  })
}
