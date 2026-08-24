import { readFileSync } from 'node:fs'
import { expect, test } from '@playwright/test'

const expressionModel = readFileSync(
  new URL('./fixtures/cubism-webgl/hiyori-expression.model3.json', import.meta.url),
  'utf8',
)
const mouthExpression = readFileSync(
  new URL('./fixtures/cubism-webgl/mouth-open.exp3.json', import.meta.url),
  'utf8',
)
const motionModel = readFileSync(
  new URL('./fixtures/cubism-webgl/hiyori-motion.model3.json', import.meta.url),
  'utf8',
)
const fadeMotion = readFileSync(
  new URL('./fixtures/cubism-webgl/fade.motion3.json', import.meta.url),
  'utf8',
)
const fadeNegativeMotion = readFileSync(
  new URL('./fixtures/cubism-webgl/fade-negative.motion3.json', import.meta.url),
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

// PIXI destroys and loses every context, but Playwright WebKit defers removing
// rapidly replaced contexts from its per-page budget. Keep 20 cycles while
// filtering only the resulting engine diagnostics; all other errors still fail.
const WEBKIT_CONTEXT_CHURN_MESSAGES = [
  'There are too many active WebGL contexts on this page',
  'INVALID_OPERATION: loseContext: context already lost',
]

function actionableWebGLErrors(browserName: string, errors: string[]) {
  return errors.filter(message =>
    browserName !== 'webkit'
    || !WEBKIT_CONTEXT_CHURN_MESSAGES.some(fragment => message.includes(fragment)),
  )
}

test('preloads Cubism Core from the server-rendered HTML', async ({ page }) => {
  // The runtime injects the Core script after hydration, so without this link
  // the preload scanner never sees it. React hoists the tag into <head>, which
  // only works while the call sits outside a subtree that opts out of SSR.
  const html = await (await page.request.get('/')).text()
  const preloadIndex = html.indexOf('/assets/js/cubism/5.3/live2dcubismcore.min.js')

  expect(html).toContain('rel="preload"')
  expect(preloadIndex).toBeGreaterThan(-1)
  expect(preloadIndex).toBeLessThan(html.indexOf('</head>'))
})

test('loads Hiyori and survives repeated mount/unmount', async ({ browserName, page }) => {
  const unexpectedErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      unexpectedErrors.push(message.text())
  })

  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  await expect(page.locator('[data-live2d-canvas] canvas')).toHaveCount(1)

  // The page warms the model assets while Cubism Core loads. The runtime's own
  // request has to reuse that entry: a mismatch would download the 2.7MB
  // texture twice, which is the failure mode the plain fetch() warm-up avoids.
  // Chromium only: WebKit reports the full body size even for a cache hit, so
  // there the metric cannot tell a reused entry from a second download.
  if (browserName === 'chromium') {
    const textureBytes = await page.evaluate(() => performance.getEntriesByType('resource')
      .filter(entry => entry.name.includes('texture_00.png'))
      .reduce((total, entry) => total + (entry as PerformanceResourceTiming).transferSize, 0))
    expect(textureBytes).toBeLessThan(3_200_000)
  }

  const desktopBufferPixels = await page.locator('[data-live2d-canvas] canvas').evaluate(
    element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height,
  )
  expect(desktopBufferPixels).toBeLessThanOrEqual(4_000_000)

  await page.getByLabel('Framing').selectOption('full')
  const mouthSlider = page.locator('input[type="range"]')
  await mouthSlider.fill('0.8')
  await expect(mouthSlider).toHaveValue('0.8')

  // The mount/unmount QA buttons live in the collapsed developer tools.
  await page.getByText('Developer tools').click()
  await page.getByLabel('Motion fade').selectOption('500')
  await page.getByRole('button', { name: 'Play motion' }).click()
  await expect(page.getByTestId('playing-motion')).toBeVisible()
  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: 'Unmount canvas' }).click()
    await expect(page.locator('[data-live2d-canvas] canvas')).toHaveCount(0)
    await page.getByRole('button', { name: 'Mount canvas' }).click()
    await expect(page.getByTestId('stage-status')).toContainText('ready')
    await expect(page.locator('[data-live2d-canvas] canvas')).toHaveCount(1)
  }

  await page.getByRole('button', { name: 'Play sequence' }).click()
  await expect(page.getByTestId('playing-motion')).toContainText('sequence')
  await page.getByRole('button', { name: 'Unmount canvas' }).click()
  await expect(page.getByTestId('motion-result')).toContainText('disposed')
  await page.getByRole('button', { name: 'Mount canvas' }).click()
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  await page.getByLabel('Idle selection').selectOption('first')
  await page.getByLabel('Expression fade').selectOption('500')
  await page.waitForTimeout(250)
  await expect(page.getByTestId('stage-status')).toContainText('ready')

  expect(actionableWebGLErrors(browserName, unexpectedErrors)).toEqual([])
})

test('runs the vanilla API and disposes every canvas', async ({ browserName, page }) => {
  const unexpectedErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      unexpectedErrors.push(message.text())
  })

  await page.goto('/vanilla')
  await expect(page.getByTestId('vanilla-status')).toContainText('ready')
  await expect(page.locator('.runtime-host canvas')).toHaveCount(1)

  await page.getByLabel('Framing').selectOption('full')
  await page.locator('input[type="range"]').fill('0.7')
  await page.getByRole('button', { name: 'Play Tap@Body' }).click()

  for (let index = 0; index < 20; index++) {
    await page.getByRole('button', { name: 'Dispose runtime' }).click()
    await expect(page.locator('.runtime-host canvas')).toHaveCount(0)
    await expect(page.getByTestId('vanilla-status')).toContainText('disposed')
    await page.getByRole('button', { name: 'Create runtime' }).click()
    await expect(page.getByTestId('vanilla-status')).toContainText('ready')
    await expect(page.locator('.runtime-host canvas')).toHaveCount(1)
  }

  expect(actionableWebGLErrors(browserName, unexpectedErrors)).toEqual([])
})

test('runs from a consumer app with no React dependency', async ({ page }) => {
  const unexpectedErrors: string[] = []
  page.on('pageerror', error => unexpectedErrors.push(error.message))
  await page.goto('http://127.0.0.1:3101')
  await expect(page.locator('#status')).toHaveText('ready')
  await expect(page.locator('#character canvas')).toHaveCount(1)
  await page.getByRole('button', { name: 'Play Tap@Body' }).click()
  await page.getByRole('button', { name: 'Dispose' }).click()
  await expect(page.locator('#status')).toHaveText('disposed')
  await expect(page.locator('#character canvas')).toHaveCount(0)
  await page.waitForTimeout(250)
  expect(unexpectedErrors).toEqual([])
})

test('obeys the mobile backing-buffer policy', async ({ page }) => {
  await page.setViewportSize({ height: 844, width: 390 })
  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')

  const diagnostics = await page.getByTestId('stage-status').textContent()
  expect(diagnostics).toContain('DPR')
  expect(diagnostics).toContain('MP')
  const canvas = page.locator('[data-live2d-canvas] canvas')
  await expect(canvas).toHaveCount(1)
  const bufferPixels = await canvas.evaluate(
    element => (element as HTMLCanvasElement).width * (element as HTMLCanvasElement).height,
  )
  expect(bufferPixels).toBeLessThanOrEqual(1_500_000)
})

test('inspects a model URL and cleans the previous canvas on replacement', async ({ page }) => {
  await page.goto('/inspect')
  await expect(page.getByTestId('inspector-status')).toContainText('ready')
  const canvas = page.locator('[data-live2d-canvas] canvas')
  await expect(canvas).toHaveCount(1)

  await page.getByLabel('Framing').selectOption('full')
  await page.getByLabel('Resolution').selectOption('2')
  await expect(page.getByTestId('inspector-status')).toContainText('ready')
  await expect.poll(async () => canvas.evaluate((element) => {
    const htmlCanvas = element as HTMLCanvasElement
    const rect = htmlCanvas.getBoundingClientRect()
    return htmlCanvas.width / rect.width
  })).toBeCloseTo(2, 1)

  await page.getByRole('button', { name: 'Play motion' }).click()
  await page.getByLabel('Parameter value').fill('0.65')
  await page.getByRole('button', { name: 'Set parameter' }).click()
  await expect(page.getByTestId('parameter-readback')).toContainText('0.650')
  await page.getByTestId('inspector-stage').hover({ position: { x: 450, y: 200 } })

  await page.getByLabel('model3.json URL').fill('/assets/live2d/missing.model3.json')
  await page.getByRole('button', { name: 'Load model' }).click()
  await expect(page.locator('.error-details').first()).toContainText('model3')
  await expect(page.locator('.error-details').first()).toContainText('404')
  await expect(page.locator('.error-details').first()).toContainText(
    '/assets/live2d/missing.model3.json',
  )
  await expect(canvas).toHaveCount(0)
})

test('runs and cleans up the source AudioWorklet smoke test', async ({ browserName, page }) => {
  test.skip(
    browserName === 'firefox',
    'wlipsync 1.3 AudioWorklet currently throws inside Firefox; driver/value lip-sync remains supported.',
  )
  const unexpectedErrors: string[] = []
  page.on('console', (message) => {
    if (message.type() === 'error')
      unexpectedErrors.push(message.text())
  })
  await page.addInitScript(() => {
    const metrics = { connects: 0, disconnects: 0 }
    const state = window as typeof window & {
      __lipSyncWorkletMetrics: typeof metrics
    }
    state.__lipSyncWorkletMetrics = metrics
    const originalConnect = AudioNode.prototype.connect
    const originalDisconnect = AudioNode.prototype.disconnect
    Object.defineProperty(AudioNode.prototype, 'connect', {
      configurable: true,
      value(this: AudioNode, ...args: unknown[]) {
        if (
          typeof AudioWorkletNode !== 'undefined'
          && args[0] instanceof AudioWorkletNode
        ) {
          metrics.connects++
        }
        return Reflect.apply(originalConnect, this, args)
      },
      writable: true,
    })
    Object.defineProperty(AudioNode.prototype, 'disconnect', {
      configurable: true,
      value(this: AudioNode, ...args: unknown[]) {
        if (
          typeof AudioWorkletNode !== 'undefined'
          && args[0] instanceof AudioWorkletNode
        ) {
          metrics.disconnects++
        }
        return Reflect.apply(originalDisconnect, this, args)
      },
      writable: true,
    })
  })

  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  const supported = await page.evaluate(() =>
    typeof AudioContext !== 'undefined'
    && 'audioWorklet' in AudioContext.prototype,
  )
  test.skip(!supported, 'AudioWorklet is unavailable in this browser.')

  await page.getByText('Developer tools').click()
  await page.getByLabel('Lip-sync mode').selectOption('source')
  await page.getByRole('button', { name: 'Start test signal' }).click()
  await expect(page.getByTestId('lipsync-status')).toHaveText('source active')
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & {
      __lipSyncWorkletMetrics: { connects: number }
    }).__lipSyncWorkletMetrics.connects,
  )).toBe(1)
  await expect(page.getByTestId('lipsync-status')).toHaveText('source active')

  await page.getByRole('button', { name: 'Stop test signal' }).click()
  await expect(page.getByTestId('lipsync-status')).toHaveText('source idle')
  expect(await page.evaluate(() =>
    (window as typeof window & {
      __lipSyncWorkletMetrics: { disconnects: number }
    }).__lipSyncWorkletMetrics.disconnects,
  )).toBe(0)
  await page.getByRole('button', { name: 'Unmount canvas' }).click()
  await expect(page.locator('[data-live2d-canvas] canvas')).toHaveCount(0)
  await expect.poll(() => page.evaluate(() =>
    (window as typeof window & {
      __lipSyncWorkletMetrics: { disconnects: number }
    }).__lipSyncWorkletMetrics.disconnects,
  )).toBe(1)
  expect(unexpectedErrors).toEqual([])
})

test('surfaces WebGL context loss and recreates the stage', async ({ page, browserName }) => {
  await page.goto('/')
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  const supported = await page.locator('[data-live2d-canvas] canvas').evaluate((canvas, useExtension) => {
    if (!useExtension) {
      canvas.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))
      return true
    }
    const gl = (canvas as HTMLCanvasElement).getContext('webgl')
      ?? (canvas as HTMLCanvasElement).getContext('webgl2')
    const extension = gl?.getExtension('WEBGL_lose_context')
    extension?.loseContext()
    return Boolean(extension)
  }, browserName === 'chromium')
  test.skip(!supported, 'WEBGL_lose_context is unavailable in this runtime.')

  await expect(page.locator('.error-panel')).toContainText('render-error')
  await page.getByRole('button', { name: 'Retry canvas' }).click()
  await expect(page.getByTestId('stage-status')).toContainText('ready')
  await expect(page.locator('[data-live2d-canvas] canvas')).toHaveCount(1)
})

test('settles pending and later motions when the context is lost', async ({ page }) => {
  await page.goto('/e2e')
  await expect(page.locator('#e2e-status')).toHaveText('ready')

  // The frame loop never restarts after a render error, so a motion that waits
  // for playback to finish has to be rejected rather than left pending.
  const settlements = await page.evaluate(
    () => (window as any).__live2dWebE2E.motionDuringContextLoss(),
  )
  expect(settlements.pending).toBe('render-error')
  expect(settlements.started).toBe('render-error')
})

test('covers the integrated Framework adapter lifecycle and lazy assets', async ({ browserName, page }) => {
  const unexpectedErrors: string[] = []
  page.on('console', (message) => {
    const sourceUrl = message.location().url
    const isExpectedAssetFailure = sourceUrl.includes('/motion/hiyori_m07.motion3.json')
      || sourceUrl.includes('/missing-live2d-shaders/')
    if (message.type() === 'error' && !isExpectedAssetFailure)
      unexpectedErrors.push(message.text())
  })
  page.on('pageerror', error => unexpectedErrors.push(error.message))
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
  await page.route('**/e2e-motion.model3.json', route => route.fulfill({
    body: motionModel,
    contentType: 'application/json',
  }))
  await page.route('**/e2e-fixtures/fade.motion3.json', route => route.fulfill({
    body: fadeMotion,
    contentType: 'application/json',
  }))
  await page.route('**/e2e-fixtures/fade-negative.motion3.json', route => route.fulfill({
    body: fadeNegativeMotion,
    contentType: 'application/json',
  }))

  await page.goto('/e2e')
  await expect(page.locator('#e2e-status')).toHaveText('ready')

  // hitTest takes viewport client coordinates: points over the character
  // report hit areas while points outside the canvas report none.
  const hits = await page.evaluate(() => {
    const rect = document.querySelector('#e2e-character')!.getBoundingClientRect()
    const bridge = (window as any).__live2dWebE2E
    const probes = [0.3, 0.5, 0.7].flatMap(ratio => bridge.hitTest(
      rect.left + rect.width / 2,
      rect.top + rect.height * ratio,
    ))
    return {
      outside: bridge.hitTest(rect.left - 40, rect.top - 40),
      probes,
    }
  })
  expect(hits.probes.length).toBeGreaterThan(0)
  expect(hits.outside).toEqual([])

  await page.route('**/motion/hiyori_m07.motion3.json', route => route.fulfill({
    body: 'temporary failure',
    status: 500,
  }), { times: 1 })
  const motionFailure = await page.evaluate(() => (window as any).__live2dWebE2E.motion())
  expect(motionFailure).toMatchObject({
    code: 'model-load-failed',
    details: {
      assetType: 'motion',
      backend: 'cubism-webgl',
      httpStatus: 500,
    },
  })
  expect(motionFailure.details.url).toContain('/motion/hiyori_m07.motion3.json')
  await page.evaluate(() => (window as any).__live2dWebE2E.motion())

  const cycles = await page.evaluate(() => (window as any).__live2dWebE2E.cycle(20))
  expect(cycles.canvases).toBe(1)
  expect(cycles.mouth).toBeCloseTo(0.5, 1)

  await page.evaluate(() => (window as any).__live2dWebE2E.focus(600, 300))
  await expect.poll(async () => Math.abs(await page.evaluate(
    () => (window as any).__live2dWebE2E.parameter('ParamAngleX'),
  ))).toBeGreaterThan(0.1)

  expect(await page.evaluate(() => (window as any).__live2dWebE2E.multiple(2))).toEqual({
    after: 0,
    during: 2,
  })
  await expect(page.locator('#e2e-character canvas')).toHaveCount(1)
  expect(await page.evaluate(() => (window as any).__live2dWebE2E.abortLoad()))
    .toBe('AbortError')
  expect(await page.evaluate(() => (window as any).__live2dWebE2E.expressionFixture()))
    .toBeGreaterThan(0.1)

  const expressionFade = await page.evaluate(
    () => (window as any).__live2dWebE2E.expressionFadeFixture(),
  )
  expect(expressionFade.instant).toBeGreaterThan(expressionFade.slow + 5)
  expect(expressionFade.defaultAfterInstant).toBeLessThan(expressionFade.instant - 5)

  const idleWeight = await page.evaluate(
    () => (window as any).__live2dWebE2E.idleWeightFixture(),
  )
  expect(idleWeight.firstOnly).toBeGreaterThan(5)
  expect(idleWeight.canvases).toBe(0)

  const fade = await page.evaluate(
    () => (window as any).__live2dWebE2E.motionFadeFixture(),
  )
  expect(fade.instant).toBeGreaterThan(fade.slow + 5)
  expect(fade.parameterFade).toBeGreaterThan(fade.slow + 5)
  expect(fade.defaultAfterInstant).toBeLessThan(fade.instant - 5)

  expect(await page.evaluate(
    () => (window as any).__live2dWebE2E.motionStateFixture(),
  )).toEqual({
    completed: 'completed',
    disposed: 'disposed',
    interrupted: 'interrupted',
    skipped: 'skipped',
  })
  expect(await page.evaluate(
    () => (window as any).__live2dWebE2E.motionSequenceFixture(),
  )).toEqual({
    completed: { completedSteps: 2, status: 'completed' },
    interrupted: { completedSteps: 0, status: 'interrupted', stepIndex: 0 },
  })

  await page.evaluate(() => (window as any).__live2dWebE2E.loseContext())
  await expect.poll(async () => page.evaluate(
    () => (window as any).__live2dWebE2E.state()?.status,
  )).toBe('error')
  expect(await page.evaluate(
    () => (window as any).__live2dWebE2E.state()?.error?.details,
  )).toEqual({ backend: 'cubism-webgl' })
  await page.evaluate(() => (window as any).__live2dWebE2E.retry())
  await expect.poll(async () => page.evaluate(
    () => (window as any).__live2dWebE2E.state()?.status,
  )).toBe('ready')

  const shaderFailure = await page.evaluate(
    () => (window as any).__live2dWebE2E.shaderFailure(),
  )
  expect(shaderFailure.code).toBe('render-error')
  expect(shaderFailure.message).toContain('HTTP 404')
  expect(shaderFailure.details).toMatchObject({
    assetType: 'shader',
    backend: 'cubism-webgl',
    httpStatus: 404,
  })
  expect(shaderFailure.details.url).toContain('/missing-live2d-shaders/')
  await expect(page.locator('#e2e-character canvas')).toHaveCount(0)
  await page.evaluate(() => (window as any).__live2dWebE2E.start())
  await expect(page.locator('#e2e-status')).toHaveText('ready')

  expect(actionableWebGLErrors(browserName, unexpectedErrors)).toEqual([])
})
