import type { Metadata } from 'next'
import localFont from 'next/font/local'
import { SiteHeader } from '../components/SiteHeader'
import { DocsNavigationProvider } from '../docs/DocsNavigation'
import { SiteLocaleProvider } from '../i18n/SiteLocale'
import { SITE_ORIGIN } from '../lib/siteOrigin'
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
  metadataBase: new URL(SITE_ORIGIN),
  title: 'live2d-web',
  description:
    'A Live2D runtime for the web. Load a Cubism model, react to taps, follow the pointer and lip sync. No PixiJS, no globals, React optional.',
}

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html className={miSans.variable} lang="en">
      <body>
        <SiteLocaleProvider>
          <DocsNavigationProvider>
            <SiteHeader />
            {children}
          </DocsNavigationProvider>
        </SiteLocaleProvider>
      </body>
    </html>
  )
}
