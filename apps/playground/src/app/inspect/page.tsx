import { Suspense } from 'react'
import { preload } from 'react-dom'
import { InspectorApp } from '../../inspector/InspectorApp'
import { CUBISM_CORE_URL } from '../../lib/assetManifest'

export default function InspectorPage() {
  preload(CUBISM_CORE_URL, { as: 'script' })

  return (
    <Suspense fallback={<main><p>Loading model inspector…</p></main>}>
      <InspectorApp />
    </Suspense>
  )
}
