import type { MDXComponents } from 'mdx/types'
import type { ReactNode } from 'react'
import { CodeFigure } from './src/docs/CodeFigure'

function headingText(children: ReactNode): string {
  if (Array.isArray(children))
    return children.map(headingText).join('')
  if (typeof children === 'string' || typeof children === 'number')
    return String(children)
  if (children && typeof children === 'object' && 'props' in children)
    return headingText((children as { props: { children?: ReactNode } }).props.children)
  return ''
}

function headingId(children: ReactNode) {
  return headingText(children)
    .trim()
    .toLocaleLowerCase()
    .replaceAll(/[^\p{Letter}\p{Number}]+/gu, '-')
    .replaceAll(/^-|-$/g, '')
}

export function useMDXComponents(components: MDXComponents): MDXComponents {
  return {
    a: ({ children, ...props }) => <a {...props}>{children}</a>,
    blockquote: ({ children }) => <aside className="docs-callout">{children}</aside>,
    h2: ({ children }) => {
      const id = headingId(children)
      return <h2 id={id}><a aria-label={`Link to ${headingText(children)}`} href={`#${encodeURIComponent(id)}`}>{children}</a></h2>
    },
    h3: ({ children }) => {
      const id = headingId(children)
      return <h3 id={id}><a aria-label={`Link to ${headingText(children)}`} href={`#${encodeURIComponent(id)}`}>{children}</a></h3>
    },
    figure: CodeFigure,
    table: ({ children }) => <div className="docs-table"><table>{children}</table></div>,
    ...components,
  }
}
