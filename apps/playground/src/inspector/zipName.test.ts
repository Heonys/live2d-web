import { describe, expect, it } from 'vitest'
import { decodeZipFileName } from './zipName'

describe('zip filename decoding', () => {
  it('keeps ASCII and strict UTF-8 names intact', () => {
    expect(decodeZipFileName(new TextEncoder().encode('model/model3.json')))
      .toBe('model/model3.json')
    expect(decodeZipFileName(new TextEncoder().encode('모델/표정.exp3.json')))
      .toBe('모델/표정.exp3.json')
  })

  it('falls back to GBK for legacy CJK names', () => {
    // GBK bytes for 你.txt; C4 E3 is not valid UTF-8.
    expect(decodeZipFileName(Uint8Array.from([0xC4, 0xE3, 0x2E, 0x74, 0x78, 0x74])))
      .toBe('你.txt')
  })
})
