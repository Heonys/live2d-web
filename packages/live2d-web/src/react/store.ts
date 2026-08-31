import type { Live2DError } from '../core/errors'
import type { Live2DModelHandle, Live2DRuntimeState } from '../core/runtime'
import type { Live2DModelController } from './controller'

export type LoadingStage = 'core' | 'stage' | 'model'

export interface Live2DCanvasState {
  status: 'loading' | 'ready' | 'error'
  loadingStage?: LoadingStage
  error?: Live2DError
  render?: {
    width: number
    height: number
    resolution: number
    bufferPixels: number
  }
  retry: () => void
}

interface ModelResource {
  dispose: () => void
}

type Listener = () => void

export class StageStore {
  private listeners = new Set<Listener>()
  // Every mounted model, by the symbol its component owns. The canvas is only
  // ready once the stage is and none of them is still loading.
  private models = new Map<symbol, { loading: boolean, resource?: ModelResource }>()
  private stageReady = false
  private structuralError: Live2DError | undefined
  private snapshot: Live2DCanvasState

  constructor(retry: () => void) {
    this.snapshot = {
      loadingStage: 'core',
      retry,
      status: 'loading',
    }
  }

  readonly subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = () => this.snapshot

  private update(patch: Partial<Live2DCanvasState>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners)
      listener()
  }

  fail(error: Live2DError) {
    if (error.code === 'invalid-tree')
      this.structuralError = error
    this.update({
      error,
      loadingStage: undefined,
      status: 'error',
    })
  }

  syncRuntime(state: Live2DRuntimeState) {
    if (this.structuralError)
      return
    if (state.status === 'disposed')
      return
    this.stageReady = state.status === 'ready'
    this.update({
      error: state.error,
      loadingStage: state.loadingStage,
      render: state.render,
      status: state.status,
    })
    this.settle()
  }

  registerModel(owner: symbol) {
    this.models.set(owner, { loading: true })
    this.settle()
  }

  setModelResource(owner: symbol, resource: ModelResource) {
    const entry = this.models.get(owner)
    if (!entry) {
      // The component unmounted while the model loaded.
      resource.dispose()
      return false
    }
    entry.resource?.dispose()
    entry.resource = resource
    return true
  }

  setModelReady(owner: symbol) {
    const entry = this.models.get(owner)
    if (!entry)
      return
    entry.loading = false
    this.settle()
  }

  releaseModel(owner: symbol) {
    const entry = this.models.get(owner)
    if (!entry)
      return
    this.models.delete(owner)
    entry.resource?.dispose()
    this.settle()
  }

  disposeModelResource() {
    for (const entry of this.models.values())
      entry.resource?.dispose()
    this.models.clear()
  }

  /**
   * The canvas is ready when the stage is and no model is still loading. An
   * empty canvas counts as ready: a consumer can mount one and add models to
   * it later.
   */
  private settle() {
    if (this.structuralError || this.snapshot.status === 'error')
      return
    const loading = [...this.models.values()].some(entry => entry.loading)
    if (this.stageReady && !loading) {
      if (this.snapshot.status !== 'ready')
        this.update({ loadingStage: undefined, status: 'ready' })
      return
    }
    if (this.stageReady && loading && this.snapshot.status !== 'loading')
      this.update({ loadingStage: 'model', status: 'loading' })
  }
}

interface ModelSnapshot {
  controller: Live2DModelController | null
  /** This model's handle, so a child feature attaches to its own model. */
  runtime: Live2DModelHandle | null
}

export class ModelStore {
  private listeners = new Set<Listener>()
  private snapshot: ModelSnapshot = { controller: null, runtime: null }

  readonly subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = () => this.snapshot

  setController(controller: Live2DModelController | null) {
    if (this.snapshot.controller === controller)
      return
    this.snapshot = { ...this.snapshot, controller }
    for (const listener of this.listeners)
      listener()
  }

  setRuntime(runtime: Live2DModelHandle | null) {
    if (this.snapshot.runtime === runtime)
      return
    this.snapshot = { ...this.snapshot, runtime }
    for (const listener of this.listeners)
      listener()
  }
}
