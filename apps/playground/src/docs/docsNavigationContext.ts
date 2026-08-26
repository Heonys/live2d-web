'use client'

import { createContext, use } from 'react'

export interface DocsNavigationValue {
  markPending: () => void
  pending: boolean
  prefetch: (href: string) => void
}

export const DocsNavigationContext = createContext<DocsNavigationValue>({
  markPending: () => {},
  pending: false,
  prefetch: () => {},
})

export function useDocsNavigation() {
  return use(DocsNavigationContext)
}
