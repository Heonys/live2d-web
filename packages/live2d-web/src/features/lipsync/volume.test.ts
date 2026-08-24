import type { LipSyncDriver } from '../../core/runtime'
import { describe, expect, it } from 'vitest'
import { createVolumeLipSync } from './volume'

function sampleFor(
  driver: ReturnType<typeof createVolumeLipSync>,
  rms: number,
  fromMs: number,
  toMs: number,
) {
  for (let elapsedMs = fromMs; elapsedMs <= toMs; elapsedMs += 16)
    driver.sample(rms, elapsedMs)
}

describe('volume lip sync', () => {
  it('stays closed after calibrating against background noise', () => {
    const driver = createVolumeLipSync()
    sampleFor(driver, 0.008, 0, 1_600)

    expect(driver.getMouthOpen()).toBeLessThan(0.01)
    expect(driver.isSpeaking()).toBe(false)
  })

  it('attacks quickly for voice input and remains in the unit range', () => {
    const driver = createVolumeLipSync()
    sampleFor(driver, 0.006, 0, 1_600)

    driver.sample(0.12, 1_616)

    expect(driver.getMouthOpen()).toBeGreaterThan(0.12)
    expect(driver.getMouthOpen()).toBeLessThanOrEqual(1)
    expect(driver.isSpeaking()).toBe(true)
  })

  it('uses hysteresis instead of flickering around one threshold', () => {
    const driver = createVolumeLipSync()
    sampleFor(driver, 0.006, 0, 1_600)
    driver.sample(0.12, 1_616)
    expect(driver.isSpeaking()).toBe(true)

    driver.sample(0.018, 1_632)
    expect(driver.getMouthOpen()).toBeGreaterThan(0.05)
    expect(driver.isSpeaking()).toBe(true)
  })

  it('releases gradually and eventually stops speaking in silence', () => {
    const driver = createVolumeLipSync()
    sampleFor(driver, 0.006, 0, 1_600)
    sampleFor(driver, 0.12, 1_616, 1_680)
    const open = driver.getMouthOpen()

    driver.sample(0, 1_696)
    expect(driver.getMouthOpen()).toBeGreaterThan(0)
    expect(driver.getMouthOpen()).toBeLessThan(open)

    sampleFor(driver, 0, 1_712, 2_200)
    expect(driver.getMouthOpen()).toBeLessThan(0.01)
    expect(driver.isSpeaking()).toBe(false)
  })

  it('does not let sustained speech become the noise floor', () => {
    const driver = createVolumeLipSync()
    sampleFor(driver, 0.006, 0, 1_600)
    sampleFor(driver, 0.12, 1_616, 4_000)
    expect(driver.isSpeaking()).toBe(true)

    sampleFor(driver, 0, 4_016, 4_600)
    expect(driver.isSpeaking()).toBe(false)
    driver.sample(0.12, 4_616)
    expect(driver.isSpeaking()).toBe(true)
  })

  it('normalizes invalid RMS and elapsed time without invalid output', () => {
    const driver = createVolumeLipSync()
    driver.sample(Number.NaN, Number.NaN)
    driver.sample(Number.POSITIVE_INFINITY, Number.POSITIVE_INFINITY)
    driver.sample(-1, -1)
    driver.sample(0.12, 2_000)
    driver.sample(0, 1_000)

    expect(Number.isFinite(driver.getMouthOpen())).toBe(true)
    expect(driver.getMouthOpen()).toBeGreaterThanOrEqual(0)
    expect(driver.getMouthOpen()).toBeLessThanOrEqual(1)
    expect(typeof driver.isSpeaking()).toBe('boolean')
  })

  it('is structurally compatible with the existing lip-sync driver', () => {
    const driver: LipSyncDriver = createVolumeLipSync()

    expect(driver.getMouthOpen()).toBe(0)
    expect(driver.isSpeaking()).toBe(false)
  })
})
