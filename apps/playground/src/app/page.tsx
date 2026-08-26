import Link from 'next/link'
import { LandingDemo } from '../components/LandingDemo'
import { SiteHeader } from '../components/SiteHeader'
import { HighlightedCode } from '../docs/HighlightedCode'

const QUICK_START = `import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/avatar.model3.json" followPointer />
    </Live2DCanvas>
  )
}`

export default function LandingPage() {
  return (
    <>
      <SiteHeader />
      <main className="landing-page">
        <section className="landing-hero">
          <div className="landing-copy">
            <p className="landing-status-line">
              <span aria-hidden="true" />
              Cubism 4/5 · WebGL2 · JavaScript + React
            </p>
            <h1>Live2D, directly in the browser.</h1>
            <p className="landing-lead">
              A focused WebGL2 runtime for Cubism models. Add motion, lip sync,
              face tracking and devtools only when your app needs them.
            </p>
            <div className="landing-actions">
              <Link className="primary-action" href="/docs/en">Read the docs</Link>
              <Link href="/playground">Open playground</Link>
            </div>
            <code className="landing-install">npm install live2d-web</code>
          </div>
          <LandingDemo />
        </section>

        <section className="landing-features" aria-label="Highlights">
          <article>
            <span>01</span>
            <h2>Optional by design</h2>
            <p>React, MediaPipe, inspection and devtools stay in separate entry points.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Playback you control</h2>
            <p>Sequence motions, fade expressions and connect application-owned lip sync.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Tools when needed</h2>
            <p>Inspect model packages or mount isolated parameter devtools during development.</p>
          </article>
        </section>

        <section className="landing-code-section">
          <div>
            <p className="eyebrow">Optional entry · live2d-web/react</p>
            <h2>A small React boundary.</h2>
            <p>The renderer stays framework-agnostic. Add the React binding only at the client boundary that owns your model.</p>
            <Link href="/docs/en/react">React guide →</Link>
          </div>
          <HighlightedCode code={QUICK_START} filename="Avatar.tsx" language="tsx" />
        </section>

        <section className="landing-final-cta">
          <p>Bring your own licensed Cubism Core and model assets.</p>
          <div>
            <Link href="/inspect">Inspect a model</Link>
            <Link href="/docs/en/examples">Browse examples</Link>
          </div>
        </section>
      </main>
    </>
  )
}
