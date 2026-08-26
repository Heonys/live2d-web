#!/usr/bin/env node

import { execFileSync } from 'node:child_process'
import {
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'
import process from 'node:process'
import { fileURLToPath } from 'node:url'

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..')
const temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'live2d-web-consumers-'))

function installedVersion(packagePath, name) {
  return JSON.parse(readFileSync(
    path.join(root, packagePath, 'node_modules', name, 'package.json'),
    'utf8',
  )).version
}

const versions = {
  mediaPipe: installedVersion('packages/live2d-web', '@mediapipe/tasks-vision'),
  next: installedVersion('apps/playground', 'next'),
  react: installedVersion('apps/playground', 'react'),
  reactDom: installedVersion('apps/playground', 'react-dom'),
  typesNode: installedVersion('apps/playground', '@types/node'),
  typesReact: installedVersion('apps/playground', '@types/react'),
  typesReactDom: installedVersion('apps/playground', '@types/react-dom'),
  typescript: installedVersion('apps/vanilla-consumer', 'typescript'),
  vite: installedVersion('apps/vanilla-consumer', 'vite'),
}

function write(relativePath, contents) {
  const target = path.join(temporaryRoot, relativePath)
  mkdirSync(path.dirname(target), { recursive: true })
  writeFileSync(target, contents)
}

function run(command, args, cwd) {
  execFileSync(command, args, {
    cwd,
    env: { ...process.env, NEXT_TELEMETRY_DISABLED: '1' },
    stdio: 'inherit',
  })
}

function installAndRun(name, manifest, files, commands) {
  const consumer = path.join(temporaryRoot, name)
  write(`${name}/package.json`, `${JSON.stringify(manifest, null, 2)}\n`)
  for (const [file, source] of Object.entries(files))
    write(`${name}/${file}`, source)
  run('npm', ['install', '--ignore-scripts', '--no-audit', '--no-fund'], consumer)
  for (const [command, args] of commands)
    run(command, args, consumer)
}

try {
  run('pnpm', ['--filter', 'live2d-web', 'pack', '--pack-destination', temporaryRoot], root)
  const tarballName = readdirSync(temporaryRoot).find(file => file.endsWith('.tgz'))
  if (!tarballName)
    throw new Error('pnpm pack did not produce a tarball')
  const tarball = `file:${path.join(temporaryRoot, tarballName)}`

  installAndRun('vanilla-vite', {
    name: 'packed-vanilla-consumer',
    private: true,
    type: 'module',
    scripts: { build: 'tsc --noEmit && vite build' },
    dependencies: { 'live2d-web': tarball },
    devDependencies: {
      typescript: versions.typescript,
      vite: versions.vite,
    },
  }, {
    'index.html': '<div id="app"></div><script type="module" src="/src.ts"></script>',
    'src.ts': `import type { MotionOptions } from 'live2d-web'\nimport { createLive2D, createVolumeLipSync } from 'live2d-web'\nimport { mountLive2DDevtools } from 'live2d-web/devtools'\nimport { inspectModelCapabilities } from 'live2d-web/inspect'\n\nconst volume = createVolumeLipSync()\nconst motion = { fadeInMs: 250, fadeOutMs: 400 } satisfies MotionOptions\nconst capabilities = inspectModelCapabilities({ expressions: [], hitAreas: [], motions: {} })\nvolume.sample(0, 0)\nvoid capabilities\nvoid createLive2D\nvoid mountLive2DDevtools\nvoid motion\n`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        strict: true,
        target: 'ES2022',
      },
      include: ['src.ts'],
    }),
  }, [
    ['npm', ['run', 'build']],
    ['node', ['-e', 'import("live2d-web/devtools")']],
    ['node', ['-e', 'import("live2d-web/inspect")']],
    ['npm', ['audit', '--omit=dev', '--audit-level=high']],
    // The optional peer must stay optional: a plain install must not pull the
    // 12 MB MediaPipe package into a consumer that never imports tracking.
    ['node', ['-e', 'if (require("fs").existsSync("node_modules/@mediapipe")) { console.error("optional peer @mediapipe/tasks-vision was installed into a vanilla consumer"); process.exit(1) }']],
  ])

  for (const reactVersion of [
    {
      label: '18',
      react: '18.2.0',
      reactDom: '18.2.0',
      typesReact: '^18.2.0',
      typesReactDom: '^18.2.0',
    },
    {
      label: '19',
      react: versions.react,
      reactDom: versions.reactDom,
      typesReact: versions.typesReact,
      typesReactDom: versions.typesReactDom,
    },
  ]) {
    installAndRun(`react-${reactVersion.label}-vite`, {
      name: `packed-react-${reactVersion.label}-consumer`,
      private: true,
      type: 'module',
      scripts: { build: 'tsc --noEmit && vite build' },
      dependencies: {
        'live2d-web': tarball,
        'react': reactVersion.react,
        'react-dom': reactVersion.reactDom,
      },
      devDependencies: {
        '@types/react': reactVersion.typesReact,
        '@types/react-dom': reactVersion.typesReactDom,
        'typescript': versions.typescript,
        'vite': versions.vite,
      },
    }, {
      'index.html': '<div id="root"></div><script type="module" src="/src.tsx"></script>',
      'src.tsx': `import { createRoot } from 'react-dom/client'\nimport { Live2DCanvas } from 'live2d-web/react'\n\ncreateRoot(document.querySelector('#root')!).render(<Live2DCanvas accessibility={{ label: "Avatar" }} coreUrl="/core.js" />)\n`,
      'tsconfig.json': JSON.stringify({
        compilerOptions: {
          jsx: 'react-jsx',
          lib: ['ES2022', 'DOM'],
          module: 'ESNext',
          moduleResolution: 'Bundler',
          noEmit: true,
          strict: true,
          target: 'ES2022',
        },
        include: ['src.tsx'],
      }),
    }, [['npm', ['run', 'build']]])
  }

  installAndRun('tracking-vite', {
    name: 'packed-tracking-consumer',
    private: true,
    type: 'module',
    scripts: { build: 'tsc --noEmit && vite build' },
    dependencies: {
      '@mediapipe/tasks-vision': versions.mediaPipe,
      'live2d-web': tarball,
    },
    devDependencies: {
      typescript: versions.typescript,
      vite: versions.vite,
    },
  }, {
    'index.html': '<div id="app"></div><script type="module" src="/src.ts"></script>',
    'face-tracking.worker.ts': `import { startMediaPipeFaceTrackerWorker } from 'live2d-web/tracking/mediapipe/worker'\n\nstartMediaPipeFaceTrackerWorker()\n`,
    'src.ts': `import { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'\n\nvoid createMediaPipeFaceTracker({\n  execution: 'worker',\n  modelAssetPath: '/face.task',\n  wasmPath: '/wasm',\n  workerFactory: () => new Worker(\n    new URL('./face-tracking.worker.ts', import.meta.url),\n    { type: 'module' },\n  ),\n})\n`,
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        lib: ['ES2022', 'DOM'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        strict: true,
        target: 'ES2022',
      },
      include: ['src.ts', 'face-tracking.worker.ts'],
    }),
  }, [['npm', ['run', 'build']]])

  installAndRun('next-ssr', {
    name: 'packed-next-consumer',
    private: true,
    scripts: { build: 'next build' },
    dependencies: {
      '@mediapipe/tasks-vision': versions.mediaPipe,
      'live2d-web': tarball,
      'next': versions.next,
      'react': versions.react,
      'react-dom': versions.reactDom,
    },
    devDependencies: {
      '@types/node': versions.typesNode,
      '@types/react': versions.typesReact,
      '@types/react-dom': versions.typesReactDom,
      'typescript': versions.typescript,
    },
  }, {
    'app/avatar.tsx': `'use client'\n\nimport { createMediaPipeFaceTracker } from 'live2d-web/tracking/mediapipe'\nimport { Live2DCanvas } from 'live2d-web/react'\n\nexport function Avatar() {\n  void createMediaPipeFaceTracker\n  void (() => new Worker(\n    new URL('./face-tracking.worker.ts', import.meta.url),\n    { type: 'module' },\n  ))\n  return <Live2DCanvas coreUrl="/core.js" />\n}\n`,
    'app/face-tracking.worker.ts': `import { startMediaPipeFaceTrackerWorker } from 'live2d-web/tracking/mediapipe/worker'\n\nstartMediaPipeFaceTrackerWorker()\n`,
    'app/layout.tsx': `import type { ReactNode } from 'react'\n\nexport default function Layout({ children }: { children: ReactNode }) {\n  return <html><body>{children}</body></html>\n}\n`,
    'app/page.tsx': `import { Avatar } from './avatar'\n\nexport default function Page() {\n  return <main><Avatar /></main>\n}\n`,
    'next-env.d.ts': '/// <reference types="next" />\n/// <reference types="next/image-types/global" />\n',
    'tsconfig.json': JSON.stringify({
      compilerOptions: {
        allowJs: true,
        esModuleInterop: true,
        incremental: true,
        jsx: 'preserve',
        lib: ['DOM', 'DOM.Iterable', 'ESNext'],
        module: 'ESNext',
        moduleResolution: 'Bundler',
        noEmit: true,
        plugins: [{ name: 'next' }],
        resolveJsonModule: true,
        skipLibCheck: true,
        strict: true,
        target: 'ES2017',
      },
      include: ['next-env.d.ts', '.next/types/**/*.ts', '**/*.ts', '**/*.tsx'],
      exclude: ['node_modules'],
    }),
  }, [['npm', ['run', 'build']]])

  console.log('[packed-consumers] vanilla, React 18/19, tracking module Workers in Vite/Next and Next SSR verified')
}
finally {
  rmSync(temporaryRoot, { force: true, recursive: true })
}
