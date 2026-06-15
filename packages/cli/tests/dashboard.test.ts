import {
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import {
  getInstalledPluginsPath,
  getPluginSourceDir,
  readInstalledPlugins,
  runInstall,
  writeInstalledPlugins,
} from '../src/commands/dashboard'

vi.mock('@ohmyc/timeline', () => ({
  backfillAll: vi.fn(() => ({ indexed: 0, skipped: 0, errors: 0 })),
  closeDatabase: vi.fn(),
  getStatus: vi.fn(() => ({ lastSyncAt: 1, sessionCount: 7 })),
  openDatabase: vi.fn(() => ({ prepare: vi.fn() })),
}))

vi.mock('../src/logger', () => ({
  logger: {
    info: vi.fn(),
    warn: vi.fn(),
    error: vi.fn(),
  },
}))

const originalAgentHome = process.env.AGENT_HOME

describe('dashboard plugin registry helpers', () => {
  let tmpDir: string

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'ohmyc-cli-dashboard-'))
    process.env.AGENT_HOME = path.join(tmpDir, '.claude')
  })

  afterEach(() => {
    process.env.AGENT_HOME = originalAgentHome
    rmSync(tmpDir, { recursive: true, force: true })
    vi.restoreAllMocks()
  })

  it('reads an empty installed plugin registry when the file is absent', () => {
    expect(getInstalledPluginsPath()).toBe(path.join(tmpDir, '.claude', 'plugins', 'installed_plugins.json'))
    expect(readInstalledPlugins()).toEqual({ version: 1, plugins: {} })
  })

  it('writes the installed plugin registry under AGENT_HOME', () => {
    writeInstalledPlugins({
      version: 1,
      plugins: {
        'ohmyc-timeline': [{
          version: '1.0.0',
          installedAt: '2026-06-15T00:00:00.000Z',
          lastUpdated: '2026-06-15T00:00:00.000Z',
          installPath: '/tmp/plugin',
          isLocal: true,
          scope: 'user',
        }],
      },
    })

    const raw = readFileSync(getInstalledPluginsPath(), 'utf8')
    expect(JSON.parse(raw).plugins['ohmyc-timeline'][0].installPath).toBe('/tmp/plugin')
  })

  it('does not resolve the removed monorepo plugins/timeline source path', () => {
    const resolved = getPluginSourceDir()

    expect(resolved).not.toContain(`${path.sep}plugins${path.sep}timeline`)
    expect(resolved).toContain(`${path.sep}node_modules${path.sep}@ohmyc${path.sep}timeline-plugin`)
  })

  it('registers the resolved local plugin package path during install', async () => {
    mkdirSync(path.dirname(getInstalledPluginsPath()), { recursive: true })
    writeFileSync(getInstalledPluginsPath(), JSON.stringify({ version: 1, plugins: {} }), 'utf8')

    await runInstall()

    const registry = JSON.parse(readFileSync(getInstalledPluginsPath(), 'utf8'))
    const install = registry.plugins['ohmyc-timeline'][0]
    expect(install.installPath).toBe(getPluginSourceDir())
    expect(install.isLocal).toBe(true)
    expect(install.scope).toBe('user')
  })
})
