'use client'

import type {
  ExpressionOptions,
  IdleMotion,
  Live2DInstance,
  MotionOptions,
} from 'live2d-web'
import { createLive2D } from 'live2d-web'
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/backends/cubism-webgl'
import { useEffect } from 'react'

const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
const MODEL_URL = '/assets/live2d/hiyori/hiyori_free/runtime/hiyori_free_t08.model3.json'
const TRACE_PARAMETERS = [
  'ParamAngleX',
  'ParamAngleY',
  'ParamAngleZ',
  'ParamBodyAngleX',
  'ParamEyeBallX',
  'ParamEyeBallY',
  'ParamMouthForm',
] as const

interface ParameterSample {
  frame: number
  values: Record<string, number>
}

interface HiyoriMotionQualityResult {
  default: ParameterSample[]
  defaultAfterInstant: ParameterSample[]
  instant: ParameterSample[]
  repeatedInstant: ParameterSample[]
  slow: ParameterSample[]
  cleanupCanvases: number[]
  statuses: string[]
}

interface HiyoriSequenceQualityResult {
  completed: { completedSteps: number, status: string }
  interrupted: { completedSteps: number, status: string, stepIndex?: number }
  interruptedLoadedTapBody: boolean
}

interface HiyoriIdleQualityResult {
  cleanupCanvases: number[]
  distanceToFirst: number
  distanceToSecond: number
  distanceToThird: number
  firstOnly: ParameterSample[]
}

interface ExpressionQualityResult {
  default: ParameterSample[]
  instant: ParameterSample[]
  replacement: ParameterSample[]
  slow: ParameterSample[]
  cleanupCanvases: number[]
}

declare global {
  interface Window {
    __live2dWebE2E?: {
      abortLoad: () => Promise<string>
      multiModelFixture: () => Promise<{
        canvases: number
        leftPixels: number
        rightPixels: number
        afterDisposeLeft: number
        afterDisposeRight: number
      }>
      cycle: (count: number) => Promise<{ canvases: number, mouth: number }>
      expressionFixture: () => Promise<number>
      expressionFadeFixture: () => Promise<{
        defaultAfterInstant: number
        instant: number
        slow: number
      }>
      expressionQualityFixture: () => Promise<ExpressionQualityResult>
      motionFadeFixture: () => Promise<{
        defaultAfterInstant: number
        instant: number
        parameterFade: number
        slow: number
      }>
      motionStateFixture: () => Promise<{
        completed: string
        disposed: string
        interrupted: string
        skipped: string
      }>
      motionSequenceFixture: () => Promise<{
        completed: { completedSteps: number, status: string }
        interrupted: { completedSteps: number, status: string, stepIndex?: number }
      }>
      fit: (fit: 'full' | 'upper-body') => void
      focus: (x: number, y: number) => void
      hitTest: (x: number, y: number) => string[]
      hiyoriIdleQuality: () => Promise<HiyoriIdleQualityResult>
      hiyoriMotionQuality: () => Promise<HiyoriMotionQualityResult>
      hiyoriSequenceQuality: () => Promise<HiyoriSequenceQualityResult>
      idleWeightFixture: () => Promise<{ canvases: number, firstOnly: number }>
      loseContext: () => void
      motion: () => Promise<{
        code: string
        details?: {
          assetType?: string
          backend?: string
          httpStatus?: number
          url?: string
        }
        message: string
      } | undefined>
      motionDuringContextLoss: () => Promise<{ pending: string, started: string }>
      motionPlaying: () => boolean
      multiple: (count: number) => Promise<{ after: number, during: number }>
      parameter: (id: string) => number
      retry: () => Promise<void>
      shaderFailure: () => Promise<{
        code: string
        details?: {
          assetType?: string
          backend?: string
          httpStatus?: number
          url?: string
        }
        message: string
      }>
      soakFixtureCycle: () => Promise<{ canvases: number, finite: boolean }>
      soakMotion: (fadeMs?: number) => Promise<string>
      soakSequence: () => Promise<{ completedSteps: number, status: string }>
      start: () => Promise<void>
      state: () => ReturnType<Live2DInstance['getState']> | undefined
      stop: () => void
    }
  }
}

function nextFrame() {
  return new Promise<void>(resolve => requestAnimationFrame(() => resolve()))
}

export default function E2EHarness() {
  useEffect(() => {
    const container = document.querySelector<HTMLElement>('#e2e-character')!
    const status = document.querySelector<HTMLOutputElement>('#e2e-status')!
    let character: Live2DInstance | undefined

    const stop = () => {
      character?.dispose()
      character = undefined
      status.value = 'disposed'
    }
    const start = async () => {
      stop()
      status.value = 'loading'
      character = await createLive2D({
        container,
        coreUrl: CORE_URL,
        fit: 'full',
        quality: 'auto',
        src: MODEL_URL,
      })
      status.value = 'ready'
    }

    const createFixture = async ({
      idleMotion,
      src = MODEL_URL,
    }: {
      idleMotion?: IdleMotion
      src?: string
    } = {}) => {
      const host = document.createElement('div')
      host.style.height = '640px'
      host.style.width = '480px'
      document.body.appendChild(host)
      try {
        const instance = await createLive2D({
          container: host,
          coreUrl: CORE_URL,
          fit: 'full',
          ...(idleMotion !== undefined ? { idleMotion } : {}),
          pauseWhenOffscreen: false,
          src,
        })
        return { host, instance }
      }
      catch (error) {
        host.remove()
        throw error
      }
    }

    const waitForMotionStart = async (instance: Live2DInstance) => {
      for (let frame = 0; frame < 180; frame++) {
        if (instance.isMotionPlaying())
          return
        await nextFrame()
      }
      throw new Error('Motion did not start within 180 animation frames.')
    }

    const sampleParameters = async (
      instance: Live2DInstance,
      frames: number,
    ): Promise<ParameterSample[]> => {
      const samples: ParameterSample[] = []
      for (let frame = 0; frame < frames; frame++) {
        await nextFrame()
        const values: Record<string, number> = {}
        for (const id of TRACE_PARAMETERS)
          values[id] = instance.getParameter(id)
        samples.push({ frame, values })
      }
      return samples
    }

    const releaseFixture = async ({
      host,
      instance,
    }: {
      host: HTMLElement
      instance: Live2DInstance
    }) => {
      instance.dispose()
      await nextFrame()
      const canvases = host.querySelectorAll('canvas').length
      host.remove()
      return canvases
    }

    const traceDistance = (
      left: readonly ParameterSample[],
      right: readonly ParameterSample[],
    ) => {
      let distance = 0
      let values = 0
      for (let frame = 0; frame < Math.min(left.length, right.length); frame++) {
        for (const id of TRACE_PARAMETERS) {
          const difference = left[frame].values[id] - right[frame].values[id]
          distance += difference * difference
          values++
        }
      }
      return Math.sqrt(distance / Math.max(1, values))
    }

    window.__live2dWebE2E = {
      // Two models on one canvas is a rendering claim, and a fake GL cannot
      // check it. This draws one model left and one right, then reads the
      // backing buffer: both halves must have opaque pixels, and removing the
      // right model must leave the left one drawing.
      async multiModelFixture() {
        const host = document.createElement('div')
        host.style.height = '640px'
        host.style.width = '640px'
        host.style.position = 'fixed'
        host.style.top = '0'
        host.style.left = '0'
        document.body.appendChild(host)
        const instance = await createLive2D({
          container: host,
          coreUrl: CORE_URL,
          fit: { offsetX: -0.25, scale: 0.5, units: 'stage' },
          // The host sits below the fold, and an offscreen pause would stop the
          // loop before anything reached the buffer.
          pauseWhenOffscreen: false,
          resolution: 1,
          src: MODEL_URL,
        })
        try {
          // A different model file, so a shared-asset bug cannot hide behind
          // two loads of the same one.
          const right = await instance.addModel({
            fit: { offsetX: 0.25, scale: 0.5, units: 'stage' },
            src: '/assets/live2d/mark/Mark.model3.json',
          })
          const canvas = host.querySelector('canvas')!
          const gl = canvas.getContext('webgl2')!
          const opaquePixels = (fromX: number) => {
            // Cubism leaves its 256x256 mask framebuffer bound after a draw
            // that used one. The stage rebinds the default buffer before it
            // clears, so rendering is fine, but a reader outside the frame has
            // to rebind or it samples the mask instead of the canvas.
            gl.bindFramebuffer(gl.FRAMEBUFFER, null)
            const width = Math.floor(canvas.width / 2)
            const buffer = new Uint8Array(width * canvas.height * 4)
            gl.readPixels(fromX, 0, width, canvas.height, gl.RGBA, gl.UNSIGNED_BYTE, buffer)
            let count = 0
            for (let index = 3; index < buffer.length; index += 4) {
              if (buffer[index] > 16)
                count++
            }
            return count
          }
          // The default framebuffer is cleared after compositing, so the read
          // has to happen inside the frame that drew, not after awaiting one.
          const readHalves = () => new Promise<{ left: number, right: number }>((resolve) => {
            requestAnimationFrame(() => {
              requestAnimationFrame(() => {
                resolve({
                  left: opaquePixels(0),
                  right: opaquePixels(Math.floor(canvas.width / 2)),
                })
              })
            })
          })
          const both = await readHalves()
          right.dispose()
          const afterDispose = await readHalves()
          return {
            afterDisposeLeft: afterDispose.left,
            afterDisposeRight: afterDispose.right,
            canvases: host.querySelectorAll('canvas').length,
            leftPixels: both.left,
            rightPixels: both.right,
          }
        }
        finally {
          instance.dispose()
          host.remove()
        }
      },
      async abortLoad() {
        const host = document.createElement('div')
        host.style.height = '320px'
        host.style.width = '240px'
        document.body.appendChild(host)
        const controller = new AbortController()
        let enteredLoad!: () => void
        const loadStarted = new Promise<void>((resolve) => {
          enteredLoad = resolve
        })
        const loading = createLive2D({
          backend: {
            ...cubismWebGL,
            loadModel(stage, url, options) {
              enteredLoad()
              return cubismWebGL.loadModel(stage, url, options)
            },
          },
          container: host,
          coreUrl: CORE_URL,
          signal: controller.signal,
          src: MODEL_URL,
        })
        await loadStarted
        controller.abort(new DOMException('E2E abort', 'AbortError'))
        let name = 'missing-error'
        try {
          await loading
        }
        catch (error) {
          name = error instanceof Error ? error.name : String(error)
        }
        const canvases = host.querySelectorAll('canvas').length
        host.remove()
        if (canvases !== 0)
          throw new Error('Aborted runtime retained a Canvas.')
        return name
      },
      async cycle(count) {
        for (let index = 0; index < count; index++) {
          stop()
          await nextFrame()
          if (container.querySelectorAll('canvas').length !== 0)
            throw new Error(`Cycle ${index} retained a Canvas.`)
          await start()
        }
        character?.setParameter('ParamMouthOpenY', 0.5)
        await nextFrame()
        await nextFrame()
        return {
          canvases: container.querySelectorAll('canvas').length,
          mouth: character?.getParameter('ParamMouthOpenY') ?? -1,
        }
      },
      async expressionFixture() {
        const host = document.createElement('div')
        host.style.height = '320px'
        host.style.width = '240px'
        document.body.appendChild(host)
        // The fixture host sits below the fold, so keep rendering while
        // offscreen for this measurement.
        const instance = await createLive2D({
          container: host,
          coreUrl: CORE_URL,
          fit: 'full',
          pauseWhenOffscreen: false,
          src: '/e2e-expression.model3.json',
        })
        await instance.expression('fixture')
        for (let frame = 0; frame < 60; frame++)
          await nextFrame()
        const value = instance.getParameter('ParamMouthOpenY')
        instance.dispose()
        host.remove()
        return value
      },
      async expressionFadeFixture() {
        const createFixture = async () => {
          const host = document.createElement('div')
          host.style.height = '320px'
          host.style.width = '240px'
          document.body.appendChild(host)
          const instance = await createLive2D({
            container: host,
            coreUrl: CORE_URL,
            fit: 'full',
            idleMotion: false,
            pauseWhenOffscreen: false,
            src: '/e2e-expression.model3.json',
          })
          return { host, instance }
        }
        const sample = async (fadeInMs: number) => {
          const { host, instance } = await createFixture()
          await instance.expression('positive', { fadeInMs })
          await nextFrame()
          const value = instance.getParameter('ParamAngleX')
          instance.dispose()
          host.remove()
          return value
        }
        const instant = await sample(0)
        const slow = await sample(1_000)

        const { host, instance } = await createFixture()
        await instance.expression('positive', { fadeInMs: 0 })
        await nextFrame()
        instance.clearExpression()
        await nextFrame()
        await instance.expression('positive')
        await nextFrame()
        const defaultAfterInstant = instance.getParameter('ParamAngleX')
        instance.dispose()
        host.remove()
        return { defaultAfterInstant, instant, slow }
      },
      async expressionQualityFixture() {
        const cleanupCanvases: number[] = []
        const capture = async (options?: ExpressionOptions) => {
          const fixture = await createFixture({
            idleMotion: false,
            src: '/e2e-expression.model3.json',
          })
          await fixture.instance.expression('positive', options)
          const samples = await sampleParameters(fixture.instance, 36)
          cleanupCanvases.push(await releaseFixture(fixture))
          return samples
        }

        const defaultSamples = await capture()
        const instant = await capture({ fadeInMs: 0, fadeOutMs: 0 })
        const slow = await capture({ fadeInMs: 500, fadeOutMs: 500 })

        const replacementFixture = await createFixture({
          idleMotion: false,
          src: '/e2e-expression.model3.json',
        })
        await replacementFixture.instance.expression('positive', {
          fadeInMs: 0,
          fadeOutMs: 500,
        })
        await sampleParameters(replacementFixture.instance, 12)
        await replacementFixture.instance.expression('negative', {
          fadeInMs: 500,
        })
        const replacement = await sampleParameters(replacementFixture.instance, 36)
        cleanupCanvases.push(await releaseFixture(replacementFixture))

        return {
          cleanupCanvases,
          default: defaultSamples,
          instant,
          replacement,
          slow,
        }
      },
      async motionFadeFixture() {
        const createFixture = async () => {
          const host = document.createElement('div')
          host.style.height = '320px'
          host.style.width = '240px'
          document.body.appendChild(host)
          const instance = await createLive2D({
            container: host,
            coreUrl: CORE_URL,
            fit: 'full',
            idleMotion: false,
            pauseWhenOffscreen: false,
            src: '/e2e-motion.model3.json',
          })
          return { host, instance }
        }
        const sample = async (fadeInMs: number) => {
          const { host, instance } = await createFixture()
          const playback = instance.motion('Fade', 0, { fadeInMs })
          while (!instance.isMotionPlaying())
            await nextFrame()
          await nextFrame()
          const values = {
            parameter: instance.getParameter('ParamAngleY'),
            value: instance.getParameter('ParamAngleX'),
          }
          instance.dispose()
          await playback
          host.remove()
          return values
        }

        const instant = await sample(0)
        const slow = await sample(2_000)

        // Reuse one model to prove an override did not mutate the default
        // parsed cache object used by the next playback.
        const { host, instance } = await createFixture()
        await instance.motion('Fade', 0, { fadeInMs: 0 })
        const defaultPlayback = instance.motion('Fade', 0)
        while (!instance.isMotionPlaying())
          await nextFrame()
        await nextFrame()
        const defaultAfterInstant = instance.getParameter('ParamAngleX')
        instance.dispose()
        await defaultPlayback
        host.remove()

        return {
          defaultAfterInstant,
          instant: instant.value,
          parameterFade: slow.parameter,
          slow: slow.value,
        }
      },
      async motionStateFixture() {
        const createFixture = async () => {
          const host = document.createElement('div')
          host.style.height = '320px'
          host.style.width = '240px'
          document.body.appendChild(host)
          const instance = await createLive2D({
            container: host,
            coreUrl: CORE_URL,
            fit: 'full',
            idleMotion: false,
            pauseWhenOffscreen: false,
            src: '/e2e-motion.model3.json',
          })
          return { host, instance }
        }

        const natural = await createFixture()
        const completed = await natural.instance.playMotion('Fade', 0, {
          fadeInMs: 0,
          fadeOutMs: 0,
        })
        natural.instance.dispose()
        natural.host.remove()

        const replaced = await createFixture()
        const first = replaced.instance.playMotion('Fade', 0, { fadeOutMs: 0 })
        while (!replaced.instance.isMotionPlaying())
          await nextFrame()
        const replacement = replaced.instance.playMotion('Fade', 1, { fadeInMs: 0 })
        const interrupted = await first
        replaced.instance.dispose()
        await replacement
        replaced.host.remove()

        const denied = await createFixture()
        const force = denied.instance.playMotion('Fade', 0)
        while (!denied.instance.isMotionPlaying())
          await nextFrame()
        const skipped = await denied.instance.playMotion('Fade', 1, { priority: 'idle' })
        denied.instance.dispose()
        await force
        denied.host.remove()

        const tornDown = await createFixture()
        const active = tornDown.instance.playMotion('Fade', 0)
        while (!tornDown.instance.isMotionPlaying())
          await nextFrame()
        tornDown.instance.dispose()
        const disposed = await active
        tornDown.host.remove()

        return {
          completed: completed.status,
          disposed: disposed.status,
          interrupted: interrupted.status,
          skipped: skipped.status,
        }
      },
      async motionSequenceFixture() {
        const createFixture = async () => {
          const host = document.createElement('div')
          host.style.height = '320px'
          host.style.width = '240px'
          document.body.appendChild(host)
          const instance = await createLive2D({
            container: host,
            coreUrl: CORE_URL,
            fit: 'full',
            idleMotion: false,
            pauseWhenOffscreen: false,
            src: '/e2e-motion.model3.json',
          })
          return { host, instance }
        }
        const steps = [
          { group: 'Fade', index: 0, options: { fadeInMs: 0, fadeOutMs: 0 } },
          { group: 'Fade', index: 1, options: { fadeInMs: 0, fadeOutMs: 0 } },
        ] as const

        const full = await createFixture()
        const completed = await full.instance.sequence(steps)
        full.instance.dispose()
        full.host.remove()

        const stopped = await createFixture()
        const sequence = stopped.instance.sequence(steps)
        while (!stopped.instance.isMotionPlaying())
          await nextFrame()
        const external = stopped.instance.playMotion('Fade', 1, {
          fadeInMs: 0,
          fadeOutMs: 0,
        })
        const interrupted = await sequence
        stopped.instance.dispose()
        await external
        stopped.host.remove()

        return { completed, interrupted }
      },
      fit: fit => character?.setFit(fit),
      focus: (x, y) => character?.focus(x, y),
      hitTest: (x, y) => character?.hitTest(x, y) ?? [],
      async hiyoriIdleQuality() {
        const cleanupCanvases: number[] = []
        const capture = async (index: number | 'first-only') => {
          const fixture = await createFixture({
            idleMotion: index === 'first-only'
              ? { group: 'Idle', weights: [1, 0, 0] }
              : false,
          })
          const playback = typeof index === 'number'
            ? fixture.instance.playMotion('Idle', index, { priority: 'idle' })
            : undefined
          await waitForMotionStart(fixture.instance)
          const samples = await sampleParameters(fixture.instance, 60)
          cleanupCanvases.push(await releaseFixture(fixture))
          await playback
          return samples
        }

        const firstOnly = await capture('first-only')
        const first = await capture(0)
        const second = await capture(1)
        const third = await capture(2)
        return {
          cleanupCanvases,
          distanceToFirst: traceDistance(firstOnly, first),
          distanceToSecond: traceDistance(firstOnly, second),
          distanceToThird: traceDistance(firstOnly, third),
          firstOnly,
        }
      },
      async hiyoriMotionQuality() {
        const cleanupCanvases: number[] = []
        const statuses: string[] = []
        const capture = async (options?: MotionOptions) => {
          const fixture = await createFixture({ idleMotion: false })
          const playback = fixture.instance.playMotion('Tap@Body', 0, options)
          await waitForMotionStart(fixture.instance)
          const samples = await sampleParameters(fixture.instance, 48)
          statuses.push((await playback).status)
          cleanupCanvases.push(await releaseFixture(fixture))
          return samples
        }

        const defaultSamples = await capture()
        const instant = await capture({ fadeInMs: 0, fadeOutMs: 0 })
        const repeatedInstant = await capture({ fadeInMs: 0, fadeOutMs: 0 })
        const slow = await capture({ fadeInMs: 500, fadeOutMs: 500 })

        const cacheFixture = await createFixture({ idleMotion: false })
        await cacheFixture.instance.playMotion('Tap@Body', 0, {
          fadeInMs: 0,
          fadeOutMs: 0,
        })
        const defaultPlayback = cacheFixture.instance.playMotion('Tap@Body', 0)
        await waitForMotionStart(cacheFixture.instance)
        const defaultAfterInstant = await sampleParameters(cacheFixture.instance, 48)
        statuses.push((await defaultPlayback).status)
        cleanupCanvases.push(await releaseFixture(cacheFixture))
        return {
          cleanupCanvases,
          default: defaultSamples,
          defaultAfterInstant,
          instant,
          repeatedInstant,
          slow,
          statuses,
        }
      },
      async hiyoriSequenceQuality() {
        const steps = [
          {
            group: 'Tap',
            index: 0,
            options: { fadeInMs: 0, fadeOutMs: 0 },
          },
          {
            group: 'Tap@Body',
            index: 0,
            options: { fadeInMs: 0, fadeOutMs: 0 },
          },
        ] as const
        const full = await createFixture({ idleMotion: false })
        const completed = await full.instance.sequence(steps)
        if (await releaseFixture(full) !== 0)
          throw new Error('Completed Hiyori sequence retained a Canvas.')

        const stopped = await createFixture({ idleMotion: false })
        const requested: string[] = []
        const originalFetch = window.fetch
        window.fetch = async (input, init) => {
          requested.push(
            typeof input === 'string'
              ? input
              : input instanceof URL
                ? input.href
                : input.url,
          )
          return originalFetch(input, init)
        }
        let interrupted: HiyoriSequenceQualityResult['interrupted']
        try {
          const sequence = stopped.instance.sequence(steps)
          await waitForMotionStart(stopped.instance)
          const external = stopped.instance.playMotion('FlickDown', 0, {
            fadeInMs: 0,
            fadeOutMs: 0,
          })
          interrupted = await sequence
          stopped.instance.dispose()
          await external
          await nextFrame()
          if (stopped.host.querySelectorAll('canvas').length !== 0)
            throw new Error('Interrupted Hiyori sequence retained a Canvas.')
        }
        finally {
          window.fetch = originalFetch
          if (stopped.host.isConnected) {
            await nextFrame()
            stopped.host.remove()
          }
        }

        return {
          completed,
          interrupted,
          interruptedLoadedTapBody: requested.some(url =>
            url.includes('hiyori_m07.motion3.json')),
        }
      },
      async idleWeightFixture() {
        const host = document.createElement('div')
        host.style.height = '320px'
        host.style.width = '240px'
        document.body.appendChild(host)
        const instance = await createLive2D({
          container: host,
          coreUrl: CORE_URL,
          fit: 'full',
          idleMotion: { group: 'Fade', weights: [1, 0] },
          pauseWhenOffscreen: false,
          src: '/e2e-motion.model3.json',
        })
        while (!instance.isMotionPlaying())
          await nextFrame()
        for (let frame = 0; frame < 20; frame++)
          await nextFrame()
        const firstOnly = instance.getParameter('ParamAngleX')
        instance.dispose()
        await nextFrame()
        const canvases = host.querySelectorAll('canvas').length
        host.remove()
        return { canvases, firstOnly }
      },
      loseContext() {
        container.querySelector('canvas')
          ?.getContext('webgl2')
          ?.getExtension('WEBGL_lose_context')
          ?.loseContext()
      },
      async motion() {
        try {
          await character?.motion('Tap@Body', 0)
          return undefined
        }
        catch (error) {
          const failure = error as {
            code?: string
            details?: {
              assetType?: string
              backend?: string
              httpStatus?: number
              url?: string
            }
            message?: string
          }
          return {
            code: failure.code ?? 'unknown',
            details: failure.details,
            message: failure.message ?? String(error),
          }
        }
      },
      async motionDuringContextLoss() {
        const settle = async (promise: Promise<void> | undefined) => {
          let timeout: ReturnType<typeof setTimeout> | undefined
          try {
            return await Promise.race([
              (promise ?? Promise.resolve())
                .then(() => 'resolved')
                .catch((error: { code?: string }) => error.code ?? 'unknown'),
              new Promise<string>((resolve) => {
                timeout = setTimeout(resolve, 2_000, 'hung')
              }),
            ])
          }
          finally {
            if (timeout)
              clearTimeout(timeout)
          }
        }

        const pending = settle(character?.motion('Tap@Body', 0))
        await nextFrame()
        const canvas = container.querySelector('canvas')
        const extension = canvas?.getContext('webgl2')?.getExtension('WEBGL_lose_context')
        if (extension)
          extension.loseContext()
        else
          canvas?.dispatchEvent(new Event('webglcontextlost', { cancelable: true }))

        return {
          pending: await pending,
          started: await settle(character?.motion('Tap@Body', 0)),
        }
      },
      motionPlaying: () => character?.isMotionPlaying() ?? false,
      async multiple(count) {
        const hosts: HTMLElement[] = []
        const instances: Live2DInstance[] = []
        let after = 0
        let during = 0
        try {
          for (let index = 0; index < count; index++) {
            const host = document.createElement('div')
            host.style.height = '320px'
            host.style.width = '240px'
            document.body.appendChild(host)
            hosts.push(host)
            instances.push(await createLive2D({
              container: host,
              coreUrl: CORE_URL,
              fit: 'full',
              src: MODEL_URL,
            }))
          }
          during = hosts.reduce(
            (total, host) => total + host.querySelectorAll('canvas').length,
            0,
          )
        }
        finally {
          for (const instance of instances.reverse())
            instance.dispose()
          after = hosts.reduce(
            (total, host) => total + host.querySelectorAll('canvas').length,
            0,
          )
          for (const host of hosts)
            host.remove()
        }
        return { after, during }
      },
      parameter: id => character?.getParameter(id) ?? Number.NaN,
      retry: () => character?.retry() ?? Promise.resolve(),
      async shaderFailure() {
        stop()
        try {
          await createLive2D({
            backend: createCubismWebGLBackend({
              shaderBaseUrl: '/missing-live2d-shaders/',
            }),
            container,
            coreUrl: CORE_URL,
            src: MODEL_URL,
          })
          throw new Error('Expected shader loading to fail.')
        }
        catch (error) {
          const failure = error as {
            code?: string
            details?: {
              assetType?: string
              backend?: string
              httpStatus?: number
              url?: string
            }
            message?: string
          }
          return {
            code: failure.code ?? 'unknown',
            details: failure.details,
            message: failure.message ?? String(error),
          }
        }
      },
      async soakFixtureCycle() {
        let finite = true
        const idle = await createFixture({
          idleMotion: { group: 'Idle', weights: [1, 0, 0] },
        })
        await waitForMotionStart(idle.instance)
        const idleSamples = await sampleParameters(idle.instance, 12)
        finite &&= idleSamples.every(sample =>
          Object.values(sample.values).every(Number.isFinite))
        await releaseFixture(idle)

        const expression = await createFixture({
          idleMotion: false,
          src: '/e2e-expression.model3.json',
        })
        await expression.instance.expression('positive', {
          fadeInMs: 0,
          fadeOutMs: 500,
        })
        await sampleParameters(expression.instance, 12)
        await expression.instance.expression('negative', { fadeInMs: 500 })
        const expressionSamples = await sampleParameters(expression.instance, 12)
        finite &&= expressionSamples.every(sample =>
          Object.values(sample.values).every(Number.isFinite))
        await releaseFixture(expression)

        return {
          canvases: document.querySelectorAll('#e2e-character canvas').length,
          finite,
        }
      },
      async soakMotion(fadeMs) {
        if (!character)
          throw new Error('The soak runtime is not ready.')
        const options = fadeMs === undefined
          ? undefined
          : { fadeInMs: fadeMs, fadeOutMs: fadeMs }
        return (await character.playMotion('Tap@Body', 0, options)).status
      },
      async soakSequence() {
        if (!character)
          throw new Error('The soak runtime is not ready.')
        return character.sequence([
          {
            group: 'Tap',
            index: 0,
            options: { fadeInMs: 0, fadeOutMs: 0 },
          },
          {
            group: 'Tap@Body',
            index: 0,
            options: { fadeInMs: 500, fadeOutMs: 500 },
          },
        ])
      },
      start,
      state: () => character?.getState(),
      stop,
    }

    void start().catch((error: unknown) => {
      status.value = error instanceof Error ? error.message : String(error)
    })
    return () => {
      stop()
      delete window.__live2dWebE2E
    }
  }, [])

  return (
    <main>
      <output id="e2e-status">loading</output>
      <div id="e2e-character" className="stage-shell" />
    </main>
  )
}
