import { Buffer } from 'node:buffer'
import { readFileSync } from 'node:fs'
import { writeFile } from 'node:fs/promises'
import { expect, test } from '@playwright/test'

const expressionModel = readFileSync(
  new URL('./fixtures/cubism-webgl/hiyori-expression.model3.json', import.meta.url),
  'utf8',
)
const mouthExpression = readFileSync(
  new URL('./fixtures/cubism-webgl/mouth-open.exp3.json', import.meta.url),
  'utf8',
)
const positiveExpression = readFileSync(
  new URL('./fixtures/cubism-webgl/angle-positive.exp3.json', import.meta.url),
  'utf8',
)
const negativeExpression = readFileSync(
  new URL('./fixtures/cubism-webgl/angle-negative.exp3.json', import.meta.url),
  'utf8',
)

interface ParameterSample {
  frame: number
  values: Record<string, number>
}

function everyValueIsFinite(samples: readonly ParameterSample[]) {
  return samples.every(sample =>
    Object.values(sample.values).every(Number.isFinite))
}

function traceEnergy(samples: readonly ParameterSample[]) {
  const selected = samples.slice(12, 36)
  const total = selected.reduce((sum, sample) => sum
    + Math.abs(sample.values.ParamAngleX ?? 0)
    + Math.abs(sample.values.ParamAngleY ?? 0)
    + Math.abs(sample.values.ParamAngleZ ?? 0)
    + Math.abs(sample.values.ParamBodyAngleX ?? 0), 0)
  return total / Math.max(1, selected.length)
}

// Largest gap between two samples across the parameters both carry.
function sampleDistance(a: ParameterSample, b: ParameterSample) {
  let maximum = 0
  for (const [id, value] of Object.entries(a.values)) {
    if (id in b.values)
      maximum = Math.max(maximum, Math.abs(value - b.values[id]))
  }
  return maximum
}

function maxFrameDelta(samples: readonly ParameterSample[]) {
  let maximum = 0
  for (let frame = 1; frame < samples.length; frame++) {
    for (const [id, value] of Object.entries(samples[frame].values)) {
      maximum = Math.max(
        maximum,
        Math.abs(value - (samples[frame - 1].values[id] ?? value)),
      )
    }
  }
  return maximum
}

async function waitFrames(page: import('@playwright/test').Page, frames: number) {
  await page.evaluate(async (count) => {
    for (let frame = 0; frame < count; frame++)
      await new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
  }, frames)
}

test('records and validates the Hiyori 0.4 quality candidate', async ({
  baseURL,
  browser,
  browserName,
}, testInfo) => {
  test.skip(browserName !== 'chromium', 'Visual evidence is recorded once in Chromium.')
  test.setTimeout(180_000)
  const context = await browser.newContext({
    recordVideo: { dir: testInfo.outputPath('video') },
    viewport: { height: 900, width: 1_440 },
  })
  const page = await context.newPage()
  const video = page.video()
  try {
    await page.route('**/e2e-expression.model3.json', route => route.fulfill({
      body: expressionModel,
      contentType: 'application/json',
    }))
    await page.route('**/e2e-fixtures/mouth-open.exp3.json', route => route.fulfill({
      body: mouthExpression,
      contentType: 'application/json',
    }))
    await page.route('**/e2e-fixtures/angle-positive.exp3.json', route => route.fulfill({
      body: positiveExpression,
      contentType: 'application/json',
    }))
    await page.route('**/e2e-fixtures/angle-negative.exp3.json', route => route.fulfill({
      body: negativeExpression,
      contentType: 'application/json',
    }))

    await page.goto(`${baseURL}/`)
    await expect(page.getByTestId('stage-status')).toContainText('ready')
    await page.getByText('Developer tools').click()
    await page.getByLabel('Motion', { exact: true }).selectOption('Tap@Body:0')
    const motionScreenshots: Buffer[] = []
    for (const preset of ['model', 'instant', '500'] as const) {
      await page.getByLabel('Motion fade').selectOption(preset)
      await page.getByRole('button', { name: 'Play motion' }).click()
      await expect(page.getByTestId('playing-motion')).toBeVisible()
      await waitFrames(page, 18)
      const screenshotPath = testInfo.outputPath(`hiyori-motion-${preset}.png`)
      const screenshot = await page.locator('[data-live2d-canvas] canvas').screenshot({
        path: screenshotPath,
      })
      expect(screenshot.byteLength).toBeGreaterThan(1_000)
      motionScreenshots.push(screenshot)
      await testInfo.attach(`hiyori-motion-${preset}`, {
        contentType: 'image/png',
        path: screenshotPath,
      })
      await expect(page.getByRole('button', { name: 'Play motion' })).toBeEnabled()
      await expect(page.getByTestId('motion-result')).toContainText('completed')
    }
    expect(motionScreenshots[0].equals(motionScreenshots[1])).toBe(false)
    expect(motionScreenshots[1].equals(motionScreenshots[2])).toBe(false)

    await page.goto(`${baseURL}/e2e`)
    await expect(page.locator('#e2e-status')).toHaveText('ready')
    const quality = await page.evaluate(async () => {
      const bridge = (window as any).__live2dWebE2E
      return {
        expression: await bridge.expressionQualityFixture(),
        idle: await bridge.hiyoriIdleQuality(),
        motion: await bridge.hiyoriMotionQuality(),
        sequence: await bridge.hiyoriSequenceQuality(),
      }
    })
    const tracesPath = testInfo.outputPath('hiyori-parameter-traces.json')
    await writeFile(tracesPath, Buffer.from(JSON.stringify(quality, null, 2)))
    await testInfo.attach('hiyori-parameter-traces', {
      contentType: 'application/json',
      path: tracesPath,
    })

    expect(quality.motion.cleanupCanvases).toEqual([0, 0, 0, 0, 0])
    expect(quality.motion.statuses).toEqual([
      'completed',
      'completed',
      'completed',
      'completed',
      'completed',
    ])
    for (const samples of [
      quality.motion.default,
      quality.motion.defaultAfterInstant,
      quality.motion.instant,
      quality.motion.repeatedInstant,
      quality.motion.slow,
    ]) {
      expect(everyValueIsFinite(samples)).toBe(true)
      expect(maxFrameDelta(samples)).toBeLessThan(50)
    }
    expect(traceEnergy(quality.motion.default)).toBeGreaterThan(5)
    expect(traceEnergy(quality.motion.instant)).toBeGreaterThan(5)
    expect(traceEnergy(quality.motion.slow)).toBeGreaterThan(5)
    expect(traceEnergy(quality.motion.repeatedInstant)).toBeGreaterThan(5)
    expect(traceEnergy(quality.motion.defaultAfterInstant)).toBeGreaterThan(5)
    // Same motion, so the only difference between the authored fade-in and an
    // explicit 0 is the fade itself. Recorded traces put the gap around 7 on
    // ParamAngleY while the curve ramps; ignoring the override collapses it to
    // ~0.001. (500ms lands near Hiyori's authored fade, so it cannot serve here.)
    const fadeGap = Math.max(...quality.motion.instant.slice(0, 36).map((sample, frame) =>
      sampleDistance(sample, quality.motion.default[frame])))
    expect(fadeGap).toBeGreaterThan(3)

    expect(quality.sequence.completed).toEqual({
      completedSteps: 2,
      status: 'completed',
    })
    expect(quality.sequence.interrupted).toEqual({
      completedSteps: 0,
      status: 'interrupted',
      stepIndex: 0,
    })
    expect(quality.sequence.interruptedLoadedTapBody).toBe(false)

    expect(quality.idle.cleanupCanvases).toEqual([0, 0, 0, 0])
    expect(everyValueIsFinite(quality.idle.firstOnly)).toBe(true)
    expect(quality.idle.distanceToFirst).toBeLessThan(quality.idle.distanceToSecond)
    expect(quality.idle.distanceToFirst).toBeLessThan(quality.idle.distanceToThird)

    expect(quality.expression.cleanupCanvases).toEqual([0, 0, 0, 0])
    for (const samples of [
      quality.expression.default,
      quality.expression.instant,
      quality.expression.replacement,
      quality.expression.slow,
    ]) {
      expect(everyValueIsFinite(samples)).toBe(true)
      expect(maxFrameDelta(samples)).toBeLessThan(50)
    }
    expect(quality.expression.instant[0].values.ParamAngleX)
      .toBeGreaterThan((quality.expression.slow[0].values.ParamAngleX ?? 0) + 10)
  }
  finally {
    await context.close()
    if (video) {
      await testInfo.attach('hiyori-quality-video', {
        contentType: 'video/webm',
        path: await video.path(),
      })
    }
  }
})
