'use client'

import type { Live2DInstance } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/backends/cubism-webgl'
import { useEffect } from 'react'

const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
const MODEL_URL = '/assets/live2d/hiyori/hiyori_free/runtime/hiyori_free_t08.model3.json'

declare global {
  interface Window {
    __live2dWebE2E?: {
      abortLoad: () => Promise<string>
      cycle: (count: number) => Promise<{ canvases: number, mouth: number }>
      expressionFixture: () => Promise<number>
      expressionFadeFixture: () => Promise<{
        defaultAfterInstant: number
        instant: number
        slow: number
      }>
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

    window.__live2dWebE2E = {
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
