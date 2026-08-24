import type { CubismIdHandle } from '#cubism-framework/id/cubismid'
import type { CubismMatrix44 } from '#cubism-framework/math/cubismmatrix44'
import type { CubismMotion } from '#cubism-framework/motion/cubismmotion'
import type { CubismMotionQueueEntryHandle } from '#cubism-framework/motion/cubismmotionqueuemanager'
import type {
  Live2DAssetResolver,
  LoadModelOptions,
  ModelHandle,
  ModelInfo,
  ModelTransform,
  MotionPlaybackResult,
  MotionPriority,
  StageHandle,
} from '../../core/contract'
import type { Live2DAssetType, Live2DErrorDetails } from '../../core/errors'
import type { ResolvedExpressionFade } from '../../core/expression-options'
import type { ResolvedIdleMotion } from '../../core/idle-motion'
import type { ResolvedMotionFade } from '../../core/motion-options'
import type { CubismBenchmarkStageDiagnostics } from './diagnostics'
import type { CachedMotionAsset, PlaybackMotion } from './motion-playback'
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
import { InvalidMotionQueueEntryHandleValue } from '#cubism-framework/motion/cubismmotionqueuemanager'
import { CubismPhysicsUpdater } from '#cubism-framework/motion/cubismphysicsupdater'
import { CubismPoseUpdater } from '#cubism-framework/motion/cubismposeupdater'
import { CubismUpdateScheduler } from '#cubism-framework/motion/cubismupdatescheduler'
import { CubismUpdateOrder } from '#cubism-framework/motion/icubismupdater'
import { CubismWebGLOffscreenManager } from '#cubism-framework/rendering/cubismoffscreenmanager'
import { CubismShaderManager_WebGL } from '#cubism-framework/rendering/cubismshader_webgl'
import { Live2DError } from '../../core/errors'
import { resolveExpressionFade } from '../../core/expression-options'
import { resolveIdleMotion, selectIdleMotionIndex } from '../../core/idle-motion'
import { resolveMotionFade, validateMotionOptions } from '../../core/motion-options'
import {
  closeTextureSource,
  fetchArrayBuffer,
  fetchTextureSource,
  resolveAssetUrl,
  uploadTexture,
  virtualModelUrl,
} from './assets'
import { measureAsync, measureSync } from './diagnostics'
import { parseShaderErrorDetails } from './error-details'
import { acquireFramework } from './framework-manager'
import { buildMvpMatrix, measureLayout } from './matrix'
import { preparePlaybackMotion } from './motion-playback'
import { MotionStateTracker } from './motion-state'
import { getStageInternals } from './stage'

const PRIORITY_IDLE = 1
const PRIORITY_FORCE = 3
const PREFETCH_DELAY_MS = 1_000
const MOTION_PRIORITIES: Record<MotionPriority, number> = {
  force: 3,
  idle: 1,
  normal: 2,
}

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

function modelAssetDetails(
  assetType: Live2DAssetType,
  url?: string,
): Live2DErrorDetails {
  return { assetType, backend: 'cubism-webgl', url }
}

class FrameworkModel extends CubismUserModel {
  private readonly afterMotionCallbacks = new Set<(deltaMs: number) => void>()
  private readonly assetController = new AbortController()
  private readonly expressionCache = new Map<string, Promise<CachedMotionAsset<ACubismMotion>>>()
  private readonly loadedMotions = new Set<ACubismMotion>()
  private layoutMatrix: CubismModelMatrix | undefined
  private readonly manualParameters = new Map<string, number>()
  private mvpMatrix: CubismMatrix44 | undefined
  private readonly motionCache = new Map<string, Promise<CachedMotionAsset<CubismMotion>>>()
  private readonly motionStates = new MotionStateTracker<CubismMotionQueueEntryHandle>()
  private readonly parameterIds = new Map<string, CubismIdHandle>()
  // Held so dispose() can release GL state without asking the stage, which
  // throws once the stage itself is gone.
  private renderContext: WebGL2RenderingContext | undefined
  // Set once the stage reports a render error. The frame loop never restarts
  // after that, so motions can no longer finish on their own.
  private renderError: Live2DError | undefined
  private stopErrorWatch: (() => void) | undefined
  // Keys of in-flight loads. Dispose settles their diagnostics counters
  // synchronously; the late finally skips keys that were already settled.
  private readonly pendingExpressionKeys = new Set<string>()
  private readonly pendingMotionKeys = new Set<string>()
  private readonly scheduler = new CubismUpdateScheduler()
  private readonly textures: WebGLTexture[] = []
  private readonly viewport = [0, 0, 1, 1]
  private bounds: LayoutBounds = { centerX: 0, centerY: 0, height: 1, width: 1 }
  private detachDriver: (() => void) | undefined
  private disposed = false
  private expressionGeneration = 0
  private eyeBlinkIds: CubismIdHandle[] = []
  private idlePending = false
  private look: CubismLook | undefined
  private mvpDirty = true
  private motionUpdated = false
  private motionGeneration = 0
  private transform: ModelTransform = { scale: 1, x: 0, y: 0 }

  constructor(
    private readonly stage: StageHandle,
    private readonly modelUrl: string,
    private readonly setting: CubismModelSettingJson,
    private readonly shaderBaseUrl: string,
    private readonly shaderSources: Readonly<Record<string, string>> | undefined,
    private readonly idleMotion: ResolvedIdleMotion | false,
    private readonly releaseFramework: () => void,
    private readonly diagnostics?: CubismBenchmarkStageDiagnostics,
    private readonly resolveAsset?: Live2DAssetResolver,
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
          { details: modelAssetDetails('model3', this.modelUrl) },
        )
      }
      const mocUrl = resolveAssetUrl(mocName, this.modelUrl)
      const moc = await measureAsync(
        this.diagnostics,
        'mocFetch',
        () => fetchArrayBuffer(
          mocUrl,
          'moc3',
          this.assetController.signal,
          this.resolveAsset,
        ),
      )
      try {
        measureSync(this.diagnostics, 'load', 'mocParse', () => this.loadModel(moc, true))
      }
      catch (error) {
        throw new Live2DError(
          'model-load-failed',
          `Failed to parse moc3 asset ${mocUrl}.`,
          { cause: error, details: modelAssetDetails('moc3', mocUrl) },
        )
      }
      if (!this.getModel()) {
        throw new Live2DError(
          'model-load-failed',
          'Cubism Core rejected the moc3 model.',
          { details: modelAssetDetails('moc3', mocUrl) },
        )
      }

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
      this.stopErrorWatch = this.stage.onError(error => this.failMotions(error))
      // Warm the Idle group in the background so the first idle playback does
      // not stall on a network round trip after ready.
      void this.prefetchIdleMotions()
    }
    finally {
      signal?.removeEventListener('abort', abortFromParent)
    }
  }

  private async prefetchIdleMotions() {
    // Delay so rapid mount/dispose cycles (StrictMode replays, benchmark
    // remounts) never issue fetches that are aborted immediately and congest
    // the asset server while the next generation is loading. The first idle
    // playback is already covered by scheduleIdle().
    await new Promise<void>((resolve) => {
      let timeout: ReturnType<typeof setTimeout>
      const onAbort = () => {
        clearTimeout(timeout)
        resolve()
      }
      timeout = setTimeout(() => {
        this.assetController.signal.removeEventListener('abort', onAbort)
        resolve()
      }, PREFETCH_DELAY_MS)
      this.assetController.signal.addEventListener('abort', onAbort, { once: true })
    })
    // The delay may have been cut short by dispose; the settings object is
    // released at that point, so bail out before touching it.
    if (this.disposed || this.idleMotion === false)
      return
    const count = this.setting.getMotionCount(this.idleMotion.group)
    for (let index = 0; index < count; index++) {
      if (this.disposed)
        return
      try {
        await this.loadMotionAsset(this.idleMotion.group, index)
      }
      catch {
        // Prefetch is best-effort; playback surfaces real failures.
      }
    }
  }

  private async loadOptionalAssets() {
    const signal = this.assetController.signal
    const physicsName = this.setting.getPhysicsFileName()
    const poseName = this.setting.getPoseFileName()
    const userDataName = this.setting.getUserDataFile()
    const physicsUrl = physicsName
      ? resolveAssetUrl(physicsName, this.modelUrl)
      : undefined
    const poseUrl = poseName
      ? resolveAssetUrl(poseName, this.modelUrl)
      : undefined
    const userDataUrl = userDataName
      ? resolveAssetUrl(userDataName, this.modelUrl)
      : undefined
    const [physics, pose, userData] = await Promise.all([
      physicsUrl
        ? fetchArrayBuffer(physicsUrl, 'physics', signal, this.resolveAsset)
        : undefined,
      poseUrl
        ? fetchArrayBuffer(poseUrl, 'pose', signal, this.resolveAsset)
        : undefined,
      userDataUrl
        ? fetchArrayBuffer(userDataUrl, 'user-data', signal, this.resolveAsset)
        : undefined,
    ])
    try {
      if (physics)
        this.loadPhysics(physics, physics.byteLength)
    }
    catch (error) {
      throw new Live2DError(
        'model-load-failed',
        `Failed to parse physics asset ${physicsUrl}.`,
        { cause: error, details: modelAssetDetails('physics', physicsUrl) },
      )
    }
    try {
      if (pose)
        this.loadPose(pose, pose.byteLength)
    }
    catch (error) {
      throw new Live2DError(
        'model-load-failed',
        `Failed to parse pose asset ${poseUrl}.`,
        { cause: error, details: modelAssetDetails('pose', poseUrl) },
      )
    }
    try {
      if (userData)
        this.loadUserData(userData, userData.byteLength)
    }
    catch (error) {
      throw new Live2DError(
        'model-load-failed',
        `Failed to parse user data asset ${userDataUrl}.`,
        { cause: error, details: modelAssetDetails('user-data', userDataUrl) },
      )
    }
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
    this.renderContext = gl
    this.createRenderer(canvas.width, canvas.height)
    const renderer = this.getRenderer()
    renderer.startUp(gl)
    renderer.setIsPremultipliedAlpha(true)

    const textureUrls: string[] = []
    for (let index = 0; index < this.setting.getTextureCount(); index++) {
      const name = this.setting.getTextureFileName(index)
      if (!name) {
        throw new Live2DError(
          'model-load-failed',
          `model3.json declares an empty texture at index ${index}.`,
          { details: modelAssetDetails('texture', this.modelUrl) },
        )
      }
      textureUrls.push(resolveAssetUrl(name, this.modelUrl))
    }
    // Start every texture fetch/decode before the synchronous shader compile
    // so network and image decoding overlap the main-thread compile time.
    const sourcePromises = textureUrls.map(url => fetchTextureSource(
      url,
      this.assetController.signal,
      this.diagnostics,
      this.resolveAsset,
    ))
    for (const promise of sourcePromises)
      promise.catch(() => {})
    const closeAllSources = async () => {
      await Promise.allSettled(sourcePromises.map(
        async promise => closeTextureSource(await promise),
      ))
    }

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
      await closeAllSources()
      if (error instanceof Live2DError)
        throw error
      throw new Live2DError(
        'render-error',
        error instanceof Error ? error.message : 'Cubism shader loading failed.',
        { cause: error, details: parseShaderErrorDetails(error) },
      )
    }

    try {
      for (let index = 0; index < sourcePromises.length; index++) {
        const source = await sourcePromises[index]
        if (this.assetController.signal.aborted) {
          closeTextureSource(source)
          throw this.assetController.signal.reason
        }
        const texture = uploadTexture(gl, source, textureUrls[index], this.diagnostics)
        this.textures.push(texture)
        this.diagnostics?.changeResource('texture', 1)
        renderer.bindTexture(index, texture)
      }
    }
    catch (error) {
      // Decoded bitmaps that never reached uploadTexture must still close.
      await closeAllSources()
      throw error
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
      this.settleFinishedMotions()
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
    this.settleFinishedMotions()
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
    if (this.idleMotion === false || this.idlePending)
      return
    const { group, weights } = this.idleMotion
    const count = this.setting.getMotionCount(group)
    if (count === 0)
      return
    this.idlePending = true
    void this.playMotion(
      group,
      selectIdleMotionIndex(count, weights),
      PRIORITY_IDLE,
    )
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
      this.pendingMotionKeys.add(key)
      this.diagnostics?.changeResource('pendingMotion', 1)
      try {
        const fileName = this.setting.getMotionFileName(group, index)
        const motionUrl = resolveAssetUrl(fileName, this.modelUrl)
        const buffer = await fetchArrayBuffer(
          motionUrl,
          'motion',
          this.assetController.signal,
          this.resolveAsset,
        )
        const motion = this.parseMotion(buffer, key, group, index, motionUrl)
        this.loadedMotions.add(motion)
        return { buffer, motion }
      }
      finally {
        if (this.pendingMotionKeys.delete(key))
          this.diagnostics?.changeResource('pendingMotion', -1)
      }
    })()
    this.motionCache.set(key, promise)
    promise.catch(() => this.motionCache.delete(key))
    return promise
  }

  private parseMotion(
    buffer: ArrayBuffer,
    key: string,
    group: string,
    index: number,
    motionUrl = resolveAssetUrl(this.setting.getMotionFileName(group, index), this.modelUrl),
  ) {
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
    if (!motion) {
      throw new Live2DError(
        'model-load-failed',
        `Failed to parse motion ${key}.`,
        { details: modelAssetDetails('motion', motionUrl) },
      )
    }
    motion.setEffectIds(this.eyeBlinkIds, [])
    return motion
  }

  private motionGroupNames() {
    return Array.from(
      { length: this.setting.getMotionGroupCount() },
      (_, index) => this.setting.getMotionGroupName(index),
    )
  }

  private failMotions(error: Live2DError) {
    this.renderError ??= error
    this.motionStates.fail(this.renderError)
  }

  private settleFinishedMotions() {
    this.motionStates.settleFinished(
      handle => this._motionManager.isFinishedByHandle(handle),
    )
  }

  private async playMotion(
    group: string,
    index: number | undefined,
    priority: number,
    fade: ResolvedMotionFade = {},
  ): Promise<MotionPlaybackResult> {
    if (this.disposed)
      return { status: 'disposed' }
    if (this.renderError)
      throw this.renderError
    const count = this.setting.getMotionCount(group)
    if (count === 0) {
      throw new Live2DError(
        'invalid-props',
        `Unknown Live2D motion group: ${group}. Available groups: ${
          this.motionGroupNames().join(', ') || '(none)'}`,
      )
    }
    const selected = index ?? Math.floor(Math.random() * count)
    if (!Number.isInteger(selected) || selected < 0 || selected >= count) {
      throw new Live2DError(
        'invalid-props',
        `Motion index ${selected} is outside group ${group} (0-${count - 1}).`,
      )
    }
    if (priority === PRIORITY_FORCE)
      this._motionManager.setReservePriority(priority)
    else if (!this._motionManager.reserveMotion(priority))
      return { status: 'skipped' }

    const generation = ++this.motionGeneration
    let handle: CubismMotionQueueEntryHandle
    let playback: PlaybackMotion<CubismMotion> | undefined
    try {
      const asset = await this.loadMotionAsset(group, selected)
      if (this.disposed)
        return { status: 'disposed' }
      if (generation !== this.motionGeneration)
        return { status: 'skipped' }
      playback = preparePlaybackMotion(
        asset,
        fade,
        buffer => this.parseMotion(buffer, `${group}:${selected}`, group, selected),
        motion => ACubismMotion.delete(motion),
      )
      handle = this._motionManager.startMotionPriority(
        playback.motion,
        playback.autoDelete,
        priority,
      )
      if (handle === InvalidMotionQueueEntryHandleValue) {
        playback.releaseBeforeStart()
        return { status: 'skipped' }
      }
      playback.transferToQueue()
      this.motionStates.interruptActive()
    }
    catch (error) {
      playback?.releaseBeforeStart()
      if (this.disposed)
        return { status: 'disposed' }
      if (generation === this.motionGeneration)
        this._motionManager.setReservePriority(0)
      throw error
    }
    return this.motionStates.track(handle)
  }

  private hitTestStagePoint(x: number, y: number): string[] {
    if (this.disposed || !this.layoutMatrix)
      return []
    if (!this.mvpMatrix || this.mvpDirty) {
      // Rebuild for querying but keep mvpDirty so draw() still refreshes the
      // renderer copy on the next frame.
      this.mvpMatrix = buildMvpMatrix(
        this.stage.getSize(),
        this.transform,
        this.layoutMatrix,
        this.bounds,
      )
    }
    const size = this.stage.getSize()
    const ndcX = x / Math.max(1, size.width) * 2 - 1
    const ndcY = 1 - y / Math.max(1, size.height) * 2
    const modelX = this.mvpMatrix.invertTransformX(ndcX)
    const modelY = this.mvpMatrix.invertTransformY(ndcY)
    const hits: string[] = []
    for (let area = 0; area < this.setting.getHitAreasCount(); area++) {
      const drawableIndex = this.getModel().getDrawableIndex(this.setting.getHitAreaId(area))
      if (drawableIndex < 0 || this.getModel().getDrawableOpacity(drawableIndex) <= 0)
        continue
      const vertexCount = this.getModel().getDrawableVertexCount(drawableIndex)
      const vertices = this.getModel().getDrawableVertices(drawableIndex)
      if (vertexCount === 0)
        continue
      let left = vertices[0]
      let right = vertices[0]
      let bottom = vertices[1]
      let top = vertices[1]
      for (let vertex = 1; vertex < vertexCount; vertex++) {
        const vx = vertices[vertex * 2]
        const vy = vertices[vertex * 2 + 1]
        left = Math.min(left, vx)
        right = Math.max(right, vx)
        bottom = Math.min(bottom, vy)
        top = Math.max(top, vy)
      }
      if (modelX >= left && modelX <= right && modelY >= bottom && modelY <= top)
        hits.push(this.setting.getHitAreaName(area))
    }
    return hits
  }

  private readModelInfo(): ModelInfo {
    const motions: Record<string, number> = {}
    for (const group of this.motionGroupNames())
      motions[group] = this.setting.getMotionCount(group)
    return {
      expressions: Array.from(
        { length: this.setting.getExpressionCount() },
        (_, index) => this.setting.getExpressionName(index),
      ),
      hitAreas: Array.from(
        { length: this.setting.getHitAreasCount() },
        (_, index) => this.setting.getHitAreaName(index),
      ),
      motions,
      parameters: Array.from(
        { length: this.getModel().getParameterCount() },
        (_, index) => ({
          defaultValue: this.getModel().getParameterDefaultValue(index),
          id: this.getModel().getParameterId(index).getString(),
          maximum: this.getModel().getParameterMaximumValue(index),
          minimum: this.getModel().getParameterMinimumValue(index),
        }),
      ),
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
      this.pendingExpressionKeys.add(id)
      this.diagnostics?.changeResource('pendingExpression', 1)
      try {
        const expressionUrl = resolveAssetUrl(
          this.setting.getExpressionFileName(index),
          this.modelUrl,
        )
        const buffer = await fetchArrayBuffer(
          expressionUrl,
          'expression',
          this.assetController.signal,
          this.resolveAsset,
        )
        const expression = this.parseExpression(buffer, id, expressionUrl)
        this.loadedMotions.add(expression)
        return { buffer, motion: expression }
      }
      finally {
        if (this.pendingExpressionKeys.delete(id))
          this.diagnostics?.changeResource('pendingExpression', -1)
      }
    })()
    this.expressionCache.set(id, promise)
    promise.catch(() => this.expressionCache.delete(id))
    return promise
  }

  private parseExpression(
    buffer: ArrayBuffer,
    id: string,
    expressionUrl = resolveAssetUrl(this.setting.getExpressionFileName(
      this.findExpression(id),
    ), this.modelUrl),
  ) {
    const expression = this.loadExpression(buffer, buffer.byteLength, id)
    if (!expression) {
      throw new Live2DError(
        'model-load-failed',
        `Failed to parse expression ${id}.`,
        { details: modelAssetDetails('expression', expressionUrl) },
      )
    }
    return expression
  }

  private async playExpression(
    id: string,
    index: number,
    fade: ResolvedExpressionFade,
  ) {
    const generation = ++this.expressionGeneration
    let playback: PlaybackMotion<ACubismMotion> | undefined
    try {
      const asset = await this.loadExpressionAsset(id, index)
      if (this.disposed || generation !== this.expressionGeneration)
        return
      playback = preparePlaybackMotion(
        asset,
        fade,
        buffer => this.parseExpression(buffer, id),
        expression => ACubismMotion.delete(expression),
      )
      const handle = this._expressionManager.startMotion(
        playback.motion,
        playback.autoDelete,
      )
      if (handle === InvalidMotionQueueEntryHandleValue) {
        playback.releaseBeforeStart()
        return
      }
      playback.transferToQueue()
    }
    catch (error) {
      playback?.releaseBeforeStart()
      if (!this.disposed)
        throw error
    }
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
      if (this.mvpDirty || !this.mvpMatrix) {
        this.mvpMatrix = buildMvpMatrix(
          this.stage.getSize(),
          this.transform,
          this.layoutMatrix,
          this.bounds,
        )
        this.mvpDirty = false
        renderer.setMvpMatrix(this.mvpMatrix)
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
      clearExpression: () => {
        if (!this.disposed) {
          this.expressionGeneration++
          this._expressionManager.stopAllMotions()
        }
      },
      clearParameter: (id) => {
        this.manualParameters.delete(id)
      },
      dispose: () => this.disposeModel(),
      expression: async (id, options) => {
        const fade = resolveExpressionFade(options)
        const count = this.setting.getExpressionCount()
        if (count === 0) {
          if (id)
            throw new Live2DError('invalid-props', `Unknown Live2D expression: ${id}`)
          return
        }
        const selectedId = id ?? this.setting.getExpressionName(Math.floor(Math.random() * count))
        const index = this.findExpression(selectedId)
        if (index < 0) {
          throw new Live2DError(
            'invalid-props',
            `Unknown Live2D expression: ${selectedId}. Available: ${
              this.readModelInfo().expressions.join(', ')}`,
          )
        }
        await this.playExpression(selectedId, index, fade)
      },
      focus: (x, y) => {
        const size = this.stage.getSize()
        this.setDragging(
          Math.max(-1, Math.min(1, x / Math.max(1, size.width) * 2 - 1)),
          Math.max(-1, Math.min(1, 1 - y / Math.max(1, size.height) * 2)),
        )
      },
      getIntrinsicSize: () => ({ height: this.bounds.height, width: this.bounds.width }),
      getModelInfo: () => this.readModelInfo(),
      getParameter: id => this.getModel().getParameterValueById(this.parameterId(id)),
      hitTest: (x, y) => this.hitTestStagePoint(x, y),
      isMotionPlaying: () => !this.disposed && !this._motionManager.isFinished(),
      motion: async (group, index, options) => {
        validateMotionOptions(options)
        const fade = resolveMotionFade(options)
        await this.playMotion(
          group,
          index,
          MOTION_PRIORITIES[options?.priority ?? 'force'],
          fade,
        )
      },
      playMotion: (group, index, options) => {
        validateMotionOptions(options)
        const fade = resolveMotionFade(options)
        return this.playMotion(
          group,
          index,
          MOTION_PRIORITIES[options?.priority ?? 'force'],
          fade,
        )
      },
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
    this.motionGeneration++
    this.expressionGeneration++
    this.assetController.abort(new DOMException('Model disposed', 'AbortError'))
    // The abort settles fetch rejections asynchronously, so reconcile the
    // in-flight load counters now to keep dispose-time diagnostics exact.
    for (let i = this.pendingMotionKeys.size; i > 0; i--)
      this.diagnostics?.changeResource('pendingMotion', -1)
    this.pendingMotionKeys.clear()
    for (let i = this.pendingExpressionKeys.size; i > 0; i--)
      this.diagnostics?.changeResource('pendingExpression', -1)
    this.pendingExpressionKeys.clear()
    this.motionStates.dispose()
    this.detachDriver?.()
    this.detachDriver = undefined
    this.stopErrorWatch?.()
    this.stopErrorWatch = undefined
    this.afterMotionCallbacks.clear()
    this.scheduler.release()
    if (this.look)
      CubismLook.delete(this.look)
    this.look = undefined
    // Never ask the stage for the context here: dispose must stay total even
    // when the stage was torn down first, as it is when a load is aborted.
    const gl = this.renderContext
    this.renderContext = undefined
    try {
      if (gl) {
        for (const texture of this.textures)
          gl.deleteTexture(texture)
      }
      for (let index = 0; index < this.textures.length; index++)
        this.diagnostics?.changeResource('texture', -1)
      this.textures.length = 0
      this.motionCache.clear()
      this.expressionCache.clear()
      this.manualParameters.clear()
      this.setting.release()
      super.release()
      for (const motion of this.loadedMotions)
        ACubismMotion.delete(motion)
      this.loadedMotions.clear()
      if (gl) {
        // Map-keyed registries, so this drops the compiled programs and the
        // dead context itself even after the context is lost.
        CubismWebGLOffscreenManager.getInstance().removeContext(gl)
        CubismShaderManager_WebGL.getInstance().releaseContext(gl)
      }
    }
    finally {
      this.releaseFramework()
    }
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
    // With a resolver the model has no origin of its own; assets resolve
    // against a reserved host so relative paths keep browser semantics.
    const modelUrl = options.resolveAsset
      ? virtualModelUrl(url)
      : new URL(url, window.location.href).href
    const modelJson = await measureAsync(
      diagnostics,
      'modelJsonFetch',
      () => fetchArrayBuffer(modelUrl, 'model3', options.signal, options.resolveAsset),
    )
    let setting: CubismModelSettingJson
    try {
      setting = measureSync(
        diagnostics,
        'load',
        'modelJsonParse',
        () => new CubismModelSettingJson(modelJson, modelJson.byteLength),
      )
    }
    catch (error) {
      throw new Live2DError(
        'model-load-failed',
        `Failed to parse model3.json ${modelUrl}.`,
        { cause: error, details: modelAssetDetails('model3', modelUrl) },
      )
    }
    const idleMotion = resolveIdleMotion(
      options.idleMotion,
      group => setting.getMotionCount(group),
    )
    model = new FrameworkModel(
      stage,
      modelUrl,
      setting,
      shaderBaseUrl,
      shaderSources,
      idleMotion,
      releaseFramework,
      diagnostics,
      options.resolveAsset,
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
