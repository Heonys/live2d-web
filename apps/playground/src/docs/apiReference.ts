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

export function readApiReference(): ApiReference {
  const applicationRoot = process.cwd().endsWith(path.join('apps', 'playground'))
    ? process.cwd()
    : path.join(process.cwd(), 'apps/playground')
  return JSON.parse(readFileSync(
    path.join(applicationRoot, '.generated/api-reference.json'),
    'utf8',
  )) as ApiReference
}
