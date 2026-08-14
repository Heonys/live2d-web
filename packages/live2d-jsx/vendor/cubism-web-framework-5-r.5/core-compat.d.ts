/**
 * Minimal ambient contract consumed by the vendored Cubism Web Framework.
 * The Cubism Core implementation and its official declaration file are not
 * distributed by live2d-web; applications provide Core 5.3 at runtime.
 */
declare namespace Live2DCubismCore {
  type csmLogFunction = (message: string) => void
  type csmMocVersion = number
  type csmParameterType = number
  type csmVersion = number

  const AlphaBlendType_Atop: number
  const AlphaBlendType_ConjointOver: number
  const AlphaBlendType_DisjointOver: number
  const AlphaBlendType_Out: number
  const AlphaBlendType_Over: number
  const ColorBlendType_Add: number
  const ColorBlendType_AddCompatible: number
  const ColorBlendType_AddGlow: number
  const ColorBlendType_Color: number
  const ColorBlendType_ColorBurn: number
  const ColorBlendType_ColorDodge: number
  const ColorBlendType_Darken: number
  const ColorBlendType_HardLight: number
  const ColorBlendType_Hue: number
  const ColorBlendType_Lighten: number
  const ColorBlendType_LinearBurn: number
  const ColorBlendType_LinearLight: number
  const ColorBlendType_Multiply: number
  const ColorBlendType_MultiplyCompatible: number
  const ColorBlendType_Normal: number
  const ColorBlendType_Overlay: number
  const ColorBlendType_Screen: number
  const ColorBlendType_SoftLight: number
  const MocVersion_53: number

  class Version {
    static csmGetLatestMocVersion(): csmMocVersion
    static csmGetMocVersion(mocBytes: ArrayBuffer): csmMocVersion
    static csmGetVersion(): csmVersion
  }

  class Logging {
    static csmGetLogFunction(): csmLogFunction
    static csmSetLogFunction(handler: csmLogFunction): void
  }

  class Memory {
    static initializeAmountOfMemory(size: number): void
  }

  class Moc {
    static fromArrayBuffer(buffer: ArrayBuffer): Moc
    _ptr: number
    _release(): void
    hasMocConsistency(mocBytes: ArrayBuffer): number
  }

  class CanvasInfo {
    CanvasHeight: number
    CanvasOriginX: number
    CanvasOriginY: number
    CanvasWidth: number
    PixelsPerUnit: number
  }

  class Parameters {
    count: number
    defaultValues: Float32Array
    ids: string[]
    keyCounts: Int32Array
    keyValues: Float32Array[]
    maximumValues: Float32Array
    minimumValues: Float32Array
    repeats: Int32Array
    types: Int32Array
    values: Float32Array
  }

  class Parts {
    count: number
    ids: string[]
    offscreenIndices: Int32Array
    opacities: Float32Array
    parentIndices: Int32Array
  }

  class Drawables {
    blendModes: Int32Array
    constantFlags: Uint8Array
    count: number
    drawOrders: Int32Array
    dynamicFlags: Uint8Array
    ids: string[]
    indexCounts: Int32Array
    indices: Uint16Array[]
    maskCounts: Int32Array
    masks: Int32Array[]
    multiplyColors: Float32Array
    opacities: Float32Array
    parentPartIndices: Int32Array
    renderOrders: Int32Array
    screenColors: Float32Array
    textureIndices: Int32Array
    vertexCounts: Int32Array
    vertexPositions: Float32Array[]
    vertexUvs: Float32Array[]
    resetDynamicFlags(): void
  }

  class Offscreens {
    blendModes: Int32Array
    constantFlags: Uint8Array
    count: number
    maskCounts: Int32Array
    masks: Int32Array[]
    multiplyColors: Float32Array
    opacities: Float32Array
    ownerIndices: Int32Array
    screenColors: Float32Array
  }

  class Model {
    static fromMoc(moc: Moc): Model
    canvasinfo: CanvasInfo
    drawables: Drawables
    offscreens: Offscreens
    parameters: Parameters
    parts: Parts
    renderOrders: Int32Array
    getRenderOrders(): Int32Array
    release(): void
    update(): void
  }

  class Utils {
    static hasBlendAdditiveBit(bitfield: number): boolean
    static hasBlendColorDidChangeBit(bitfield: number): boolean
    static hasBlendMultiplicativeBit(bitfield: number): boolean
    static hasIsDoubleSidedBit(bitfield: number): boolean
    static hasIsInvertedMaskBit(bitfield: number): boolean
    static hasIsVisibleBit(bitfield: number): boolean
    static hasOpacityDidChangeBit(bitfield: number): boolean
    static hasRenderOrderDidChangeBit(bitfield: number): boolean
    static hasVertexPositionsDidChangeBit(bitfield: number): boolean
    static hasVisibilityDidChangeBit(bitfield: number): boolean
  }
}
