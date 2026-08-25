import type { DocLocale } from './manifest'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export interface GeneratedDocSearchEntry {
  headings: readonly { id: string, text: string }[]
  href: string
  locale: DocLocale
  slug: string
  summary: string
  text: string
  title: string
}

export function readDocSearch(locale: DocLocale): GeneratedDocSearchEntry[] {
  const applicationRoot = process.cwd().endsWith(path.join('apps', 'playground'))
    ? process.cwd()
    : path.join(process.cwd(), 'apps/playground')
  const entries = JSON.parse(readFileSync(
    path.join(applicationRoot, '.generated/docs-search.json'),
    'utf8',
  )) as GeneratedDocSearchEntry[]
  return entries.filter(entry => entry.locale === locale)
}
