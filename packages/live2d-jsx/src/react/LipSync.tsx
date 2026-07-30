'use client'

import type { Live2DError } from '../core/errors'
import type {
  LipSyncProfile,
  LipSyncProfileInput,
  SourceLipSyncConnection,
} from '../features/lipsync/source'
import { useContext, useEffect, useRef, useSyncExternalStore } from 'react'
import { Live2DError as Live2DErrorClass } from '../core/errors'
import {
  MOUTH_PARAMETER_ID,
  MouthController,
} from '../features/lipsync/mouthController'
import { createSourceLipSync } from '../features/lipsync/source'
import { ModelContext } from './context'

export interface LipSyncDriver {
  getMouthOpen: () => number
  isSpeaking: () => boolean
}

interface LipSyncErrorProps {
  onError?: (error: Live2DError) => void
}

export type LipSyncProps
  = | LipSyncErrorProps & {
    driver: LipSyncDriver
    source?: never
    active?: never
    profile?: never
  }
  | LipSyncErrorProps & {
    source: AudioNode | null
    active: boolean
    profile: string | URL | ArrayBuffer | LipSyncProfile
    driver?: never
  }

function lipSyncError(error: unknown) {
  if (error instanceof Live2DErrorClass && error.code === 'lipsync-error')
    return error
  return new Live2DErrorClass(
    'lipsync-error',
    error instanceof Error ? error.message : String(error),
    { cause: error },
  )
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

  if (hasDriver === hasSourceProps) {
    throw new Live2DErrorClass(
      'invalid-props',
      '<LipSync> requires exactly one mode: driver or source/active/profile.',
    )
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

function applyDriverFrame(
  model: import('../core/contract').ModelHandle,
  controller: MouthController,
  driver: LipSyncDriver,
  deltaMs: number,
) {
  const speaking = driver.isSpeaking()
  const value = controller.update({
    deltaMs,
    motionValue: model.getParameter(MOUTH_PARAMETER_ID),
    mouthOpen: speaking ? driver.getMouthOpen() : 0,
    speaking,
  })
  if (value !== null)
    model.setParameter(MOUTH_PARAMETER_ID, value)
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
  const model = useSyncExternalStore(
    context.store.subscribe,
    context.store.getSnapshot,
    context.store.getSnapshot,
  ).handle
  const activeRef = useRef(false)
  const driverRef = useRef<LipSyncDriver | null>(null)
  const onErrorRef = useRef(props.onError)
  activeRef.current = mode === 'source' ? Boolean(props.active) : false
  driverRef.current = mode === 'driver' ? props.driver ?? null : null
  onErrorRef.current = props.onError

  const source = mode === 'source' ? props.source : null
  const profile = mode === 'source' ? props.profile : null

  useEffect(() => {
    if (!model)
      return

    const controller = new MouthController()
    let connection: SourceLipSyncConnection | undefined
    let disabled = false
    let disposed = false
    let reported = false
    let unsubscribeFrame: (() => void) | undefined

    const report = (error: unknown) => {
      if (reported || disposed)
        return
      reported = true
      const normalized = lipSyncError(error)
      if (onErrorRef.current)
        onErrorRef.current(normalized)
      else
        console.error('[live2d-jsx] lip sync disabled:', normalized)
    }

    const attachDriver = (getDriver: () => LipSyncDriver | null) => {
      unsubscribeFrame = model.onAfterMotionUpdate((deltaMs) => {
        if (disabled)
          return
        const driver = getDriver()
        if (!driver)
          return
        try {
          applyDriverFrame(model, controller, driver, deltaMs)
        }
        catch (error) {
          disabled = true
          report(error)
        }
      })
    }

    const cleanup = context.lifecycle.add(() => {
      disposed = true
      unsubscribeFrame?.()
      connection?.dispose()
    })

    if (mode === 'driver') {
      attachDriver(() => driverRef.current)
    }
    else if (source && profile) {
      void createSourceLipSync(source, profile)
        .then((nextConnection) => {
          if (disposed) {
            nextConnection.dispose()
            return
          }
          connection = nextConnection
          const sourceDriver: LipSyncDriver = {
            getMouthOpen: nextConnection.getMouthOpen,
            isSpeaking: () => activeRef.current,
          }
          attachDriver(() => sourceDriver)
        })
        .catch(report)
    }

    return cleanup
  }, [context.lifecycle, mode, model, profile, source])

  return null
}
