#!/usr/bin/env node

import { mkdirSync, writeFileSync } from 'node:fs'
import path from 'node:path'
import { fileURLToPath } from 'node:url'
import { Application, ReflectionKind } from 'typedoc'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const packageRoot = path.join(root, 'packages/live2d-web')
const output = path.join(root, 'apps/playground/.generated/api-reference.json')
const entries = [
  ['Core', 'src/index.ts'],
  ['Devtools', 'src/devtools/index.ts'],
  ['React', 'src/react.ts'],
  ['Model inspection', 'src/inspect/index.ts'],
  ['MediaPipe tracking', 'src/tracking/mediapipe/index.ts'],
  ['MediaPipe Worker', 'src/tracking/mediapipe/worker.ts'],
]

function text(parts) {
  return parts?.map(part => part.text).join('').trim() ?? ''
}

function typeName(type) {
  return type?.toString() ?? 'unknown'
}

function typeParameters(reflection) {
  const values = reflection.typeParameters?.map(parameter => parameter.name) ?? []
  return values.length ? `<${values.join(', ')}>` : ''
}

function parameters(signature) {
  return (signature.parameters ?? []).map((parameter) => {
    const rest = parameter.flags.isRest ? '...' : ''
    const optional = parameter.flags.isOptional || parameter.defaultValue !== undefined
      ? '?'
      : ''
    return `${rest}${parameter.name}${optional}: ${typeName(parameter.type)}`
  }).join(', ')
}

function signatures(reflection) {
  if (reflection.signatures?.length) {
    return reflection.signatures.map(signature =>
      `${reflection.name}${typeParameters(signature)}(${parameters(signature)}): ${typeName(signature.type)}`)
  }
  if (reflection.kindOf(ReflectionKind.TypeAlias))
    return [`type ${reflection.name}${typeParameters(reflection)} = ${typeName(reflection.type)}`]
  if (reflection.kindOf(ReflectionKind.Variable))
    return [`const ${reflection.name}: ${typeName(reflection.type)}`]
  if (reflection.kindOf(ReflectionKind.Enum))
    return [`enum ${reflection.name}`]
  if (
    reflection.kindOf(ReflectionKind.Interface)
    || reflection.kindOf(ReflectionKind.Class)
  ) {
    const prefix = reflection.kindOf(ReflectionKind.Interface) ? 'interface' : 'class'
    const members = (reflection.children ?? []).map((member) => {
      const optional = member.flags.isOptional ? '?' : ''
      if (member.signatures?.length) {
        const signature = member.signatures[0]
        return `  ${member.name}${optional}(${parameters(signature)}): ${typeName(signature.type)}`
      }
      return `  ${member.name}${optional}: ${typeName(member.type)}`
    })
    return [
      `${prefix} ${reflection.name}${typeParameters(reflection)} {`,
      ...members,
      '}',
    ]
  }
  return [reflection.name]
}

function publicDeclarations(project) {
  const children = project.children ?? []
  const declarations = children.length === 1 && children[0].kindOf(ReflectionKind.Module)
    ? children[0].children ?? []
    : children
  return declarations
    .filter(reflection => !reflection.flags.isPrivate && !reflection.flags.isProtected)
    .map(reflection => ({
      description: text(reflection.comment?.summary)
        || text(reflection.signatures?.[0]?.comment?.summary),
      kind: ReflectionKind.singularString(reflection.kind),
      name: reflection.name,
      signatures: signatures(reflection),
    }))
    .sort((left, right) => left.name.localeCompare(right.name))
}

const sections = []
for (const [title, entry] of entries) {
  const application = await Application.bootstrap({
    entryPoints: [path.join(packageRoot, entry)],
    excludeExternals: true,
    excludeInternal: true,
    excludePrivate: true,
    excludeProtected: true,
    plugin: [],
    skipErrorChecking: true,
    tsconfig: path.join(packageRoot, 'tsconfig.json'),
  })
  const project = await application.convert()
  if (!project)
    throw new Error(`TypeDoc could not convert ${entry}`)
  sections.push({ symbols: publicDeclarations(project), title })
}

mkdirSync(path.dirname(output), { recursive: true })
writeFileSync(output, `${JSON.stringify({ generatedAt: new Date().toISOString(), sections }, null, 2)}\n`)
console.log(`[docs] generated API reference with ${sections.reduce((sum, section) => sum + section.symbols.length, 0)} symbols`)
