import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SiteHeader } from '../components/SiteHeader'
import { DocsSearchProvider } from '../docs/DocSearch'
import { DocsNavigationProvider } from '../docs/DocsNavigation'
import { SiteLocaleProvider } from '../i18n/SiteLocale'
import { SITE_ORIGIN, siteUrl } from '../lib/siteOrigin'
import '@fontsource-variable/jetbrains-mono'
import '@fontsource-variable/noto-sans-jp'
import 'pretendard/dist/web/variable/pretendardvariable-dynamic-subset.css'
import './globals.css'
import './site.css'
import './docs.css'
import './landing.css'
import './playground.css'

const miSans = localFont({
  display: 'swap',
  fallback: ['Arial', 'sans-serif'],
  preload: true,
  src: [
    { path: '../../public/fonts/MiSansLatin-Regular.woff2', weight: '400' },
    { path: '../../public/fonts/MiSansLatin-Semibold.woff2', weight: '600' },
  ],
  variable: '--font-mi-sans',
})

export const metadata: Metadata = {
  applicationName: 'live2d-web',
  metadataBase: new URL(SITE_ORIGIN),
  description:
    'A WebGL2 runtime for Cubism models with optional React, lip sync, face tracking and developer tools.',
  openGraph: {
    description:
      'Render Cubism 4 and 5 models with WebGL2. Add React, lip sync and face tracking only when your app needs them.',
    locale: 'en_US',
    siteName: 'live2d-web',
    title: 'live2d-web · Live2D for the web',
    type: 'website',
    url: siteUrl('/'),
  },
  title: 'live2d-web · Live2D for the web',
  twitter: {
    card: 'summary_large_image',
    description:
      'Render Cubism 4 and 5 models with WebGL2. Add integrations only when your app needs them.',
    title: 'live2d-web · Live2D for the web',
  },
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={miSans.variable} lang="en">
      <body>
        <SiteLocaleProvider>
          <DocsNavigationProvider>
            <DocsSearchProvider>
              <SiteHeader />
              {children}
            </DocsSearchProvider>
          </DocsNavigationProvider>
        </SiteLocaleProvider>
      </body>
    </html>
  )
}
