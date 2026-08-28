#!/usr/bin/env node

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import process from 'node:process'
import { parseArgs } from 'node:util'
import { renderBenchmarkReport } from '../benchmarks/lib/report.ts'

const { values } = parseArgs({
  options: {
    input: { type: 'string' },
    output: { type: 'string' },
  },
})

if (!values.input || !values.output) {
  throw new Error(
    'Usage: pnpm benchmark:report --input benchmark-results/<file>.json '
    + '--output private/docs/benchmarks/YYYY-MM-DD-<name>.md',
  )
}

const inputPath = path.resolve(values.input)
const outputPath = path.resolve(values.output)
const reportsDirectory = path.resolve('private/docs/benchmarks')
if (!outputPath.startsWith(`${reportsDirectory}${path.sep}`))
  throw new Error('Benchmark reports must be written under private/docs/benchmarks/.')
if (existsSync(outputPath))
  throw new Error(`Refusing to overwrite existing report: ${outputPath}`)

const report = renderBenchmarkReport(JSON.parse(readFileSync(inputPath, 'utf8')))
mkdirSync(path.dirname(outputPath), { recursive: true })
writeFileSync(outputPath, report)
console.log(`[benchmark] promoted report → ${path.relative(process.cwd(), outputPath)}`)
