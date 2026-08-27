import type { Metadata } from 'next'
import type { SiteLocale } from '../i18n/site'
import { LandingDemo } from '../components/LandingDemo'
import { DocsIntentLink } from '../docs/DocsNavigation'
import { HighlightedCode } from '../docs/HighlightedCode'
import { localizedMetadata } from '../i18n/metadata'
import { getSiteMessages, localizedDocPath, localizedPath } from '../i18n/site'

const QUICK_START = `import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/avatar.model3.json" followPointer />
    </Live2DCanvas>
  )
}`

export const metadata: Metadata = localizedMetadata(
  'en',
  '/',
  'landingTitle',
  'landingDescription',
)

export function LandingPageContent({ locale }: { locale: SiteLocale }) {
  const messages = getSiteMessages(locale).landing
  return (
    <main className="landing-page" lang={locale}>
      <section className="landing-hero">
        <div className="landing-copy">
          <p className="landing-status-line">
            <span aria-hidden="true" />
            {messages.status}
          </p>
          <h1>{messages.title}</h1>
          <p className="landing-lead">
            {messages.description}
          </p>
          <div className="landing-actions">
            <DocsIntentLink className="primary-action" href={localizedDocPath(locale)}>{messages.readDocs}</DocsIntentLink>
            <DocsIntentLink href={localizedPath(locale, '/playground')}>{messages.openPlayground}</DocsIntentLink>
          </div>
          <code className="landing-install">npm install live2d-web</code>
        </div>
        <LandingDemo />
      </section>

      <section className="landing-features" aria-label={messages.highlights}>
        <article>
          <h2>{messages.featureOneTitle}</h2>
          <p>{messages.featureOneDescription}</p>
        </article>
        <article>
          <h2>{messages.featureTwoTitle}</h2>
          <p>{messages.featureTwoDescription}</p>
        </article>
        <article>
          <h2>{messages.featureThreeTitle}</h2>
          <p>{messages.featureThreeDescription}</p>
        </article>
      </section>

      <section className="landing-code-section">
        <div>
          <p className="eyebrow">
            {messages.optionalEntry}
            {' · live2d-web/react'}
          </p>
          <h2>{messages.reactTitle}</h2>
          <p>{messages.reactDescription}</p>
          <DocsIntentLink href={localizedDocPath(locale, 'react')}>{messages.reactGuide}</DocsIntentLink>
        </div>
        <HighlightedCode code={QUICK_START} filename="Avatar.tsx" language="tsx" />
      </section>

      <section className="landing-final-cta">
        <p>{messages.finalNote}</p>
        <div>
          <DocsIntentLink href={localizedPath(locale, '/inspect')}>{messages.inspectModel}</DocsIntentLink>
          <DocsIntentLink href={localizedDocPath(locale, 'examples')}>{messages.browseExamples}</DocsIntentLink>
        </div>
      </section>
    </main>
  )
}

export default function LandingPage() {
  return <LandingPageContent locale="en" />
}
