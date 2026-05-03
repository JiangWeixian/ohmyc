import {
  existsSync,
  readFileSync,
  statSync,
} from 'node:fs'
import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

const packagePath = path.resolve(import.meta.dirname, '../../package.json')
const package_ = JSON.parse(readFileSync(packagePath, 'utf8'))

const tsupConfigPath = path.resolve(import.meta.dirname, '../../tsup.config.ts')
const tsupConfigText = readFileSync(tsupConfigPath, 'utf8')

const distributionIndexPath = path.resolve(import.meta.dirname, '../../dist/index.mjs')
const distributionUiHtmlPath = path.resolve(import.meta.dirname, '../../dist/ui/index.html')
const distributionExists = existsSync(distributionIndexPath)

// Node.js built-in modules that appear as bare specifiers but are NOT npm packages
const NODE_BUILTINS = new Set([
  'assert', 'async_hooks', 'buffer', 'child_process', 'cluster', 'console', 'constants',
  'crypto', 'dgram', 'diagnostics_channel', 'dns', 'domain', 'events',
  'fs', 'fs/promises', 'http', 'http2', 'https', 'inspector', 'module',
  'net', 'os', 'path', 'perf_hooks', 'process', 'punycode', 'querystring',
  'readline', 'repl', 'stream', 'string_decoder', 'sys', 'timers',
  'tls', 'trace_events', 'tty', 'url', 'util', 'v8', 'vm', 'wasi',
  'worker_threads', 'zlib',
])

const RUNTIME_DEPS = [
  '@ohmyc/shared',
  '@fastify/static',
  'cac',
  'fastify',
  'get-port',
  'gray-matter',
  'open',
  'proper-lockfile',
  'untildify',
  'zod-to-json-schema',
]

describe('Package configuration', () => {
  it('bin.cu points to dist/index.mjs', () => {
    expect(package_.bin.cu).toBe('dist/index.mjs')
  })

  it('files field is an allowlist with dist and README.md', () => {
    expect(package_.files).toBeDefined()
    expect(Array.isArray(package_.files)).toBe(true)
    expect(package_.files).toContain('dist')
    expect(package_.files).toContain('README.md')
    expect(package_.files.length).toBe(2)
  })

  it('prepublishOnly script runs build:full before name rewrite', () => {
    expect(package_.scripts.prepublishOnly).toBe('pnpm build:full && node scripts/prepublish.mjs')
  })

  it('publishConfig is set for public access', () => {
    expect(package_.publishConfig).toBeDefined()
    expect(package_.publishConfig.access).toBe('public')
    expect(package_.publishConfig.registry).toBe('https://registry.npmjs.org/')
  })

  it('workspace name is preserved as @ohmyc/cli', () => {
    expect(package_.name).toBe('@ohmyc/cli')
  })

  it('noExternal list in tsup config covers all runtime dependencies', () => {
    for (const dep of RUNTIME_DEPS) {
      expect(
        tsupConfigText.includes(dep),
        `tsup config should include "${dep}" in noExternal`,
      ).toBe(true)
    }
  })

  it('tsup config uses ESM format', () => {
    expect(tsupConfigText).toMatch(/format:\s*\[\s*['"]esm['"]\s*\]/)
    expect(tsupConfigText).not.toMatch(/format:\s*\[\s*['"]cjs['"]\s*\]/)
  })

  const distributionTestSkip = distributionExists ? it : it.skip
  const distributionUiSkip = existsSync(distributionUiHtmlPath) ? it : it.skip

  distributionTestSkip('dist/index.mjs exists after build', () => {
    const stat = statSync(distributionIndexPath)
    expect(stat.size).toBeGreaterThan(0)
  })

  distributionTestSkip('dist/index.mjs has no external npm package imports', () => {
    const bundleContent = readFileSync(distributionIndexPath, 'utf8')

    // Check ESM from imports
    const esmImports = bundleContent.match(
      /(?<=from\s['"])(?!node:|\.\/|\.\.\/)[^'"]+(?=['"])/g,
    ) || []

    // Check CJS require calls for npm packages
    // Match require("X") or require('X') but not __require("X") (internal shim)
    const cjsImports = bundleContent.match(
      /\brequire\(\s*['"]([^'"]+)['"]\s*\)/g,
    ) || []
    // Extract just the module names from require() calls
    const cjsSpecifiers = cjsImports.map((m) => {
      const match = m.match(/require\(\s*['"]([^'"]+)['"]\s*\)/)
      return match ? match[1] : ''
    })

    // Filter out Node.js built-in modules and internal bundled subpath references
    // Subpath references (e.g. "ajv/dist/runtime/validation_error") are internal
    // require() calls within bundled code -- the packages are already inlined.
    const ALLOWED_EXTERNALS = new Set(['better-sqlite3'])

    const npmImports = [...esmImports, ...cjsSpecifiers]
      .filter(spec => !NODE_BUILTINS.has(spec) && !spec.includes('/') && !ALLOWED_EXTERNALS.has(spec))

    expect(npmImports).toEqual([])
  })

  distributionUiSkip('dist/ui/index.html exists after build', () => {
    expect(existsSync(distributionUiHtmlPath)).toBe(true)
  })

  distributionTestSkip('node dist/index.mjs --help runs without errors', async () => {
    const { execSync } = await import('node:child_process')
    const output = execSync('node dist/index.mjs --help', {
      cwd: path.resolve(import.meta.dirname, '../..'),
      encoding: 'utf8',
      timeout: 10_000,
    })
    expect(output).toContain('start')
    expect(output).toContain('--version')
  })
})
