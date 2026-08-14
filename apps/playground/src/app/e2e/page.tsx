'use client'

import type { Live2DInstance } from 'live2d-web'
import { createLive2D } from 'live2d-web'
import {
  createCubismWebGLBackend,
  cubismWebGL,
} from 'live2d-web/adapters/cubism-webgl'
import { useEffect } from 'react'

const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
const MODEL_URL = '/assets/live2d/hiyori/hiyori_free_zh/runtime/hiyori_free_t08.model3.json'

declare global {
  interface Window {
    __live2dWebE2E?: {
      abortLoad: () => Promise<string>
      cycle: (count: number) => Promise<{ canvases: number, mouth: number }>
      expressionFixture: () => Promise<number>
      fit: (fit: 'full' | 'upper-body') => void
      focus: (x: number, y: number) => void
      loseContext: () => void
      motion: () => Promise<void>
      multiple: (count: number) => Promise<{ after: number, during: number }>
      parameter: (id: string) => number
      retry: () => Promise<void>
      shaderFailure: () => Promise<{ code: string, message: string }>
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
        const instance = await createLive2D({
          container: host,
          coreUrl: CORE_URL,
          fit: 'full',
          src: '/e2e-expression.model3.json',
        })
        await instance.expression('fixture')
        for (let frame = 0; frame < 30; frame++)
          await nextFrame()
        const value = instance.getParameter('ParamMouthOpenY')
        instance.dispose()
        host.remove()
        return value
      },
      fit: fit => character?.setFit(fit),
      focus: (x, y) => character?.focus(x, y),
      loseContext() {
        container.querySelector('canvas')
          ?.getContext('webgl2')
          ?.getExtension('WEBGL_lose_context')
          ?.loseContext()
      },
      motion: () => character?.motion('Tap@Body', 0) ?? Promise.resolve(),
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
          const failure = error as { code?: string, message?: string }
          return {
            code: failure.code ?? 'unknown',
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
