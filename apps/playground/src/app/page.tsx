import type { Metadata } from 'next'
import type { SiteLocale } from '../i18n/site'
import { LandingCodeTabs } from '../components/LandingCodeTabs'
import { LandingDemo } from '../components/LandingDemo'
import { LandingInstallCommand } from '../components/LandingInstallCommand'
import { DocsIntentLink } from '../docs/DocsNavigation'
import { HighlightedCode } from '../docs/HighlightedCode'
import { localizedMetadata } from '../i18n/metadata'
import { getSiteMessages, localizedDocPath, localizedPath } from '../i18n/site'

const JAVASCRIPT_QUICK_START = `import { createLive2D } from 'live2d-web'

const character = await createLive2D({
  container: document.querySelector('#avatar'),
  coreUrl: '/live2dcubismcore.min.js',
  src: '/models/avatar.model3.json',
})

await character.motion('TapBody', 0)
window.addEventListener('pagehide', () => character.dispose(), { once: true })`

const REACT_QUICK_START = `'use client'

import { Live2DCanvas, Live2DModel } from 'live2d-web/react'

export function Avatar() {
  return (
    <Live2DCanvas coreUrl="/live2dcubismcore.min.js">
      <Live2DModel src="/models/avatar.model3.json" />
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
  const siteMessages = getSiteMessages(locale)
  const messages = siteMessages.landing
  const capabilities = [
    {
      description: messages.runtimeCapabilityDescription,
      features: ['Cubism 4/5', 'Motion & sequences', 'Expressions', 'Parameters'],
      label: messages.runtimeCapabilityLabel,
    },
    {
      description: messages.trackingCapabilityDescription,
      features: ['Volume lip sync', 'wLipSync', 'MediaPipe Main / Worker'],
      label: messages.trackingCapabilityLabel,
    },
    {
      description: messages.toolingCapabilityDescription,
      features: ['React', 'Inspector', 'Devtools', 'Verified examples'],
      label: messages.toolingCapabilityLabel,
    },
  ]
  const entries = [
    {
      description: messages.coreEntryDescription,
      label: 'Core',
      name: 'live2d-web',
    },
    {
      description: messages.integrationsDescription,
      label: 'Integrations',
      name: 'live2d-web/react\nlive2d-web/tracking/mediapipe',
    },
    {
      description: messages.toolsEntryDescription,
      label: 'Tools',
      name: 'live2d-web/inspect\nlive2d-web/devtools',
    },
  ]
  return (
    <main className="landing-page" lang={locale}>
      <section className="landing-hero">
        <div className="landing-copy">
          <LandingInstallCommand />
          <h1>
            <span>A Live2D runtime</span>
            {' '}
            <span>for the web.</span>
          </h1>
          <p className="landing-lead">
            {messages.description}
          </p>
          <div className="landing-actions">
            <DocsIntentLink className="primary-action" href={localizedDocPath(locale)}>{messages.readDocs}</DocsIntentLink>
            <DocsIntentLink href={localizedPath(locale, '/playground')}>{messages.openPlayground}</DocsIntentLink>
          </div>
        </div>
        <LandingDemo />
      </section>

      <section className="landing-capability-section" aria-labelledby="landing-capability-title">
        <header>
          <p>{messages.capabilitySectionLabel}</p>
          <h2 id="landing-capability-title">{messages.capabilitySectionTitle}</h2>
          <span>{messages.capabilitySectionDescription}</span>
        </header>
        <div className="landing-capability-list">
          {capabilities.map(capability => (
            <article key={capability.label}>
              <h3>{capability.label}</h3>
              <p>{capability.description}</p>
              <ul>
                {capability.features.map(feature => <li key={feature}>{feature}</li>)}
              </ul>
            </article>
          ))}
        </div>
      </section>

      <section className="landing-code-section">
        <div>
          <p className="eyebrow">{messages.quickStartLabel}</p>
          <h2>{messages.quickStartTitle}</h2>
          <p>{messages.quickStartDescription}</p>
          <DocsIntentLink href={localizedDocPath(locale, 'vanilla')}>{messages.quickStartGuide}</DocsIntentLink>
        </div>
        <LandingCodeTabs
          label={messages.codeTabsLabel}
          panels={[
            <HighlightedCode code={JAVASCRIPT_QUICK_START} filename="avatar.ts" key="javascript" language="ts" />,
            <HighlightedCode code={REACT_QUICK_START} filename="Avatar.tsx" key="react" language="tsx" />,
          ]}
          tabs={['JavaScript', 'React']}
        />
      </section>

      <section className="landing-entry-section" aria-labelledby="landing-entry-title">
        <header>
          <p>{messages.entrySectionLabel}</p>
          <h2 id="landing-entry-title">{messages.entrySectionTitle}</h2>
          <span>{messages.entrySectionDescription}</span>
        </header>
        <div className="landing-entry-list">
          {entries.map(entry => (
            <article key={entry.name}>
              <code>{entry.name}</code>
              <div>
                <h3>{entry.label}</h3>
                <p>{entry.description}</p>
              </div>
            </article>
          ))}
        </div>
      </section>

      <footer className="landing-footer">
        <div className="landing-footer-main">
          <p>© 2026 Jiheon Kim</p>
          <nav aria-label={messages.footerNavigation}>
            <DocsIntentLink href={localizedDocPath(locale)}>Documentation</DocsIntentLink>
            <a href="https://www.npmjs.com/package/live2d-web">npm</a>
            <a href="https://github.com/Heonys/live2d-web">GitHub</a>
            <a href="https://github.com/Heonys/live2d-web/blob/main/LICENSE">MIT License</a>
          </nav>
        </div>
        <p className="landing-footer-note">{messages.finalNote}</p>
      </footer>
    </main>
  )
}

export default function LandingPage() {
  return <LandingPageContent locale="en" />
}
