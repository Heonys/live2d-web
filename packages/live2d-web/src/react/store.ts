import type { ModelHandle } from '../core/contract'
import type { Live2DError } from '../core/errors'
import type { Live2DInstance, Live2DRuntimeState } from '../core/runtime'
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
  handle: ModelHandle
}

type Listener = () => void

export class StageStore {
  private listeners = new Set<Listener>()
  private modelOwner: symbol | null = null
  private modelResource: { owner: symbol, resource: ModelResource } | null = null
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
    this.update({
      error: state.error,
      loadingStage: state.loadingStage,
      render: state.render,
      status: state.status,
    })
  }

  claimModel(owner: symbol): boolean {
    if (this.modelOwner && this.modelOwner !== owner)
      return false
    this.modelOwner = owner
    return true
  }

  isModelOwner(owner: symbol) {
    return this.modelOwner === owner
  }

  releaseModel(owner: symbol) {
    if (this.modelOwner !== owner)
      return
    this.disposeModelResource(owner)
    this.modelOwner = null
    if (this.snapshot.status !== 'error') {
      this.update({
        loadingStage: undefined,
        status: 'ready',
      })
    }
  }

  setModelResource(owner: symbol, resource: ModelResource) {
    if (this.modelOwner !== owner) {
      resource.dispose()
      return false
    }
    this.disposeModelResource(owner)
    this.modelResource = { owner, resource }
    return true
  }

  setModelReady(owner: symbol) {
    if (this.modelOwner !== owner || this.snapshot.status === 'error')
      return
    this.update({
      loadingStage: undefined,
      status: 'ready',
    })
  }

  clearModelResource(owner: symbol, resource: ModelResource) {
    if (
      this.modelResource?.owner === owner
      && this.modelResource.resource === resource
    ) {
      this.modelResource = null
    }
  }

  disposeModelResource(owner?: symbol) {
    if (!this.modelResource)
      return
    if (owner && this.modelResource.owner !== owner)
      return
    const current = this.modelResource
    this.modelResource = null
    current.resource.dispose()
  }
}

interface ModelSnapshot {
  controller: Live2DModelController | null
  runtime: Live2DInstance | null
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

  setRuntime(runtime: Live2DInstance | null) {
    if (this.snapshot.runtime === runtime)
      return
    this.snapshot = { ...this.snapshot, runtime }
    for (const listener of this.listeners)
      listener()
  }
}
