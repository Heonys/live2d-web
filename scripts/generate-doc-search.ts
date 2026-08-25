import type { Root } from 'mdast'
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { compile } from '@mdx-js/mdx'
import { visit } from 'unist-util-visit'
import { DOC_LOCALES, DOC_PAGES } from '../apps/playground/src/docs/manifest'

const repositoryRoot = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const root = path.join(repositoryRoot, 'apps/playground')
const output = path.join(root, '.generated/docs-search.json')

function textOf(node: { children?: unknown[], type?: string, value?: string }): string {
  if (node.type === 'text' || node.type === 'inlineCode')
    return node.value ?? ''
  return (node.children ?? []).map(child => textOf(child as typeof node)).join(' ')
}

const entries = []
for (const locale of DOC_LOCALES) {
  for (const page of DOC_PAGES) {
    const filename = page.slug || 'index'
    const source = readFileSync(path.join(root, `content/docs/${locale}/${filename}.mdx`), 'utf8')
    const body: string[] = []
    const headings: { id: string, text: string }[] = []
    const ids = new Set<string>()
    await compile(source, {
      remarkPlugins: [() => (tree: Root) => {
        visit(tree, 'heading', (node) => {
          const text = textOf(node).trim()
          const id = text.toLocaleLowerCase()
            .replaceAll(/[^\p{Letter}\p{Number}]+/gu, '-')
            .replaceAll(/^-|-$/g, '')
          if (!id || ids.has(id))
            throw new Error(`${locale}/${filename}.mdx has an empty or duplicate heading: ${text}`)
          ids.add(id)
          headings.push({ id, text })
        })
        visit(tree, 'text', node => body.push(node.value))
        visit(tree, 'inlineCode', node => body.push(node.value))
      }],
    })
    entries.push({
      headings,
      href: `/docs/${locale}${page.slug ? `/${page.slug}` : ''}`,
      locale,
      slug: page.slug,
      summary: page.summary[locale],
      text: body.join(' ').replaceAll(/\s+/g, ' ').trim(),
      title: page.title[locale],
    })
  }
}

mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify(entries, null, 2)}\n`)
console.log(`[docs] generated localized search index with ${entries.length} pages`)
