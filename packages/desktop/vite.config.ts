import path from 'node:path'

import react from '@vitejs/plugin-react'
import { defineConfig } from 'vite'

import type { Plugin } from 'vite'

const uiSrc = path.resolve(import.meta.dirname, '../ui/src')
const desktopSrc = path.resolve(import.meta.dirname, './src')

/**
 * Plugin that resolves `@/` imports context-sensitively:
 *  - Importers inside packages/ui/src  → packages/ui/src/
 *  - All other importers              → packages/desktop/src/
 *
 * This is required because @ohmyc/ui exports raw .tsx source files and
 * internally uses the `@/` alias pointing at its own src root.  Without this
 * plugin, Vite's static alias would send every `@/` to the desktop src tree.
 *
 * The plugin runs in `pre` enforce order so it wins before static aliases.
 */
function uiAliasPlugin(): Plugin {
  return {
    name: 'ohmyc-ui-alias',
    enforce: 'pre',
    async resolveId(source, importer) {
      if (!source.startsWith('@/')) {
        return null
      }
      const root = importer && importer.startsWith(uiSrc) ? uiSrc : desktopSrc
      const rel = source.slice(2) // strip '@/'
      const resolved = await this.resolve(path.resolve(root, rel), importer, { skipSelf: true })
      return resolved ?? null
    },
  }
}

// Tauri-friendly Vite config. Port 1420 to avoid collision with packages/ui (5173).
export default defineConfig({
  define: {
    'import.meta.env.VITE_TRANSPORT': JSON.stringify('tauri'),
  },
  plugins: [react(), uiAliasPlugin()],
  clearScreen: false,
  server: {
    port: 1420,
    strictPort: true,
    proxy: {
      '/api': 'http://127.0.0.1:3000',
    },
  },
  build: {
    target: 'es2020',
    minify: process.env.TAURI_DEBUG ? false : 'esbuild',
    sourcemap: !!process.env.TAURI_DEBUG,
  },
  resolve: {
    alias: [
      // @ohmyc/ui sub-path exports → ui source tree
      { find: /^@ohmyc\/ui\/components(.*)$/, replacement: `${uiSrc}/components$1` },
      { find: /^@ohmyc\/ui\/hooks(.*)$/, replacement: `${uiSrc}/hooks$1` },
      { find: /^@ohmyc\/ui\/state(.*)$/, replacement: `${uiSrc}/state$1` },
      { find: /^@ohmyc\/ui\/lib(.*)$/, replacement: `${uiSrc}/lib$1` },
      // NOTE: `@/` is NOT listed here — uiAliasPlugin (enforce:'pre') handles
      // it context-sensitively before the alias table is consulted.
    ],
  },
})
