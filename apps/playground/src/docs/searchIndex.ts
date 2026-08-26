import type { DocLocale } from './manifest'
import type { DocSearchEntry } from './searchTypes'
import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { apiAnchor, readApiReference } from './apiReference'
import { docHref } from './manifest'

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

export function readCombinedDocSearch(locale: DocLocale): DocSearchEntry[] {
  const pages: DocSearchEntry[] = readDocSearch(locale).map(entry => ({
    href: entry.href,
    kind: 'page' as const,
    summary: entry.summary,
    text: entry.text,
    title: entry.title,
  }))
  const api: DocSearchEntry[] = readApiReference().sections.flatMap(section => section.symbols.map(symbol => ({
    href: `${docHref(locale, 'api')}#${apiAnchor(section.title, symbol.name)}`,
    kind: 'api' as const,
    summary: symbol.description || `${section.title} ${symbol.kind}`,
    text: symbol.signatures.join(' '),
    title: symbol.name,
  })))
  return [...pages, ...api]
}
