import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import {
  DOC_LOCALES,
  DOC_PAGES,
  docHref,
} from '../apps/playground/src/docs/content'

const failures: string[] = []
const slugs = new Set<string>()

for (const page of DOC_PAGES) {
  if (slugs.has(page.slug))
    failures.push(`duplicate documentation slug: ${page.slug || '(index)'}`)
  slugs.add(page.slug)
  if (page.slug && !/^[a-z0-9]+(?:-[a-z0-9]+)*$/.test(page.slug))
    failures.push(`invalid documentation slug: ${page.slug}`)
  for (const locale of DOC_LOCALES) {
    if (!page.title[locale].trim() || !page.summary[locale].trim())
      failures.push(`${page.slug || '(index)'} is missing ${locale} title or summary`)
    for (const section of page.sections) {
      if (!section.heading[locale].trim() || !section.paragraphs[locale].length)
        failures.push(`${page.slug || '(index)'} is missing ${locale} section content`)
      if (section.bullets && !section.bullets[locale].length)
        failures.push(`${page.slug || '(index)'} has an empty ${locale} bullet list`)
      for (const link of section.links ?? []) {
        if (!link.label[locale].trim())
          failures.push(`${page.slug || '(index)'} has an empty ${locale} link label`)
        if (!/^https:\/\//.test(link.href))
          failures.push(`${page.slug || '(index)'} has an invalid link: ${link.href}`)
      }
    }
  }
}

const llms = readFileSync('apps/playground/public/llms.txt', 'utf8')
for (const page of DOC_PAGES) {
  const href = docHref('en', page.slug)
  if (!llms.includes(href) && page.slug)
    failures.push(`llms.txt is missing ${href}`)
}

const generatedApi = 'apps/playground/.generated/api-reference.json'
if (!existsSync(generatedApi)) {
  failures.push('TypeDoc API reference was not generated')
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
  console.log(`[docs] ${DOC_PAGES.length} slugs × ${DOC_LOCALES.length} locales and generated API verified`)
}
