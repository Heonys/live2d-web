import process from 'node:process'

const LOCAL_SITE_ORIGIN = 'http://localhost:3000'
const PRODUCTION_SITE_ORIGIN = 'https://live2d-web.heonys.dev'

function withProtocol(value: string) {
  return /^https?:\/\//u.test(value) ? value : `https://${value}`
}

function normalizeOrigin(value: string) {
  return withProtocol(value).replace(/\/$/u, '')
}

export const SITE_ORIGIN = normalizeOrigin(
  process.env.NEXT_PUBLIC_SITE_URL
  ?? process.env.VERCEL_PROJECT_PRODUCTION_URL
  ?? (process.env.NODE_ENV === 'production'
    ? PRODUCTION_SITE_ORIGIN
    : LOCAL_SITE_ORIGIN),
)

export function siteUrl(path = '/') {
  return new URL(path, `${SITE_ORIGIN}/`).toString()
}
