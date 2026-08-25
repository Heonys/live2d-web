import { existsSync, readdirSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  DOC_LOCALES,
  DOC_PAGES,
  docHref,
} from '../apps/playground/src/docs/manifest'

const failures: string[] = []
const slugs = new Set<string>()
const contentRoot = 'apps/playground/content/docs'

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
