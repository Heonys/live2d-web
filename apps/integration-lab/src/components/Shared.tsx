import type { ReactNode } from 'react'

export function ScenarioHeader({
  eyebrow,
  title,
  children,
}: {
  eyebrow: string
  title: string
  children: ReactNode
}) {
  return (
    <header className="scenario-header">
      <p className="eyebrow">{eyebrow}</p>
      <h1>{title}</h1>
      <p>{children}</p>
    </header>
  )
}

export function AssetError({ message, retry }: { message: string, retry: () => void }) {
  return (
    <div className="asset-error" data-testid="asset-error" role="alert">
      <strong>Demo assets unavailable</strong>
      <p>{message}</p>
      <button type="button" onClick={retry}>Retry assets</button>
    </div>
  )
}

export function StatusPill({ children, state = 'neutral' }: {
  children: ReactNode
  state?: 'bad' | 'good' | 'neutral' | 'warn'
}) {
  return <span className="status-pill" data-state={state}>{children}</span>
}

export function ControlGroup({ label, children }: { label: string, children: ReactNode }) {
  return (
    <fieldset className="control-group">
      <legend>{label}</legend>
      {children}
    </fieldset>
  )
}
