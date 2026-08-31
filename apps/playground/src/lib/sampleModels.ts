/**
 * Sample models `fetch-assets` already downloads.
 *
 * The demo had only ever loaded Hiyori, so the compatibility matrix had only
 * ever had one entry, and answering "will my model work" needs more than one
 * rig on screen. The deploy runs the same asset script, so all five ship.
 */
import type { SampleModel } from './assetManifest'

const SAMPLE_MODELS_URL = '/assets/live2d/benchmark-models.json'

export async function loadSampleModels(signal?: AbortSignal): Promise<SampleModel[]> {
  const response = await fetch(SAMPLE_MODELS_URL, { signal })
  if (!response.ok)
    return []
  const parsed = await response.json() as { models?: SampleModel[] }
  return (parsed.models ?? []).filter(model => Boolean(model?.model3 && model.id))
}
