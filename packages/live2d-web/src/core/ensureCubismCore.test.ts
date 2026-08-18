// @vitest-environment jsdom

import { afterEach, describe, expect, it, vi } from 'vitest'
import { ensureCubismCore } from './ensureCubismCore'

describe('ensureCubismCore', () => {
  afterEach(() => {
    delete window.Live2DCubismCore
    document.querySelectorAll('script[data-live2d-web-core]').forEach(script => script.remove())
    vi.unstubAllGlobals()
  })

  it('passes when the global is already available', async () => {
    window.Live2DCubismCore = {}
    await expect(ensureCubismCore()).resolves.toBeUndefined()
  })

  it('surfaces a helpful core-missing error without a URL', async () => {
    await expect(ensureCubismCore()).rejects.toMatchObject({
      code: 'core-missing',
      details: { assetType: 'core' },
    })
    await expect(ensureCubismCore()).rejects.toThrow('live2d.com')
  })

  it('deduplicates concurrent script loads for the same URL', async () => {
    const first = ensureCubismCore('/assets/core-a.js')
    const second = ensureCubismCore('/assets/core-a.js')
    const scripts = document.querySelectorAll('script[data-live2d-web-core]')

    expect(scripts).toHaveLength(1)
    window.Live2DCubismCore = {}
    scripts[0]?.dispatchEvent(new Event('load'))

    await expect(Promise.all([first, second])).resolves.toEqual([undefined, undefined])
  })

  it('rejects when a loaded script did not install the global', async () => {
    const promise = ensureCubismCore('/assets/core-b.js')
    const failedScript = document.querySelector<HTMLScriptElement>(
      'script[data-live2d-web-core]',
    )!
    failedScript.dispatchEvent(new Event('load'))

    await expect(promise).rejects.toMatchObject({
      code: 'core-missing',
      details: {
        assetType: 'core',
        url: 'http://localhost:3000/assets/core-b.js',
      },
    })
    expect(failedScript.isConnected).toBe(false)

    const retry = ensureCubismCore('/assets/core-b.js')
    const retryScript = document.querySelector<HTMLScriptElement>(
      'script[data-live2d-web-core]',
    )!
    expect(retryScript).not.toBe(failedScript)
    window.Live2DCubismCore = {}
    retryScript.dispatchEvent(new Event('load'))
    await expect(retry).resolves.toBeUndefined()
  })

  it('ignores a script element the page loaded before us', async () => {
    // A tag the app wrote itself may already have fired load or error, so its
    // one-shot events can never settle a promise we attach listeners to.
    const foreign = document.createElement('script')
    foreign.src = '/assets/core-c.js'
    document.head.appendChild(foreign)
    foreign.dispatchEvent(new Event('error'))

    try {
      const promise = ensureCubismCore('/assets/core-c.js')
      const scripts = document.querySelectorAll<HTMLScriptElement>(
        'script[data-live2d-web-core]',
      )
      expect(scripts).toHaveLength(1)

      window.Live2DCubismCore = {}
      scripts[0]?.dispatchEvent(new Event('load'))
      await expect(promise).resolves.toBeUndefined()
    }
    finally {
      foreign.remove()
    }
  })

  it('lets one caller abort without poisoning the shared load', async () => {
    const controller = new AbortController()
    const aborted = ensureCubismCore('/assets/core-d.js', { signal: controller.signal })
    const shared = ensureCubismCore('/assets/core-d.js')
    const scripts = document.querySelectorAll<HTMLScriptElement>(
      'script[data-live2d-web-core]',
    )
    expect(scripts).toHaveLength(1)

    controller.abort()
    await expect(aborted).rejects.toMatchObject({ name: 'AbortError' })

    window.Live2DCubismCore = {}
    scripts[0]?.dispatchEvent(new Event('load'))
    await expect(shared).resolves.toBeUndefined()
  })

  it('rejects with core-missing when the script never settles', async () => {
    vi.useFakeTimers()
    try {
      const promise = ensureCubismCore('/assets/core-e.js')
      // Attach the rejection handler before the timer fires, or the rejection
      // is unhandled for as long as the timer advance drains microtasks.
      const rejection = expect(promise).rejects.toMatchObject({
        code: 'core-missing',
        details: {
          assetType: 'core',
          url: 'http://localhost:3000/assets/core-e.js',
        },
      })
      const script = document.querySelector<HTMLScriptElement>(
        'script[data-live2d-web-core]',
      )!

      await vi.advanceTimersByTimeAsync(30_000)
      await rejection
      expect(script.isConnected).toBe(false)
    }
    finally {
      vi.useRealTimers()
    }
  })

  it('uses resource timing status when the browser exposes a failed script response', async () => {
    vi.stubGlobal('performance', {
      ...performance,
      getEntriesByName: () => [{ responseStatus: 404 }],
    })
    const promise = ensureCubismCore('/assets/missing-core.js')
    document.querySelector<HTMLScriptElement>(
      'script[data-live2d-web-core]',
    )!.dispatchEvent(new Event('error'))

    await expect(promise).rejects.toMatchObject({
      details: {
        assetType: 'core',
        httpStatus: 404,
        url: 'http://localhost:3000/assets/missing-core.js',
      },
    })
  })
})
