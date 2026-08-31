'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'
import { useCallback, useEffect, useRef, useState } from 'react'

const CORE_URL = '/assets/js/cubism/5.3/live2dcubismcore.min.js'
const LEFT = '/assets/live2d/hiyori/hiyori_free/runtime/hiyori_free_t08.model3.json'
const RIGHT = '/assets/live2d/mark/Mark.model3.json'

declare global {
  interface Window {
    __live2dWebReactMulti?: {
      loaded: number
      canvases: number
      readHalves: () => Promise<{ left: number, right: number }>
    }
  }
}

export default function ReactMultiModelHarness() {
  const hostRef = useRef<HTMLDivElement>(null)
  const [loaded, setLoaded] = useState(0)
  const [showRight, setShowRight] = useState(true)

  const readHalves = useCallback(() => new Promise<{ left: number, right: number }>((resolve) => {
    const canvas = hostRef.current?.querySelector('canvas')
    if (!canvas) {
      resolve({ left: -1, right: -1 })
      return
    }
    const gl = canvas.getContext('webgl2')!
    const opaque = (fromX: number) => {
      // Cubism leaves its mask framebuffer bound after a draw that used one, so
      // a reader outside the frame has to rebind or it samples the mask.
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
    requestAnimationFrame(() => {
      requestAnimationFrame(() => {
        resolve({ left: opaque(0), right: opaque(Math.floor(canvas.width / 2)) })
      })
    })
  }), [])

  useEffect(() => {
    window.__live2dWebReactMulti = {
      canvases: hostRef.current?.querySelectorAll('canvas').length ?? 0,
      loaded,
      readHalves,
    }
  }, [loaded, readHalves, showRight])

  return (
    <main style={{ padding: 12 }}>
      <div ref={hostRef} style={{ height: 640, width: 640 }}>
        <Live2DCanvas coreUrl={CORE_URL} pauseWhenOffscreen={false} resolution={1}>
          <Live2DModel
            fit={{ offsetX: -0.25, scale: 0.5, units: 'stage' }}
            src={LEFT}
            onLoad={() => setLoaded(count => count + 1)}
          />
          {showRight && (
            <Live2DModel
              fit={{ offsetX: 0.25, scale: 0.5, units: 'stage' }}
              src={RIGHT}
              onLoad={() => setLoaded(count => count + 1)}
            />
          )}
        </Live2DCanvas>
      </div>
      <button type="button" onClick={() => setShowRight(false)}>drop right</button>
    </main>
  )
}
