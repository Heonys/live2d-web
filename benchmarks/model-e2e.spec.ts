import type { ConsoleMessage } from '@playwright/test'
import { expect, test } from '@playwright/test'
import {
  assertReleased,
  dispose,
  exercise,
  openBenchmark,
  snapshot,
} from './lib/page'

const models = ['mark', 'hiyori', 'mao', 'rice', 'ren']

for (const model of models) {
  for (const resolution of [1, 2]) {
    test(`${model} renders and exercises at resolution ${resolution}`, async ({ page }) => {
      const consoleErrors: string[] = []
      page.on('console', (message: ConsoleMessage) => {
        if (message.type() === 'error')
          consoleErrors.push(message.text())
      })
      await openBenchmark(page, { model, resolution, stageCount: 1 })
      await exercise(page)
      await page.evaluate(() => {
        const host = document.querySelector<HTMLElement>('.benchmark-stage')!
        host.style.width = '540px'
        host.style.height = '480px'
      })
      await page.waitForTimeout(250)
      const canvas = page.locator('.benchmark-stage canvas')
      await expect(canvas).toHaveCount(1)
      await expect.poll(async () => canvas.evaluate(element => ({
        height: (element as HTMLCanvasElement).height,
        width: (element as HTMLCanvasElement).width,
      }))).toEqual({ height: 480 * resolution, width: 540 * resolution })

      const active = await snapshot(page)
      expect(active.diagnostics.stages[0].firstDrawMs).not.toBeNull()
      expect(active.diagnostics.stages[0].frame.coreUpdate.length).toBeGreaterThan(0)
      expect(active.diagnostics.stages[0].frame.drawCpu.length).toBeGreaterThan(0)
      expect(active.model.expected.motionGroups[active.model.motion.group]).toBeGreaterThan(0)
      if (active.model.expected.hasPhysics || active.model.expected.hasPose) {
        expect(active.diagnostics.stages[0].frame.effectsPhysicsPose.length)
          .toBeGreaterThan(0)
      }
      assertReleased(await dispose(page))
      expect(consoleErrors).toEqual([])
    })
  }
}
