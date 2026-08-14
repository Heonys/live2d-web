export interface SampleStatistics {
  count: number
  p50: number | null
  p95: number | null
  p99: number | null
}

export function quantile(samples: readonly number[], probability: number) {
  const finite = samples.filter(Number.isFinite).sort((left, right) => left - right)
  if (finite.length === 0)
    return null
  if (probability <= 0)
    return finite[0]
  if (probability >= 1)
    return finite.at(-1)!
  const position = (finite.length - 1) * probability
  const lower = Math.floor(position)
  const upper = Math.ceil(position)
  if (lower === upper)
    return finite[lower]
  const weight = position - lower
  return finite[lower] * (1 - weight) + finite[upper] * weight
}

export function summarize(samples: readonly number[]): SampleStatistics {
  const finite = samples.filter(Number.isFinite)
  return {
    count: finite.length,
    p50: quantile(finite, 0.5),
    p95: quantile(finite, 0.95),
    p99: quantile(finite, 0.99),
  }
}

export function median(values: readonly number[]) {
  return quantile(values, 0.5)
}

export function medianByKey<T extends Record<string, number | null>>(
  repetitions: readonly T[],
): T {
  const keys = new Set(repetitions.flatMap(value => Object.keys(value)))
  return Object.fromEntries([...keys].map((key) => {
    const values = repetitions
      .map(value => value[key])
      .filter((value): value is number => typeof value === 'number')
    return [key, median(values)]
  })) as T
}
