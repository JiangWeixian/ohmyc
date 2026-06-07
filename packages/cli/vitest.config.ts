import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
    },
  },
  test: {
    environment: 'node',
    include: ['tests/**/*.test.ts'],
    // The CLI is now strictly the dashboard subcommand installer; tests
    // for the deleted server/launcher/migrate-home/banner went with them
    // in slice 8. Until a dashboard.test.ts is written, allow the empty
    // suite to exit 0 so `pnpm -r test` stays green on CI.
    passWithNoTests: true,
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'docs/',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
})
