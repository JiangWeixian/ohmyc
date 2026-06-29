import path from 'node:path'
import { fileURLToPath } from 'node:url'

import { storybookTest } from '@storybook/addon-vitest/vitest-plugin'
import { defineWorkspace } from 'vitest/config'

const dirname = path.dirname(fileURLToPath(import.meta.url))

export default defineWorkspace([
  './vitest.config.ts',
  {
    extends: './vite.config.ts',
    plugins: [
      storybookTest({
        configDir: path.join(dirname, '.storybook'),
        storybookScript: 'pnpm --filter @ohmyc/ui storybook -- --no-open',
        tags: {
          include: ['test'],
          exclude: ['experimental'],
        },
      }),
    ],
    resolve: {
      alias: {
        '@': path.resolve(dirname, 'src'),
        '@tauri-apps/api/core': path.resolve(dirname, 'tests/test/stubs/tauri-api-core.ts'),
        '@tauri-apps/api/event': path.resolve(dirname, 'tests/test/stubs/tauri-api-event.ts'),
      },
    },
    optimizeDeps: {
      include: [
        '@radix-ui/react-dialog',
        '@radix-ui/react-dropdown-menu',
        '@radix-ui/react-select',
        '@radix-ui/react-slot',
        '@radix-ui/react-tabs',
        '@react-three/drei',
        '@react-three/fiber',
        '@react-three/postprocessing',
        '@react-three/rapier',
        '@lobehub/icons/es/Claude',
        '@lobehub/icons/es/OpenCode',
        '@tanstack/react-query',
        'class-variance-authority',
        'clsx',
        'cmdk',
        'framer-motion',
        'lucide-react',
        'maath',
        'meshline',
        'react-markdown',
        'react-router-dom',
        'recharts',
        'remark-gfm',
        'storybook/test',
        'tailwind-merge',
        'three',
      ],
    },
    test: {
      name: 'storybook',
      browser: {
        enabled: true,
        provider: 'playwright',
        headless: true,
        instances: [{ browser: 'chromium' }],
      },
      // @ts-expect-error coverage works at runtime but is missing from vitest's ProjectConfig type
      coverage: {
        provider: 'v8',
        reporter: ['text', 'json-summary', 'json'],
        exclude: [
          'node_modules/',
          'tests/',
          'dist/',
          'src/components/ui/**',
          'src/components/uitripled/**',
          'src/components/monitor-spike/**',
          '**/*.d.ts',
          '**/*.config.*',
        ],
      },
      setupFiles: ['./.storybook/vitest.setup.ts'],
      server: {
        deps: {
          inline: [/@lobehub\/(ui|icons)/],
        },
      },
    },
  },
])
