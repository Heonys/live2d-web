import type { Live2DBackend, ModelHandle, StageHandle } from '../core/contract'
import type { Live2DError } from '../core/errors'

export type LoadingStage = 'core' | 'stage' | 'model'

export interface StageState {
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

interface InternalStageState extends StageState {
  backend: Live2DBackend | null
  stage: StageHandle | null
  layoutVersion: number
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
  private snapshot: InternalStageState

  constructor(retry: () => void) {
    this.snapshot = {
      backend: null,
      layoutVersion: 0,
      loadingStage: 'core',
      retry,
      stage: null,
      status: 'loading',
    }
  }

  readonly subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = () => this.snapshot

  private update(patch: Partial<InternalStageState>) {
    this.snapshot = { ...this.snapshot, ...patch }
    for (const listener of this.listeners)
      listener()
  }

  begin(loadingStage: LoadingStage) {
    if (this.structuralError)
      return
    this.update({
      error: undefined,
      loadingStage,
      status: 'loading',
    })
  }

  setStage(stage: StageHandle, backend: Live2DBackend) {
    const render = this.readRenderState(stage)
    if (this.structuralError) {
      this.update({ backend, render, stage })
      return
    }
    this.update({
      backend,
      error: undefined,
      loadingStage: this.modelOwner ? 'model' : undefined,
      render,
      stage,
      status: this.modelOwner ? 'loading' : 'ready',
    })
  }

  clearStage(stage: StageHandle) {
    if (this.snapshot.stage !== stage)
      return
    this.update({ backend: null, render: undefined, stage: null })
  }

  notifyLayout(stage: StageHandle) {
    this.update({
      layoutVersion: this.snapshot.layoutVersion + 1,
      render: this.readRenderState(stage),
    })
  }

  notifyResolution(stage: StageHandle) {
    this.update({ render: this.readRenderState(stage) })
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

  claimModel(owner: symbol): boolean {
    if (this.modelOwner && this.modelOwner !== owner)
      return false
    this.modelOwner = owner
    if (this.snapshot.stage && this.snapshot.status !== 'error')
      this.begin('model')
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
    if (this.snapshot.stage && this.snapshot.status !== 'error') {
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

  private readRenderState(stage: StageHandle) {
    const size = stage.getSize()
    const resolution = stage.getResolution()
    return {
      bufferPixels: Math.round(size.width * size.height * resolution ** 2),
      height: size.height,
      resolution,
      width: size.width,
    }
  }
}

interface ModelSnapshot {
  handle: ModelHandle | null
}

export class ModelStore {
  private listeners = new Set<Listener>()
  private snapshot: ModelSnapshot = { handle: null }

  readonly subscribe = (listener: Listener) => {
    this.listeners.add(listener)
    return () => this.listeners.delete(listener)
  }

  readonly getSnapshot = () => this.snapshot

  setHandle(handle: ModelHandle | null) {
    if (this.snapshot.handle === handle)
      return
    this.snapshot = { handle }
    for (const listener of this.listeners)
      listener()
  }
}
