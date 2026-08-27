import { execFileSync } from 'node:child_process'
import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  DOC_LOCALES,
  DOC_PAGES,
  docHref,
} from '../apps/playground/src/docs/manifest'
import {
  PREFIXED_SITE_LOCALES,
  PUBLIC_MESSAGE_SECTIONS,
} from '../apps/playground/src/i18n/site'

const failures: string[] = []
const slugs = new Set<string>()
const contentRoot = 'apps/playground/content/docs'
const errorCodes = readErrorCodes()
const discouragedLocalizedPhrases = {
  ja: [
    /client boundary/iu,
    /entry point/iu,
    /framework-free/iu,
    /source mode/iu,
  ],
  ko: [
    /\bbinding\b/iu,
    /\bboundary\b/iu,
    /entry point/iu,
    /집중된 런타임/u,
  ],
} as const

function messageLeaves(value: unknown, prefix = ''): Map<string, string> {
  const leaves = new Map<string, string>()
  if (!value || typeof value !== 'object')
    return leaves
  for (const [key, child] of Object.entries(value)) {
    const pathName = prefix ? `${prefix}.${key}` : key
    if (typeof child === 'string')
      leaves.set(pathName, child)
    else
      messageLeaves(child, pathName).forEach((text, path) => leaves.set(path, text))
  }
  return leaves
}

function mdxProse(source: string): string {
  let fenced = false
  return source
    .split('\n')
    .map((line) => {
      if (/^\s*```/u.test(line)) {
        fenced = !fenced
        return ''
      }
      if (fenced)
        return ''
      return line.replace(/`[^`]*`/gu, '')
    })
    .join('\n')
}

/**
 * Derived from the source union rather than copied, because `scripts/` is
 * outside every typecheck project: a hand-written list would let an eleventh
 * error code ship with no documentation and a green gate.
 */
function readErrorCodes(): string[] {
  const source = 'packages/live2d-web/src/core/errors.ts'
  const union = readFileSync(source, 'utf8').match(
    /export type Live2DErrorCode\b([\s\S]*?)\n\n/,
  )?.[1]
  const codes = [...(union ?? '').matchAll(/'([a-z][a-z-]*)'/g)].map(match => match[1]!)
  if (codes.length < 5)
    throw new Error(`could not read the Live2DErrorCode union from ${source}`)
  return [...codes].sort()
}

for (const page of DOC_PAGES) {
  if (slugs.has(page.slug))
    failures.push(`duplicate documentation slug: ${page.slug || '(index)'}`)
  slugs.add(page.slug)
  if (page.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug))
    failures.push(`invalid documentation slug: ${page.slug}`)
  for (const locale of DOC_LOCALES) {
    if (!page.title[locale].trim() || !page.summary[locale].trim())
      failures.push(`${page.slug || '(index)'} is missing ${locale} metadata`)
    const filename = `${page.slug || 'index'}.mdx`
    const sourcePath = path.join(contentRoot, locale, filename)
    if (!existsSync(sourcePath)) {
      failures.push(`missing localized MDX: ${locale}/${filename}`)
      continue
    }
    const source = readFileSync(sourcePath, 'utf8')
    if (!source.trim())
      failures.push(`empty localized MDX: ${locale}/${filename}`)
    if (page.slug === 'troubleshooting') {
      for (const code of errorCodes) {
        if (!new RegExp(`^#{2,6}\\s+${code}\\s*$`, 'm').test(source))
          failures.push(`${locale}/${filename} is missing #${code}`)
      }
    }
    for (const match of source.matchAll(/\]\(([^)]+)\)/g)) {
      const href = match[1]!
      if (/^https:\/\//.test(href) || href.startsWith('#') || href.startsWith('/'))
        continue
      failures.push(`${locale}/${filename} has a non-root-relative link: ${href}`)
    }
  }
}

const expectedFiles = new Set(DOC_PAGES.map(page => `${page.slug || 'index'}.mdx`))
for (const locale of DOC_LOCALES) {
  for (const file of readdirSync(path.join(contentRoot, locale))) {
    if (!expectedFiles.has(file))
      failures.push(`unexpected ${locale} documentation file: ${file}`)
  }
}

const englishMessages = messageLeaves(PUBLIC_MESSAGE_SECTIONS.en)
for (const [locale, messages] of Object.entries(PUBLIC_MESSAGE_SECTIONS)) {
  const leaves = messageLeaves(messages)
  for (const key of englishMessages.keys()) {
    if (!leaves.has(key))
      failures.push(`${locale} site messages are missing ${key}`)
    else if (!leaves.get(key)?.trim())
      failures.push(`${locale} site message is empty: ${key}`)
  }
  for (const key of leaves.keys()) {
    if (!englishMessages.has(key))
      failures.push(`${locale} site messages have an unexpected key: ${key}`)
  }
}

for (const locale of ['ko', 'ja'] as const) {
  const leaves = messageLeaves(PUBLIC_MESSAGE_SECTIONS[locale])
  for (const [key, value] of leaves) {
    for (const phrase of discouragedLocalizedPhrases[locale]) {
      if (phrase.test(value))
        failures.push(`${locale} site message contains literal translation wording at ${key}: ${phrase.source}`)
    }
  }
  for (const page of DOC_PAGES) {
    const metadata = `${page.title[locale]}\n${page.summary[locale]}`
    for (const phrase of discouragedLocalizedPhrases[locale]) {
      if (phrase.test(metadata))
        failures.push(`${locale}/${page.slug || 'index'} metadata contains literal translation wording: ${phrase.source}`)
    }

    const filename = `${page.slug || 'index'}.mdx`
    const sourcePath = path.join(contentRoot, locale, filename)
    if (!existsSync(sourcePath))
      continue
    const prose = mdxProse(readFileSync(sourcePath, 'utf8'))
    for (const phrase of discouragedLocalizedPhrases[locale]) {
      if (phrase.test(prose))
        failures.push(`${locale}/${filename} contains literal translation wording: ${phrase.source}`)
    }
  }
}

for (const route of ['page.tsx', 'playground/page.tsx', 'inspect/page.tsx', 'vanilla/page.tsx', 'compare/page.tsx', 'examples/page.tsx']) {
  for (const locale of PREFIXED_SITE_LOCALES) {
    const routePath = path.join('apps/playground/src/app/[locale]', route)
    if (!existsSync(routePath))
      failures.push(`missing /${locale} static route source: ${routePath}`)
  }
}

const legacyHost = ['net', 'lify'].join('')
try {
  const matches = execFileSync('git', ['grep', '-in', '-e', legacyHost, '--', '.'], {
    encoding: 'utf8',
  }).trim()
  if (matches)
    failures.push(`tracked source still references ${legacyHost}:\n${matches}`)
}
catch {
  // git grep exits with 1 when there are no matches.
}

const llms = readFileSync('apps/playground/public/llms.txt', 'utf8')
for (const page of DOC_PAGES) {
  const href = docHref('en', page.slug)
  if (!llms.includes(href) && page.slug)
    failures.push(`llms.txt is missing ${href}`)
}

const generatedApi = 'apps/playground/.generated/api-reference.json'
const generatedSearch = 'apps/playground/.generated/docs-search.json'
if (!existsSync(generatedApi) || !existsSync(generatedSearch)) {
  failures.push('generated API reference or search index is missing')
}
else {
  const api = JSON.parse(readFileSync(generatedApi, 'utf8')) as {
    sections?: { symbols?: unknown[] }[]
  }
  const symbols = api.sections?.reduce(
    (total, section) => total + (section.symbols?.length ?? 0),
    0,
  ) ?? 0
  if (symbols < 10)
    failures.push(`TypeDoc API reference has only ${symbols} public symbols`)
  const search = JSON.parse(readFileSync(generatedSearch, 'utf8')) as unknown[]
  if (search.length !== DOC_PAGES.length * DOC_LOCALES.length)
    failures.push(`search index has ${search.length} entries instead of ${DOC_PAGES.length * DOC_LOCALES.length}`)
}

for (const example of ['vanilla-vite', 'next-react', 'vue-vite', 'obs-overlay']) {
  if (!existsSync(path.join('examples', example, 'package.json')))
    failures.push(`missing buildable example: ${example}`)
}

if (failures.length) {
  for (const failure of failures)
    console.error(`[docs] ${failure}`)
  process.exitCode = 1
}
else {
  console.log(`[docs] ${DOC_PAGES.length} MDX slugs × ${DOC_LOCALES.length} locales, links, search and API verified`)
}
