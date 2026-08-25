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
            <p className="eyebrow">Cubism on the modern web</p>
            <h1>Live2D that feels native to your app.</h1>
            <p className="landing-lead">
              A focused runtime for Vanilla, React and modern browsers—motions,
              lip sync and face tracking without a required rendering framework.
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
            <h2>Small by default</h2>
            <p>React, MediaPipe, inspection and devtools stay in optional subpaths.</p>
          </article>
          <article>
            <span>02</span>
            <h2>Real model controls</h2>
            <p>Compose motions, expressions, weighted idle and application-owned lip sync.</p>
          </article>
          <article>
            <span>03</span>
            <h2>Built for debugging</h2>
            <p>Inspect model packages and mount an isolated parameter devtools panel.</p>
          </article>
        </section>

        <section className="landing-code-section">
          <div>
            <p className="eyebrow">React optional</p>
            <h2>Start with one component boundary.</h2>
            <p>Use the root API in any framework, or take the small React binding when it helps.</p>
            <Link href="/docs/en/react">React guide →</Link>
          </div>
          <HighlightedCode code={QUICK_START} language="tsx" />
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
