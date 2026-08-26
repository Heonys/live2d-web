import { readFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'

export interface ApiSymbol {
  description: string
  kind: string
  name: string
  signatures: readonly string[]
}

export interface ApiSection {
  symbols: readonly ApiSymbol[]
  title: string
}

export interface ApiReference {
  generatedAt: string
  sections: readonly ApiSection[]
}

export function apiAnchor(section: string, symbol: string) {
  return `${section.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}-${symbol.toLowerCase().replaceAll(/[^a-z0-9]+/g, '-')}`
}

export function readApiReference(): ApiReference {
  const applicationRoot = process.cwd().endsWith(path.join('apps', 'playground'))
    ? process.cwd()
    : path.join(process.cwd(), 'apps/playground')
  return JSON.parse(readFileSync(
    path.join(applicationRoot, '.generated/api-reference.json'),
    'utf8',
  )) as ApiReference
}
