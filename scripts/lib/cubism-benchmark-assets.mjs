import { existsSync, readFileSync } from 'node:fs'
import path from 'node:path'

export function validateModelAssets(model3Path) {
  const setting = JSON.parse(readFileSync(model3Path, 'utf8'))
  const references = setting.FileReferences ?? {}
  const required = [references.Moc, ...(references.Textures ?? [])]
  const optional = [references.Physics, references.Pose, references.UserData]
  const motions = Object.values(references.Motions ?? {})
    .flat()
    .map(motion => motion.File)
  const expressions = (references.Expressions ?? []).map(expression => expression.File)
  for (const relativePath of [...required, ...optional, ...motions, ...expressions]) {
    if (!relativePath)
      continue
    const resolved = path.resolve(path.dirname(model3Path), relativePath)
    if (!existsSync(resolved))
      throw new Error(`${path.basename(model3Path)} 자산 누락: ${relativePath}`)
  }
  if (!references.Moc || !Array.isArray(references.Textures) || references.Textures.length === 0)
    throw new Error(`${path.basename(model3Path)}에 moc3 또는 texture 선언이 없다`)
  if (!references.Motions?.Idle?.[0]?.File)
    throw new Error(`${path.basename(model3Path)}에 고정 Idle[0] motion이 없다`)
  return {
    expressionCount: references.Expressions?.length ?? 0,
    expressions: (references.Expressions ?? []).map(expression => expression.Name),
    hasPhysics: Boolean(references.Physics),
    hasPose: Boolean(references.Pose),
    motionGroups: Object.fromEntries(
      Object.entries(references.Motions ?? {}).map(([group, motions]) => [group, motions.length]),
    ),
    textureCount: references.Textures.length,
  }
}
