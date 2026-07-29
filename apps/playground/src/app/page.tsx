'use client'

import { ensureCubismCore, Live2DError } from 'live2d-jsx'
import { useEffect, useState } from 'react'

type CoreStatus
  = | { state: 'checking' }
    | { state: 'ok' }
    | { state: 'missing', message: string }

/**
 * 스캐폴딩 스모크 페이지 — 렌더링 코드 없이 배선 전체를 검증한다:
 * 라이브러리 import(transpilePackages) → Core Script 태그(layout) → fetch-assets 산출물.
 * "조용한 실패 없음" 약속의 첫 실증: Core가 없으면 에러 메시지가 그대로 보인다.
 */
export default function Home() {
  const [status, setStatus] = useState<CoreStatus>({ state: 'checking' })

  useEffect(() => {
    // 마이크로태스크로 미뤄 effect 본문의 동기 setState를 피한다(react/set-state-in-effect)
    queueMicrotask(() => {
      try {
        ensureCubismCore()
        setStatus({ state: 'ok' })
      }
      catch (error) {
        const message = error instanceof Live2DError ? error.message : String(error)
        setStatus({ state: 'missing', message })
      }
    })
  }, [])

  return (
    <main style={{ padding: 24, maxWidth: 720 }}>
      <h1>live2d-jsx playground</h1>
      <p>스캐폴딩 스모크 테스트: 라이브러리 import, transpile, Cubism Core 배선 검증</p>
      {status.state === 'checking' && <p data-testid="core-status">Cubism Core 확인 중...</p>}
      {status.state === 'ok' && <p data-testid="core-status">✅ Cubism Core 로드됨</p>}
      {status.state === 'missing' && (
        <div data-testid="core-status">
          <p>
            ❌ Cubism Core 없음.
            {' '}
            <code>pnpm fetch-assets</code>
            {' '}
            실행 후 새로고침
          </p>
          <pre style={{ whiteSpace: 'pre-wrap', background: '#f6f6f6', padding: 12 }}>
            {status.message}
          </pre>
        </div>
      )}
    </main>
  )
}
