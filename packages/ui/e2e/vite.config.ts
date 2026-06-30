import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

const dirname = path.dirname(new URL(import.meta.url).pathname)
const stubsDir = path.resolve(dirname, 'stubs')

export default defineConfig({
  plugins: [react()],
  assetsInclude: ['**/*.glb'],
  define: {
    'import.meta.env.VITE_TRANSPORT': JSON.stringify('mock'),
  },
  resolve: {
    alias: {
      '@': path.resolve(dirname, '../src'),
      '@tauri-apps/api/core': path.resolve(stubsDir, 'tauri-api-core.ts'),
      '@tauri-apps/api/event': path.resolve(stubsDir, 'tauri-api-event.ts'),
      '@tauri-apps/api/webviewWindow': path.resolve(stubsDir, 'tauri-api-webview-window.ts'),
    },
  },
  server: {
    port: 7335,
    strictPort: true,
  },
})
