export function decodeZipFileName(bytes: string[] | Uint8Array): string {
  if (Array.isArray(bytes))
    return bytes.join('')
  if (bytes.every(byte => byte < 0x80))
    return new TextDecoder('utf-8').decode(bytes)

  return decodeStrict(bytes, 'utf-8')
    ?? decodeStrict(bytes, 'gbk')
    ?? new TextDecoder('gbk').decode(bytes)
}

function decodeStrict(bytes: Uint8Array, encoding: string) {
  try {
    return new TextDecoder(encoding, { fatal: true }).decode(bytes)
  }
  catch {
    return undefined
  }
}
