import type { BenchmarkResult } from './schema'
import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'

export function writeBenchmarkResult(fileName: string, result: BenchmarkResult) {
  const outputDirectory = path.resolve('benchmark-results')
  mkdirSync(outputDirectory, { recursive: true })
  const outputPath = path.join(outputDirectory, fileName)
  writeFileSync(outputPath, `${JSON.stringify(result, null, 2)}\n`)
  return outputPath
}
