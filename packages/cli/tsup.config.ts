import { cpSync, existsSync } from 'node:fs'
import path from 'node:path'

import { defineConfig } from 'tsup'

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
    const pluginSource = path.resolve(import.meta.dirname, '../../plugins/timeline')
    const pluginDist = path.resolve(import.meta.dirname, 'dist/plugins/timeline')

    if (existsSync(pluginSource)) {
      const allowedPaths = [
        'dist',
        'hooks',
        '.claude-plugin',
        'package.json',
        'README.md',
      ]
      cpSync(pluginSource, pluginDist, {
        recursive: true,
        filter: (source) => {
          const relative = path.relative(pluginSource, source)
          if (relative === '') {
            return true
          }
          return allowedPaths.some(allowed =>
            relative.startsWith(allowed),
          )
        },
      })
      console.log(`Copied plugin assets from ${pluginSource} to ${pluginDist}`)
    }
  },
})
