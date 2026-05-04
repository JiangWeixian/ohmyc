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
  target: 'node18',
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: ['better-sqlite3'],
  noExternal: [
    /@[\w-]+\/[\w-]+/,
    '@fastify/static',
    'cac',
    'fastify',
    'get-port',
    'gray-matter',
    'open',
    'proper-lockfile',
    'untildify',
    'zod-to-json-schema',
  ],
  onSuccess: async () => {
    const uiDistribution = path.resolve(import.meta.dirname, '../ui/dist')
    const cliUiDistribution = path.resolve(import.meta.dirname, 'dist/ui')
    const pluginSource = path.resolve(import.meta.dirname, '../../plugins/timeline')
    const pluginDist = path.resolve(import.meta.dirname, 'dist/plugins/timeline')

    if (existsSync(uiDistribution)) {
      cpSync(uiDistribution, cliUiDistribution, { recursive: true })
      console.log(`Copied UI assets from ${uiDistribution} to ${cliUiDistribution}`)
    } else {
      console.warn(`Warning: UI dist not found at ${uiDistribution}. Run 'pnpm --filter @ohmyc/ui build' first.`)
    }

    if (existsSync(pluginSource)) {
      cpSync(pluginSource, pluginDist, { recursive: true })
      console.log(`Copied plugin assets from ${pluginSource} to ${pluginDist}`)
    }
  },
})
