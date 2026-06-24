import path from 'node:path'
import { fileURLToPath } from 'node:url'

import type { StorybookConfig } from '@storybook/react-vite'

const rootDir = path.dirname(fileURLToPath(import.meta.url))
const packageRoot = path.resolve(rootDir, '..')

const config: StorybookConfig = {
  stories: [
    '../src/stories/**/*.mdx',
    '../src/stories/**/*.stories.@(ts|tsx)',
  ],
  addons: [
    '@storybook/addon-docs',
    '@storybook/addon-a11y',
    '@storybook/addon-vitest',
  ],
  framework: {
    name: '@storybook/react-vite',
    options: {},
  },
  async viteFinal(config) {
    config.plugins = [
      ...(config.plugins ?? []),
      {
        name: 'storybook-file-url-resolver',
        enforce: 'pre',
        resolveId(id) {
          if (id.startsWith('file://')) {
            return fileURLToPath(id)
          }
          return null
        },
      },
    ]
    config.assetsInclude = [
      ...(Array.isArray(config.assetsInclude) ? config.assetsInclude : []),
      '**/*.glb',
    ]
    config.resolve = {
      ...config.resolve,
      alias: {
        ...(Array.isArray(config.resolve?.alias) ? {} : config.resolve?.alias),
        '@': path.resolve(packageRoot, 'src'),
        '@tauri-apps/api/core': path.resolve(packageRoot, 'tests/test/stubs/tauri-api-core.ts'),
        '@tauri-apps/api/event': path.resolve(packageRoot, 'tests/test/stubs/tauri-api-event.ts'),
      },
    }
    config.optimizeDeps = {
      ...config.optimizeDeps,
      include: [
        ...(config.optimizeDeps?.include ?? []),
        '@lobehub/icons',
      ],
    }
    config.ssr = {
      ...config.ssr,
      noExternal: [
        ...(Array.isArray(config.ssr?.noExternal) ? config.ssr.noExternal : []),
        '@lobehub/icons',
      ],
    }
    config.server = {
      ...config.server,
      proxy: {
        ...config.server?.proxy,
        '/api': 'http://127.0.0.1:3000',
      },
    }
    return config
  },
}

export default config
