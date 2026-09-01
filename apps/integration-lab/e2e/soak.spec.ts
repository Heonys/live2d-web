import { writeFile } from 'node:fs/promises'
import process from 'node:process'
import { expect, test } from '@playwright/test'
import { expectModelReady, gotoScenario } from './helpers'

function median(values: number[]) {
  const sorted = values.toSorted((left, right) => left - right)
  return sorted[Math.floor(sorted.length / 2)] ?? 0
}

test('repeats combined lifecycle work without sustained heap growth', { tag: '@soak' }, async ({ page }, testInfo) => {
  test.skip(testInfo.project.name !== 'chromium', 'Heap measurement uses the Chromium DevTools protocol.')
  const durationMs = Number(process.env.LIVE2D_LAB_SOAK_MINUTES ?? 30) * 60_000
  const session = await page.context().newCDPSession(page)
  await session.send('Performance.enable')

  await gotoScenario(page, '/lifecycle')
  await expectModelReady(page, 'lifecycle-status')

  const measureHeap = async () => {
    await session.send('HeapProfiler.collectGarbage')
    const usage = await session.send('Runtime.getHeapUsage') as { usedSize: number }
    return usage.usedSize
  }
  const baseline: number[] = []
  const final: number[] = []
  const startedAt = Date.now()
  let iterations = 0

  while (Date.now() - startedAt < durationMs) {
    await page.evaluate(() => window.__live2dLab?.runLifecycleCycle(2))
    await page.getByRole('button', { name: 'Add guest' }).click()
    await expect(page.getByTestId('lifecycle-status')).toContainText('2 models')
    await page.getByRole('button', { name: 'Dispose guest' }).click()
    await page.setViewportSize(iterations % 2
      ? { height: 720, width: 1280 }
      : { height: 900, width: 1440 })
    iterations += 1
    if (iterations <= 5)
      baseline.push(await measureHeap())
    if (Date.now() - startedAt > durationMs * 0.8)
      final.push(await measureHeap())
  }

  while (final.length < 5)
    final.push(await measureHeap())
  const baselineMedian = median(baseline)
  const finalMedian = median(final)
  const growth = baselineMedian > 0 ? (finalMedian - baselineMedian) / baselineMedian : 0
  const snapshot = await page.evaluate(() => window.__live2dLab?.snapshot())
  const result = {
    browser: testInfo.project.name,
    durationMs: Date.now() - startedAt,
    heap: { baselineMedian, finalMedian, growth },
    iterations,
    package: snapshot ? { source: snapshot.source, version: snapshot.version } : null,
    runtime: {
      canvases: snapshot?.canvases,
      consoleErrors: snapshot?.consoleErrors.length,
      errors: snapshot?.errors.length,
      models: snapshot?.models,
    },
  }
  await writeFile(testInfo.outputPath('soak-result.json'), JSON.stringify(result, null, 2))

  expect(snapshot?.canvases).toBe(1)
  expect(snapshot?.errors).toEqual([])
  expect(growth).toBeLessThanOrEqual(0.1)
})
