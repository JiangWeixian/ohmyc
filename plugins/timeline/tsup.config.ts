import { defineConfig } from 'tsup'

export default defineConfig({
  entry: ['src/ingest.ts'],
  format: ['esm'],
  splitting: false,
  clean: false,
  bundle: true,
  platform: 'node',
  target: 'node22',
  outExtension: () => ({ js: '.mjs' }),
  banner: {
    js: "import { createRequire } from 'module'; const require = createRequire(import.meta.url);",
  },
  external: ['better-sqlite3', 'node:sqlite'],
  noExternal: [/@[\w-]+\/[\w-]+/, 'cac'],
})
