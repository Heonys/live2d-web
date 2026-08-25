import { Suspense } from 'react'
import { preload } from 'react-dom'
import { SiteHeader } from '../../components/SiteHeader'
import { InspectorApp } from '../../inspector/InspectorApp'
import { CUBISM_CORE_URL } from '../../lib/assetManifest'

export default function InspectorPage() {
  preload(CUBISM_CORE_URL, { as: 'script' })

  return (
    <>
      <SiteHeader />
      <Suspense fallback={<main><p>Loading model inspector…</p></main>}>
        <InspectorApp />
      </Suspense>
    </>
  )
}
