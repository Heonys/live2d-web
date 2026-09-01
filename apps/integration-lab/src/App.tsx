import { useEffect, useState } from 'react'
import { installLabBridge, recordError } from './diagnostics'
import { AssetsTools } from './scenarios/AssetsTools'
import { Compare } from './scenarios/Compare'
import { Dashboard } from './scenarios/Dashboard'
import { Inputs } from './scenarios/Inputs'
import { Lifecycle } from './scenarios/Lifecycle'
import { Studio } from './scenarios/Studio'

const navigation = [
  ['/dashboard', 'Dashboard'],
  ['/studio', 'Studio'],
  ['/lifecycle', 'Lifecycle'],
  ['/inputs', 'Inputs'],
  ['/assets', 'Assets'],
  ['/compare', 'Pixi'],
] as const

function useRoute() {
  const read = () => window.location.hash.slice(1) || '/dashboard'
  const [route, setRoute] = useState(read)
  useEffect(() => {
    const update = () => setRoute(read())
    window.addEventListener('hashchange', update)
    return () => window.removeEventListener('hashchange', update)
  }, [])
  return route
}

export function App() {
  const route = useRoute()
  useEffect(() => {
    const uninstallBridge = installLabBridge()
    const onError = (event: ErrorEvent) => recordError(event.error ?? event.message)
    const onRejection = (event: PromiseRejectionEvent) => recordError(event.reason)
    window.addEventListener('error', onError)
    window.addEventListener('unhandledrejection', onRejection)
    return () => {
      uninstallBridge()
      window.removeEventListener('error', onError)
      window.removeEventListener('unhandledrejection', onRejection)
    }
  }, [])

  const page = route === '/studio'
    ? <Studio />
    : route === '/lifecycle'
      ? <Lifecycle />
      : route === '/inputs'
        ? <Inputs />
        : route === '/assets'
          ? <AssetsTools />
          : route === '/compare'
            ? <Compare />
            : <Dashboard />

  return (
    <div className="lab-shell">
      <header className="lab-header">
        <a className="lab-brand" href="#/dashboard">
          <span aria-hidden="true">L2</span>
          <b>integration lab</b>
        </a>
        <nav aria-label="Lab scenarios">
          {navigation.map(([href, label]) => (
            <a aria-current={route === href ? 'page' : undefined} href={`#${href}`} key={href}>{label}</a>
          ))}
        </nav>
        <span className="source-badge" data-source={__LIVE2D_LAB_META__.source}>
          {__LIVE2D_LAB_META__.source === 'release' ? 'npm 0.9.0' : 'local source'}
        </span>
      </header>
      {page}
    </div>
  )
}
