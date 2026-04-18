import { defineConfig } from 'tsup';
import { cpSync, existsSync } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));

export default defineConfig({
  entry: ['src/index.ts'],
  format: ['cjs'],
  splitting: false,
  clean: true,
  esbuildOptions(options) {
    // In CJS output, import.meta is not available. Inject a banner variable
    // that provides import.meta.url from __filename, then define import.meta.url
    // to reference it. This keeps source code using standard ESM patterns.
    options.banner = options.banner || {};
    options.banner.js = `var _importMetaUrl = require("url").pathToFileURL(__filename).href;`;
    options.define = options.define || {};
    options.define['import.meta.url'] = '_importMetaUrl';
  },
  noExternal: [
    '@claudeui/shared',
    '@fastify/static',
    'cac',
    'fastify',
    'get-port',
    'gray-matter',
    'open',
    'proper-lockfile',
    'zod-to-json-schema',
  ],
  onSuccess: async () => {
    const uiDist = path.resolve(__dirname, '../ui/dist');
    const cliUiDist = path.resolve(__dirname, 'dist/ui');

    if (existsSync(uiDist)) {
      cpSync(uiDist, cliUiDist, { recursive: true });
      console.log(`Copied UI assets from ${uiDist} to ${cliUiDist}`);
    } else {
      console.warn(`Warning: UI dist not found at ${uiDist}. Run 'pnpm --filter @claudeui/ui build' first.`);
    }
  },
});
