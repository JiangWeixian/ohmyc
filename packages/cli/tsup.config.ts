import { cpSync, existsSync } from 'node:fs'
import { createRequire } from 'node:module'
import path from 'node:path'

import { defineConfig } from 'tsup'

const TIMELINE_PLUGIN_PACKAGE = '@ohmyc/timeline-plugin'
const require = createRequire(import.meta.url)

export const timelinePluginCopyPaths = [
  '.agents/plugins',
  '.claude-plugin',
  '.codex-plugin',
  'dist',
  'hooks',
  'package.json',
  'README.md',
]

function findPackageRoot(resolvedEntry: string): string {
  let current = path.dirname(resolvedEntry)
  while (current !== path.dirname(current)) {
    if (existsSync(path.join(current, 'package.json'))) {
      return current
    }
    current = path.dirname(current)
  }
  throw new Error(`Could not find package root for ${resolvedEntry}`)
}

export function resolveTimelinePluginPackageDir(): string {
  const entryPath = require.resolve(TIMELINE_PLUGIN_PACKAGE)
  return findPackageRoot(entryPath)
}

function isAllowedCopyPath(relative: string): boolean {
  if (relative === '') {
    return true
  }

  return timelinePluginCopyPaths.some((allowed) => {
    return relative === allowed
      || relative.startsWith(`${allowed}${path.sep}`)
      || allowed.startsWith(`${relative}${path.sep}`)
  })
}

export function copyTimelinePluginAssets(options: {
  packageDir?: string
  outputDir?: string
} = {}): string {
  const pluginSource = options.packageDir ?? resolveTimelinePluginPackageDir()
  const pluginDist = options.outputDir ?? path.resolve(import.meta.dirname, 'dist/plugins/timeline')

  if (!existsSync(pluginSource)) {
    throw new Error(`Cannot copy timeline plugin assets: ${TIMELINE_PLUGIN_PACKAGE} package root was not found at ${pluginSource}`)
  }

  cpSync(pluginSource, pluginDist, {
    recursive: true,
    filter: (source) => {
      const relative = path.relative(pluginSource, source)
      return isAllowedCopyPath(relative)
    },
  })

  return pluginDist
}

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['esm'],
  splitting: false,
  clean: true,
  bundle: true,
  platform: 'node',
  target: 'node22',
  outExtension: () => ({ js: '.mjs' }),
  external: ['node:sqlite'],
  noExternal: [
    /@[\w-]+\/[\w-]+/,
    'cac',
  ],
  onSuccess: async () => {
    const pluginDist = copyTimelinePluginAssets()
    console.log(`Copied ${TIMELINE_PLUGIN_PACKAGE} assets to ${pluginDist}`)
  },
})
