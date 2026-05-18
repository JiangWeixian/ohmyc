import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

// Tauri-friendly Vite config. Port 1420 to avoid collision with packages/ui (5173).
export default defineConfig({
  plugins: [react()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
  },
  build: {
    target: 'es2020',
    minify: process.env.TAURI_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  resolve: {
    alias: {
      '@': path.resolve(import.meta.dirname, './src'),
    },
  },
})
