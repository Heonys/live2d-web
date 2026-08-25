import type { IdleMotion } from './contract'
import { Live2DError } from './errors'

export interface ResolvedIdleMotion {
  group: string
  weights?: readonly number[]
}

export function validateIdleMotion(idleMotion: IdleMotion | undefined) {
  if (idleMotion === undefined || idleMotion === false)
    return
  if (typeof idleMotion === 'string') {
    if (idleMotion.trim() !== '')
      return
    throw new Live2DError(
      'invalid-props',
      'idleMotion must be a non-empty motion group name, weighted options or false.',
    )
  }
  if (typeof idleMotion !== 'object' || idleMotion === null || Array.isArray(idleMotion)) {
    throw new Live2DError('invalid-props', 'idleMotion weighted options must be an object.')
  }
  if (typeof idleMotion.group !== 'string' || idleMotion.group.trim() === '') {
    throw new Live2DError('invalid-props', 'idleMotion.group must be a non-empty string.')
  }
  if (!Array.isArray(idleMotion.weights) || idleMotion.weights.length === 0) {
    throw new Live2DError('invalid-props', 'idleMotion.weights must be a non-empty array.')
  }
  let positive = false
  for (const weight of idleMotion.weights) {
    if (!Number.isFinite(weight) || weight < 0) {
      throw new Live2DError(
        'invalid-props',
        'Every idleMotion weight must be a finite, non-negative number.',
      )
    }
    positive ||= weight > 0
  }
  if (!positive) {
    throw new Live2DError(
      'invalid-props',
      'At least one idleMotion weight must be greater than 0.',
    )
  }
}

export function resolveIdleMotion(
  idleMotion: IdleMotion | undefined,
  getMotionCount: (group: string) => number,
): ResolvedIdleMotion | false {
  validateIdleMotion(idleMotion)
  if (idleMotion === false)
    return false
  // The implicit 'Idle' default stays lenient: many models simply have no
  // such group. A group the caller named must exist, exactly like a weighted one.
  if (idleMotion === undefined)
    return { group: 'Idle' }
  if (typeof idleMotion === 'string') {
    if (getMotionCount(idleMotion) <= 0)
      throw new Live2DError('invalid-props', `Unknown idle motion group: ${idleMotion}.`)
    return { group: idleMotion }
  }
  const count = getMotionCount(idleMotion.group)
  if (count <= 0) {
    throw new Live2DError(
      'invalid-props',
      `Unknown weighted idle motion group: ${idleMotion.group}.`,
    )
  }
  if (idleMotion.weights.length !== count) {
    throw new Live2DError(
      'invalid-props',
      `idleMotion.weights has ${idleMotion.weights.length} entries but group ${idleMotion.group} has ${count} motions.`,
    )
  }
  return { group: idleMotion.group, weights: [...idleMotion.weights] }
}

export function selectIdleMotionIndex(
  count: number,
  weights: readonly number[] | undefined,
  random = Math.random,
) {
  if (!weights)
    return Math.min(count - 1, Math.floor(random() * count))
  let scale = 0
  for (const weight of weights)
    scale = Math.max(scale, weight)
  const total = weights.reduce((sum, weight) => sum + weight / scale, 0)
  let target = Math.min(1 - Number.EPSILON, Math.max(0, random())) * total
  for (let index = 0; index < weights.length; index++) {
    target -= weights[index] / scale
    if (target < 0)
      return index
  }
  return weights.length - 1
}

export function idleMotionIdentity(idleMotion: IdleMotion | undefined) {
  if (idleMotion === undefined)
    return 'default'
  if (idleMotion === false)
    return 'false'
  if (typeof idleMotion === 'string')
    return `group:${idleMotion}`
  return `weighted:${idleMotion.group}:${idleMotion.weights.join(',')}`
}
