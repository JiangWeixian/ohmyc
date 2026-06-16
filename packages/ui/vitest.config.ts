import path from 'node:path'
import { fileURLToPath } from 'node:url'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

const rootDir = fileURLToPath(new URL('.', import.meta.url))

export default defineConfig({
  plugins: [react()],
  resolve: {
    alias: {
      '@': path.resolve(rootDir, 'src'),
      '@tauri-apps/api/core': path.resolve(rootDir, 'tests/test/stubs/tauri-api-core.ts'),
      '@tauri-apps/api/event': path.resolve(rootDir, 'tests/test/stubs/tauri-api-event.ts'),
    },
  },
  server: {
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./tests/test/setup.ts'],
    server: {
      deps: {
        // @lobehub/ui ships ESM Node can't load directly (JSON imports without
        // `type: json` attributes); inline it so Vite transforms it instead.
        inline: [/@lobehub\/(ui|icons)/],
      },
    },
    include: [
      'tests/**/*.test.ts',
      'tests/**/*.test.tsx',
    ],
    coverage: {
      provider: 'v8',
      reporter: ['text', 'json-summary', 'json', 'html'],
      exclude: [
        'node_modules/',
        'tests/',
        'dist/',
        'src/components/ui/**',
        'src/components/uitripled/**',
        '**/*.d.ts',
        '**/*.config.*',
      ],
    },
  },
})
