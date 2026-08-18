'use client'

import type { Live2DError } from '../core/errors'
import type {
  LipSyncProfile,
  LipSyncProfileInput,
} from '../features/lipsync/source'
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { Live2DError as Live2DErrorClass } from '../core/errors'
import { ModelContext } from './context'

export interface LipSyncDriver {
  getMouthOpen: () => number
  isSpeaking: () => boolean
}

interface LipSyncErrorProps {
  onError?: (error: Live2DError) => void
  /** Mouth parameter to drive. Default ParamMouthOpenY. */
  parameterId?: string
}

export type LipSyncProps
  = | LipSyncErrorProps & {
    driver: LipSyncDriver
    source?: never
    active?: never
    profile?: never
    mouthOpen?: never
    speaking?: never
  }
  | LipSyncErrorProps & {
    source: AudioNode | null
    active: boolean
    profile: string | URL | ArrayBuffer | LipSyncProfile
    driver?: never
    mouthOpen?: never
    speaking?: never
  }
  | LipSyncErrorProps & {
    /** Latest mouth openness (0-1). Plain values; no stable ref needed. */
    mouthOpen: number
    speaking: boolean
    driver?: never
    source?: never
    active?: never
    profile?: never
  }

function isAudioNodeLike(value: unknown): value is AudioNode {
  if (!value || typeof value !== 'object')
    return false
  const candidate = value as Partial<AudioNode>
  return typeof candidate.connect === 'function'
    && typeof candidate.disconnect === 'function'
    && Boolean(candidate.context)
}

function isProfileInput(value: unknown): value is LipSyncProfileInput {
  if (typeof value === 'string')
    return value.trim().length > 0
  if (typeof URL !== 'undefined' && value instanceof URL)
    return true
  if (typeof ArrayBuffer !== 'undefined' && value instanceof ArrayBuffer)
    return true
  return Boolean(value) && typeof value === 'object'
}

function resolveMode(props: LipSyncProps) {
  const candidate = props as Partial<LipSyncProps> & Record<string, unknown>
  const hasDriver = candidate.driver !== undefined
  const hasSourceProps = 'source' in candidate
    || 'active' in candidate
    || 'profile' in candidate
  const hasValueProps = 'mouthOpen' in candidate || 'speaking' in candidate

  if (Number(hasDriver) + Number(hasSourceProps) + Number(hasValueProps) !== 1) {
    throw new Live2DErrorClass(
      'invalid-props',
      '<LipSync> requires exactly one mode: driver, source/active/profile, or mouthOpen/speaking.',
    )
  }

  if (hasValueProps) {
    if (typeof candidate.mouthOpen !== 'number' || typeof candidate.speaking !== 'boolean') {
      throw new Live2DErrorClass(
        'invalid-props',
        '<LipSync mouthOpen/speaking> requires a number and a boolean.',
      )
    }
    return 'values' as const
  }

  if (hasDriver) {
    const driver = candidate.driver as Partial<LipSyncDriver>
    if (
      !driver
      || typeof driver.getMouthOpen !== 'function'
      || typeof driver.isSpeaking !== 'function'
    ) {
      throw new Live2DErrorClass(
        'invalid-props',
        '<LipSync driver> must provide getMouthOpen() and isSpeaking().',
      )
    }
    return 'driver' as const
  }

  if (
    typeof candidate.active !== 'boolean'
    || !(candidate.source === null || isAudioNodeLike(candidate.source))
    || !isProfileInput(candidate.profile)
  ) {
    throw new Live2DErrorClass(
      'invalid-props',
      '<LipSync source> requires an AudioNode or null, a boolean active prop, and a valid profile.',
    )
  }
  return 'source' as const
}

export function LipSync(props: LipSyncProps) {
  const context = useContext(ModelContext)
  if (!context) {
    throw new Live2DErrorClass(
      'invalid-tree',
      '<LipSync> must be rendered inside <Live2DModel>.',
    )
  }

  const mode = resolveMode(props)
  const runtime = useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getSnapshot,
  ).runtime
  const activeRef = useRef(false)
  const driverRef = useRef<LipSyncDriver | null>(null)
  const mouthOpenRef = useRef(0)
  const onErrorRef = useRef(props.onError)
  const speakingRef = useRef(false)
  activeRef.current = mode === 'source' ? Boolean(props.active) : false
  driverRef.current = mode === 'driver' ? props.driver ?? null : null
  mouthOpenRef.current = mode === 'values' ? props.mouthOpen ?? 0 : 0
  speakingRef.current = mode === 'values' ? Boolean(props.speaking) : false
  onErrorRef.current = props.onError

  const source = mode === 'source' ? props.source : null
  const profile = mode === 'source' ? props.profile : null

  useEffect(() => {
    if (!runtime)
      return
    const report = (error: Live2DError) => {
      if (onErrorRef.current)
        onErrorRef.current(error)
      else
        console.error('[live2d-web] lip sync disabled:', error)
    }

    if (mode === 'driver' || mode === 'values') {
      const driver = mode === 'driver'
        ? {
            getMouthOpen: () => driverRef.current?.getMouthOpen() ?? 0,
            isSpeaking: () => driverRef.current?.isSpeaking() ?? false,
          }
        : {
            getMouthOpen: () => mouthOpenRef.current,
            isSpeaking: () => speakingRef.current,
          }
      return context.lifecycle.add(runtime.addLipSync({
        driver,
        onError: report,
        parameterId: props.parameterId,
      }))
    }

    if (!source || !profile)
      return
    return context.lifecycle.add(runtime.addLipSync({
      isSpeaking: () => activeRef.current,
      onError: report,
      parameterId: props.parameterId,
      profile,
      source,
    }))
  }, [context.lifecycle, mode, profile, props.parameterId, runtime, source])

  return null
}
