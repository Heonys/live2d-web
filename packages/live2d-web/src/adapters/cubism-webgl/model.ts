import type { CubismIdHandle } from '#cubism-framework/id/cubismid'
import type { CubismMotion } from '#cubism-framework/motion/cubismmotion'
import type {
  LoadModelOptions,
  ModelHandle,
  ModelTransform,
  StageHandle,
} from '../../core/contract'
import type { CubismBenchmarkStageDiagnostics } from './diagnostics'
import type { LayoutBounds } from './types'
import { CubismDefaultParameterId } from '#cubism-framework/cubismdefaultparameterid'
import { CubismModelSettingJson } from '#cubism-framework/cubismmodelsettingjson'
import {
  BreathParameterData,
  CubismBreath,
} from '#cubism-framework/effect/cubismbreath'
import { CubismEyeBlink } from '#cubism-framework/effect/cubismeyeblink'
import {
  CubismLook,
  LookParameterData,
} from '#cubism-framework/effect/cubismlook'
import { CubismFramework } from '#cubism-framework/live2dcubismframework'
import { CubismModelMatrix } from '#cubism-framework/math/cubismmodelmatrix'
import { CubismUserModel } from '#cubism-framework/model/cubismusermodel'
import { ACubismMotion } from '#cubism-framework/motion/acubismmotion'
import { CubismBreathUpdater } from '#cubism-framework/motion/cubismbreathupdater'
import { CubismExpressionUpdater } from '#cubism-framework/motion/cubismexpressionupdater'
import { CubismEyeBlinkUpdater } from '#cubism-framework/motion/cubismeyeblinkupdater'
import { CubismLookUpdater } from '#cubism-framework/motion/cubismlookupdater'
import { CubismPhysicsUpdater } from '#cubism-framework/motion/cubismphysicsupdater'
import { CubismPoseUpdater } from '#cubism-framework/motion/cubismposeupdater'
import { CubismUpdateScheduler } from '#cubism-framework/motion/cubismupdatescheduler'
import { CubismUpdateOrder } from '#cubism-framework/motion/icubismupdater'
import { CubismWebGLOffscreenManager } from '#cubism-framework/rendering/cubismoffscreenmanager'
import { CubismShaderManager_WebGL } from '#cubism-framework/rendering/cubismshader_webgl'
import { Live2DError } from '../../core/errors'
import { createTexture, fetchArrayBuffer, resolveAssetUrl } from './assets'
import { measureAsync, measureSync } from './diagnostics'
import { acquireFramework } from './framework-manager'
import { buildMvpMatrix, measureLayout } from './matrix'
import { getStageInternals } from './stage'

const PRIORITY_IDLE = 1
const PRIORITY_FORCE = 3

function once(cleanup: () => void) {
  let active = true
  return () => {
    if (!active)
      return
    active = false
    cleanup()
  }
}

function asModelError(error: unknown, message: string) {
  return error instanceof Live2DError
    ? error
    : new Live2DError(
        'model-load-failed',
        error instanceof Error ? `${message}: ${error.message}` : message,
        { cause: error },
      )
}

class FrameworkModel extends CubismUserModel {
  private readonly afterMotionCallbacks = new Set<(deltaMs: number) => void>()
  private readonly assetController = new AbortController()
  private readonly expressionCache = new Map<string, Promise<ACubismMotion>>()
  private readonly loadedMotions = new Set<ACubismMotion>()
  private layoutMatrix: CubismModelMatrix | undefined
  private readonly manualParameters = new Map<string, number>()
  private readonly motionCache = new Map<string, Promise<CubismMotion>>()
  private readonly parameterIds = new Map<string, CubismIdHandle>()
  private readonly scheduler = new CubismUpdateScheduler()
  private readonly textures: WebGLTexture[] = []
  private readonly viewport = [0, 0, 1, 1]
  private bounds: LayoutBounds = { centerX: 0, centerY: 0, height: 1, width: 1 }
  private detachDriver: (() => void) | undefined
  private disposed = false
  private eyeBlinkIds: CubismIdHandle[] = []
  private idlePending = false
  private look: CubismLook | undefined
  private mvpDirty = true
  private motionUpdated = false
  private transform: ModelTransform = { scale: 1, x: 0, y: 0 }

  constructor(
    private readonly stage: StageHandle,
    private readonly modelUrl: string,
    private readonly setting: CubismModelSettingJson,
    private readonly shaderBaseUrl: string,
    private readonly shaderSources: Readonly<Record<string, string>> | undefined,
    private readonly releaseFramework: () => void,
    private readonly diagnostics?: CubismBenchmarkStageDiagnostics,
  ) {
    super()
  }

  private parameterId(id: string) {
    const cached = this.parameterIds.get(id)
    if (cached)
      return cached
    const value = CubismFramework.getIdManager().getId(id)
    this.parameterIds.set(id, value)
    return value
  }

  async initialize(signal?: AbortSignal) {
    const abortFromParent = () => this.assetController.abort(signal?.reason)
    if (signal?.aborted)
      abortFromParent()
    signal?.addEventListener('abort', abortFromParent, { once: true })
    try {
      const mocName = this.setting.getModelFileName()
      if (!mocName) {
        throw new Live2DError(
          'model-load-failed',
          'model3.json does not declare FileReferences.Moc.',
        )
      }
      const moc = await measureAsync(
        this.diagnostics,
        'mocFetch',
        () => fetchArrayBuffer(
          resolveAssetUrl(mocName, this.modelUrl),
          this.assetController.signal,
        ),
      )
      measureSync(this.diagnostics, 'load', 'mocParse', () => this.loadModel(moc, true))
      if (!this.getModel())
        throw new Live2DError('model-load-failed', 'Cubism Core rejected the moc3 model.')

      this.layoutMatrix = new CubismModelMatrix(
        this.getModel().getCanvasWidth(),
        this.getModel().getCanvasHeight(),
      )
      const layout = new Map<string, number>()
      this.setting.getLayoutMap(layout)
      this.layoutMatrix.setupFromLayout(layout)
      this.bounds = measureLayout({
        height: this.getModel().getCanvasHeight(),
        width: this.getModel().getCanvasWidth(),
      }, this.layoutMatrix)

      await measureAsync(
        this.diagnostics,
        'optionalAssets',
        () => this.loadOptionalAssets(),
      )
      this.setupEffects()
      await this.setupRenderer()
      this.getModel().saveParameters()

      const stageInternals = getStageInternals(this.stage)
      this.detachDriver = stageInternals.attachDriver({
        draw: () => this.draw(),
        resize: (width, height) => this.resize(width, height),
        update: deltaMs => this.updateFrame(deltaMs),
      })
    }
    finally {
      signal?.removeEventListener('abort', abortFromParent)
    }
  }

  private async loadOptionalAssets() {
    const signal = this.assetController.signal
    const physicsName = this.setting.getPhysicsFileName()
    const poseName = this.setting.getPoseFileName()
    const userDataName = this.setting.getUserDataFile()
    const [physics, pose, userData] = await Promise.all([
      physicsName
        ? fetchArrayBuffer(resolveAssetUrl(physicsName, this.modelUrl), signal)
        : undefined,
      poseName
        ? fetchArrayBuffer(resolveAssetUrl(poseName, this.modelUrl), signal)
        : undefined,
      userDataName
        ? fetchArrayBuffer(resolveAssetUrl(userDataName, this.modelUrl), signal)
        : undefined,
    ])
    if (physics)
      this.loadPhysics(physics, physics.byteLength)
    if (pose)
      this.loadPose(pose, pose.byteLength)
    if (userData)
      this.loadUserData(userData, userData.byteLength)
  }

  private setupEffects() {
    this.eyeBlinkIds = Array.from(
      { length: this.setting.getEyeBlinkParameterCount() },
      (_, index) => this.setting.getEyeBlinkParameterId(index),
    )

    if (this.eyeBlinkIds.length > 0) {
      this._eyeBlink = CubismEyeBlink.create(this.setting)
      this.scheduler.addUpdatableList(new CubismEyeBlinkUpdater(
        () => this.motionUpdated,
        this._eyeBlink,
        CubismUpdateOrder.CubismUpdateOrder_Expression,
      ))
    }

    this._breath = CubismBreath.create()
    this._breath.setParameters([
      new BreathParameterData(this.parameterId(CubismDefaultParameterId.ParamAngleX), 0, 15, 6.5345, 0.5),
      new BreathParameterData(this.parameterId(CubismDefaultParameterId.ParamAngleY), 0, 8, 3.5345, 0.5),
      new BreathParameterData(this.parameterId(CubismDefaultParameterId.ParamAngleZ), 0, 10, 5.5345, 0.5),
      new BreathParameterData(this.parameterId(CubismDefaultParameterId.ParamBodyAngleX), 0, 4, 15.5345, 0.5),
      new BreathParameterData(this.parameterId(CubismDefaultParameterId.ParamBreath), 0.5, 0.5, 3.2345, 1),
    ])
    this.scheduler.addUpdatableList(new CubismBreathUpdater(this._breath))

    if (this._physics)
      this.scheduler.addUpdatableList(new CubismPhysicsUpdater(this._physics))
    if (this._pose)
      this.scheduler.addUpdatableList(new CubismPoseUpdater(this._pose))
    if (this._expressionManager) {
      this.scheduler.addUpdatableList(new CubismExpressionUpdater(
        this._expressionManager,
        CubismUpdateOrder.CubismUpdateOrder_EyeBlink,
      ))
    }

    this.look = CubismLook.create()
    this.look.setParameters([
      new LookParameterData(this.parameterId(CubismDefaultParameterId.ParamAngleX), 30, 0, 0),
      new LookParameterData(this.parameterId(CubismDefaultParameterId.ParamAngleY), 0, 30, 0),
      new LookParameterData(this.parameterId(CubismDefaultParameterId.ParamAngleZ), 0, 0, -30),
      new LookParameterData(this.parameterId(CubismDefaultParameterId.ParamBodyAngleX), 10, 0, 0),
      new LookParameterData(this.parameterId(CubismDefaultParameterId.ParamEyeBallX), 1, 0, 0),
      new LookParameterData(this.parameterId(CubismDefaultParameterId.ParamEyeBallY), 0, 1, 0),
    ])
    this.scheduler.addUpdatableList(new CubismLookUpdater(this.look, this._dragManager))
    this.scheduler.sortUpdatableList()
  }

  private async setupRenderer() {
    const { canvas, gl } = getStageInternals(this.stage)
    this.createRenderer(canvas.width, canvas.height)
    const renderer = this.getRenderer()
    renderer.startUp(gl)
    renderer.setIsPremultipliedAlpha(true)
    try {
      await measureAsync(
        this.diagnostics,
        'shaderSetup',
        () => renderer.loadShaders(
          this.shaderBaseUrl,
          this.assetController.signal,
          this.shaderSources,
        ),
      )
    }
    catch (error) {
      throw new Live2DError(
        'render-error',
        error instanceof Error ? error.message : 'Cubism shader loading failed.',
        { cause: error },
      )
    }

    for (let index = 0; index < this.setting.getTextureCount(); index++) {
      const name = this.setting.getTextureFileName(index)
      if (!name) {
        throw new Live2DError(
          'model-load-failed',
          `model3.json declares an empty texture at index ${index}.`,
        )
      }
      const texture = await createTexture(
        gl,
        resolveAssetUrl(name, this.modelUrl),
        this.assetController.signal,
        this.diagnostics,
      )
      this.textures.push(texture)
      this.diagnostics?.changeResource('texture', 1)
      renderer.bindTexture(index, texture)
    }
  }

  private updateFrame(deltaMs: number) {
    if (this.disposed)
      return
    const deltaSeconds = deltaMs / 1_000
    if (!this.diagnostics) {
      this.getModel().loadParameters()
      this.motionUpdated = false
      if (this._motionManager.isFinished()) {
        this.scheduleIdle()
      }
      else {
        this.motionUpdated = this._motionManager.updateMotion(
          this.getModel(),
          deltaSeconds,
        )
      }
      this.getModel().saveParameters()
      this.scheduler.onLateUpdate(this.getModel(), deltaSeconds)
      for (const [id, value] of this.manualParameters)
        this.getModel().setParameterValueById(this.parameterId(id), value)
      for (const callback of this.afterMotionCallbacks)
        callback(deltaMs)
      this.getModel().update()
      return
    }
    measureSync(this.diagnostics, 'frame', 'motion', () => {
      this.getModel().loadParameters()
      this.motionUpdated = false
      if (this._motionManager.isFinished()) {
        this.scheduleIdle()
      }
      else {
        this.motionUpdated = this._motionManager.updateMotion(
          this.getModel(),
          deltaSeconds,
        )
      }
      this.getModel().saveParameters()
    })
    measureSync(this.diagnostics, 'frame', 'effectsPhysicsPose', () => {
      this.scheduler.onLateUpdate(this.getModel(), deltaSeconds)
    })
    measureSync(this.diagnostics, 'frame', 'manualParameters', () => {
      for (const [id, value] of this.manualParameters)
        this.getModel().setParameterValueById(this.parameterId(id), value)
    })
    measureSync(this.diagnostics, 'frame', 'externalDrivers', () => {
      for (const callback of this.afterMotionCallbacks)
        callback(deltaMs)
    })
    measureSync(this.diagnostics, 'frame', 'coreUpdate', () => {
      this.getModel().update()
    })
  }

  private scheduleIdle() {
    if (this.idlePending || this.setting.getMotionCount('Idle') === 0)
      return
    this.idlePending = true
    void this.playMotion('Idle', undefined, PRIORITY_IDLE)
      .catch((error) => {
        if (!this.disposed)
          getStageInternals(this.stage).reportError(asModelError(error, 'Idle motion failed'))
      })
      .finally(() => {
        this.idlePending = false
      })
  }

  private async loadMotionAsset(group: string, index: number) {
    const key = `${group}:${index}`
    const cached = this.motionCache.get(key)
    if (cached)
      return cached
    const promise = (async () => {
      this.diagnostics?.changeResource('pendingMotion', 1)
      try {
        const fileName = this.setting.getMotionFileName(group, index)
        const buffer = await fetchArrayBuffer(
          resolveAssetUrl(fileName, this.modelUrl),
          this.assetController.signal,
        )
        const motion = this.loadMotion(
          buffer,
          buffer.byteLength,
          key,
          undefined,
          undefined,
          this.setting,
          group,
          index,
          true,
        )
        if (!motion)
          throw new Live2DError('model-load-failed', `Failed to parse motion ${key}.`)
        motion.setEffectIds(this.eyeBlinkIds, [])
        this.loadedMotions.add(motion)
        return motion
      }
      finally {
        this.diagnostics?.changeResource('pendingMotion', -1)
      }
    })()
    this.motionCache.set(key, promise)
    promise.catch(() => this.motionCache.delete(key))
    return promise
  }

  private async playMotion(group: string, index: number | undefined, priority: number) {
    if (this.disposed)
      return
    const count = this.setting.getMotionCount(group)
    if (count === 0) {
      throw new Live2DError('invalid-props', `Unknown Live2D motion group: ${group}`)
    }
    const selected = index ?? Math.floor(Math.random() * count)
    if (!Number.isInteger(selected) || selected < 0 || selected >= count) {
      throw new Live2DError(
        'invalid-props',
        `Motion index ${selected} is outside group ${group}.`,
      )
    }
    if (priority === PRIORITY_FORCE)
      this._motionManager.setReservePriority(priority)
    else if (!this._motionManager.reserveMotion(priority))
      return

    try {
      const motion = await this.loadMotionAsset(group, selected)
      if (this.disposed)
        return
      this._motionManager.startMotionPriority(motion, false, priority)
    }
    catch (error) {
      if (this.disposed)
        return
      this._motionManager.setReservePriority(0)
      throw error
    }
  }

  private findExpression(id: string) {
    for (let index = 0; index < this.setting.getExpressionCount(); index++) {
      if (this.setting.getExpressionName(index) === id)
        return index
    }
    return -1
  }

  private async loadExpressionAsset(id: string, index: number) {
    const cached = this.expressionCache.get(id)
    if (cached)
      return cached
    const promise = (async () => {
      this.diagnostics?.changeResource('pendingExpression', 1)
      try {
        const buffer = await fetchArrayBuffer(
          resolveAssetUrl(this.setting.getExpressionFileName(index), this.modelUrl),
          this.assetController.signal,
        )
        const expression = this.loadExpression(buffer, buffer.byteLength, id)
        if (!expression) {
          throw new Live2DError(
            'model-load-failed',
            `Failed to parse expression ${id}.`,
          )
        }
        this.loadedMotions.add(expression)
        return expression
      }
      finally {
        this.diagnostics?.changeResource('pendingExpression', -1)
      }
    })()
    this.expressionCache.set(id, promise)
    promise.catch(() => this.expressionCache.delete(id))
    return promise
  }

  private draw() {
    if (this.disposed)
      return
    const { gl } = getStageInternals(this.stage)
    const offscreen = CubismWebGLOffscreenManager.getInstance()
    offscreen.beginFrameProcess(gl)
    try {
      const renderer = this.getRenderer()
      renderer.setRenderState(
        null as unknown as WebGLFramebuffer,
        this.viewport,
      )
      if (!this.layoutMatrix)
        return
      if (this.mvpDirty) {
        renderer.setMvpMatrix(buildMvpMatrix(
          this.stage.getSize(),
          this.transform,
          this.layoutMatrix,
          this.bounds,
        ))
        this.mvpDirty = false
      }
      renderer.drawModel(this.shaderBaseUrl)
    }
    finally {
      offscreen.endFrameProcess(gl)
      offscreen.releaseStaleRenderTextures(gl)
    }
  }

  private resize(width: number, height: number) {
    this.viewport[2] = width
    this.viewport[3] = height
    this.mvpDirty = true
    this.setRenderTargetSize(width, height)
  }

  toHandle(): ModelHandle {
    return {
      dispose: () => this.disposeModel(),
      expression: async (id) => {
        const count = this.setting.getExpressionCount()
        if (count === 0) {
          if (id)
            throw new Live2DError('invalid-props', `Unknown Live2D expression: ${id}`)
          return
        }
        const selectedId = id ?? this.setting.getExpressionName(Math.floor(Math.random() * count))
        const index = this.findExpression(selectedId)
        if (index < 0)
          throw new Live2DError('invalid-props', `Unknown Live2D expression: ${selectedId}`)
        try {
          const expression = await this.loadExpressionAsset(selectedId, index)
          if (!this.disposed)
            this._expressionManager.startMotion(expression, false)
        }
        catch (error) {
          if (!this.disposed)
            throw error
        }
      },
      focus: (x, y) => {
        const size = this.stage.getSize()
        this.setDragging(
          Math.max(-1, Math.min(1, x / Math.max(1, size.width) * 2 - 1)),
          Math.max(-1, Math.min(1, 1 - y / Math.max(1, size.height) * 2)),
        )
      },
      getIntrinsicSize: () => ({ height: this.bounds.height, width: this.bounds.width }),
      getParameter: id => this.getModel().getParameterValueById(this.parameterId(id)),
      motion: (group, index) => this.playMotion(group, index, PRIORITY_FORCE),
      onAfterMotionUpdate: (callback) => {
        this.afterMotionCallbacks.add(callback)
        return once(() => this.afterMotionCallbacks.delete(callback))
      },
      setParameter: (id, value) => {
        if (!this.disposed) {
          this.manualParameters.set(id, value)
          this.getModel().setParameterValueById(this.parameterId(id), value)
        }
      },
      setTransform: (transform) => {
        this.transform = { ...transform }
        this.mvpDirty = true
      },
    }
  }

  private disposeModel() {
    if (this.disposed)
      return
    this.disposed = true
    this.assetController.abort(new DOMException('Model disposed', 'AbortError'))
    this.detachDriver?.()
    this.detachDriver = undefined
    this.afterMotionCallbacks.clear()
    this.scheduler.release()
    if (this.look)
      CubismLook.delete(this.look)
    this.look = undefined
    const { gl } = getStageInternals(this.stage)
    for (const texture of this.textures)
      gl.deleteTexture(texture)
    if (this.textures.length > 0) {
      for (let index = 0; index < this.textures.length; index++)
        this.diagnostics?.changeResource('texture', -1)
    }
    this.textures.length = 0
    this.motionCache.clear()
    this.expressionCache.clear()
    this.manualParameters.clear()
    this.setting.release()
    super.release()
    for (const motion of this.loadedMotions)
      ACubismMotion.delete(motion)
    this.loadedMotions.clear()
    CubismWebGLOffscreenManager.getInstance().removeContext(gl)
    CubismShaderManager_WebGL.getInstance().releaseContext(gl)
    this.releaseFramework()
  }
}

export async function loadFrameworkModel(
  stage: StageHandle,
  url: string,
  shaderBaseUrl: string,
  shaderSources: Readonly<Record<string, string>> | undefined,
  options: LoadModelOptions = {},
) {
  const diagnostics = getStageInternals(stage).diagnostics
  const releaseFramework = acquireFramework(diagnostics)
  const readyStartedAt = diagnostics ? performance.now() : 0
  let model: FrameworkModel | undefined
  try {
    const modelUrl = new URL(url, window.location.href).href
    const modelJson = await measureAsync(
      diagnostics,
      'modelJsonFetch',
      () => fetchArrayBuffer(modelUrl, options.signal),
    )
    const setting = measureSync(
      diagnostics,
      'load',
      'modelJsonParse',
      () => new CubismModelSettingJson(modelJson, modelJson.byteLength),
    )
    model = new FrameworkModel(
      stage,
      modelUrl,
      setting,
      shaderBaseUrl,
      shaderSources,
      releaseFramework,
      diagnostics,
    )
    await model.initialize(options.signal)
    if (diagnostics)
      diagnostics.loadPhase('ready', performance.now() - readyStartedAt)
    return model.toHandle()
  }
  catch (error) {
    if (model)
      model.toHandle().dispose()
    else
      releaseFramework()
    if (options.signal?.aborted)
      throw options.signal.reason
    throw asModelError(error, `Failed to load ${url}`)
  }
}
