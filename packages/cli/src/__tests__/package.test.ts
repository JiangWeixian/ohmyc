import { describe, it, expect } from 'vitest';
import { readFileSync, existsSync, statSync } from 'fs';
import path from 'path';

const pkgPath = path.resolve(__dirname, '../../package.json');
const pkg = JSON.parse(readFileSync(pkgPath, 'utf-8'));

const tsupConfigPath = path.resolve(__dirname, '../../tsup.config.ts');
const tsupConfigText = readFileSync(tsupConfigPath, 'utf-8');

const distIndexPath = path.resolve(__dirname, '../../dist/index.cjs');
const distUiHtmlPath = path.resolve(__dirname, '../../dist/ui/index.html');
const distExists = existsSync(distIndexPath);

// Node.js built-in modules that appear as bare specifiers but are NOT npm packages
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events',
  'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector', 'module',
  'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers',
  'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib',
]);

const RUNTIME_DEPS = [
  '@claudeui/shared',
  '@fastify/static',
  'cac',
  'fastify',
  'get-port',
  'gray-matter',
  'open',
  'proper-lockfile',
  'zod-to-json-schema',
];

describe('Package configuration', () => {
  it('bin.cu points to dist/index.cjs', () => {
    expect(pkg.bin.cu).toBe('dist/index.cjs');
  });

  it('files field is an allowlist with dist and README.md', () => {
    expect(pkg.files).toBeDefined();
    expect(Array.isArray(pkg.files)).toBe(true);
    expect(pkg.files).toContain('dist');
    expect(pkg.files).toContain('README.md');
    expect(pkg.files.length).toBe(2);
  });

  it('prepublishOnly script runs build:full before name rewrite', () => {
    expect(pkg.scripts.prepublishOnly).toBe('pnpm build:full && node scripts/prepublish.mjs');
  });

  it('publishConfig is set for public access', () => {
    expect(pkg.publishConfig).toBeDefined();
    expect(pkg.publishConfig.access).toBe('public');
    expect(pkg.publishConfig.registry).toBe('https://registry.npmjs.org/');
  });

  it('workspace name is preserved as @claudeui/cli', () => {
    expect(pkg.name).toBe('@claudeui/cli');
  });

  it('noExternal list in tsup config covers all runtime dependencies', () => {
    for (const dep of RUNTIME_DEPS) {
      expect(
        tsupConfigText.includes(dep),
        `tsup config should include "${dep}" in noExternal`,
      ).toBe(true);
    }
  });

  it('tsup config uses CJS format', () => {
    expect(tsupConfigText).toMatch(/format:\s*\[\s*['"]cjs['"]\s*\]/);
    expect(tsupConfigText).not.toMatch(/format:\s*\[\s*['"]esm['"]\s*\]/);
  });

  const distTestSkip = distExists ? it : it.skip;

  distTestSkip('dist/index.cjs exists after build', () => {
    const stat = statSync(distIndexPath);
    expect(stat.size).toBeGreaterThan(0);
  });

  distTestSkip('dist/index.cjs has no external npm package imports', () => {
    const bundleContent = readFileSync(distIndexPath, 'utf-8');

    // Check ESM from imports
    const esmImports = bundleContent.match(
      /(?<=from\s['"])(?!node:|\.\/|\.\.\/)[^'"]+(?=['"])/g,
    ) || [];

    // Check CJS require calls for npm packages
    // Match require("X") or require('X') but not __require("X") (internal shim)
    const cjsImports = bundleContent.match(
      /(?<![_\w])require\(\s*['"]([^'"]+)['"]\s*\)/g,
    ) || [];
    // Extract just the module names from require() calls
    const cjsSpecifiers = cjsImports.map(m => {
      const match = m.match(/require\(\s*['"]([^'"]+)['"]\s*\)/);
      return match ? match[1] : '';
    });

    // Filter out Node.js built-in modules and internal bundled subpath references
    // Subpath references (e.g. "ajv/dist/runtime/validation_error") are internal
    // require() calls within bundled code -- the packages are already inlined.
    const npmImports = [...esmImports, ...cjsSpecifiers]
      .filter((spec) => !NODE_BUILTINS.has(spec) && !spec.includes('/'));

    expect(npmImports).toEqual([]);
  });

  distTestSkip('dist/ui/index.html exists after build', () => {
    expect(existsSync(distUiHtmlPath)).toBe(true);
  });

  distTestSkip('node dist/index.cjs --help runs without errors', async () => {
    const { execSync } = await import('child_process');
    const output = execSync('node dist/index.cjs --help', {
      cwd: path.resolve(__dirname, '../..'),
      encoding: 'utf-8',
      timeout: 10000,
    });
    expect(output).toContain('start');
    expect(output).toContain('--version');
  });
});
