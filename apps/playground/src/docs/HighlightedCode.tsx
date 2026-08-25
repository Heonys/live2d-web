import type { BundledLanguage } from 'shiki'
import { codeToTokens } from 'shiki'
import { CodeFrame } from './CodeFrame'

export async function HighlightedCode({ code, language = 'ts' }: {
  code: string
  language?: BundledLanguage
}) {
  const result = await codeToTokens(code, {
    lang: language,
    theme: 'github-dark-default',
  })
  const occurrences = new Map<string, number>()
  const lines = result.tokens.map((line) => {
    const content = line.map(token => token.content).join('')
    const occurrence = occurrences.get(content) ?? 0
    occurrences.set(content, occurrence + 1)
    let offset = 0
    return {
      key: `${content}:${occurrence}`,
      tokens: line.map((token) => {
        const key = `${offset}:${token.content}`
        offset += token.content.length
        return { ...token, key }
      }),
    }
  })
  return (
    <CodeFrame data-language={language}>
      <code>
        {lines.map(line => (
          <span className="line" key={line.key}>
            {line.tokens.map(token => (
              <span key={token.key} style={{ color: token.color }}>{token.content}</span>
            ))}
            {'\n'}
          </span>
        ))}
      </code>
    </CodeFrame>
  )
}
