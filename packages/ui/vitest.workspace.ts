/* eslint-disable import/no-extraneous-dependencies */

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
    test: {
      name: 'storybook',
      browser: {
        enabled: true,
        provider: 'playwright',
        headless: true,
        instances: [{ browser: 'chromium' }],
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
