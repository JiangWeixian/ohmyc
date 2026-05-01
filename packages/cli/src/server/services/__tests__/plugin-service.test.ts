import {
  mkdirSync,
  mkdtempSync,
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
} from 'vitest'

import { PluginService } from '../plugin-service'

describe('PluginService', () => {
  let tmpDir: string
  let pluginsDir: string
  let settingsPath: string
  let service: PluginService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'plugin-test-'))
    pluginsDir = path.join(tmpDir, 'plugins')
    settingsPath = path.join(tmpDir, 'settings.json')
    mkdirSync(pluginsDir, { recursive: true })
    service = new PluginService(pluginsDir, settingsPath)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('listPlugins()', () => {
    it('returns empty array when no installed_plugins.json', async () => {
      expect(await service.listPlugins()).toEqual([])
    })

    it('returns empty array for empty plugins object', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: {} }))
      expect(await service.listPlugins()).toEqual([])
    })

    it('parses installed plugins with id split', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'gitlab@tmates-plugins': [{
            version: '0.0.1',
            installedAt: '2026-02-04T02:33:12.901Z',
            lastUpdated: '2026-02-04T02:33:12.901Z',
            installPath: '/tmp/nonexistent',
            scope: 'user',
          }],
        },
      }))

      const plugins = await service.listPlugins()
      expect(plugins).toHaveLength(1)
      expect(plugins[0].id).toBe('gitlab@tmates-plugins')
      expect(plugins[0].name).toBe('gitlab')
      expect(plugins[0].marketplace).toBe('tmates-plugins')
      expect(plugins[0].enabled).toBe(false)
      expect(plugins[0].manifest).toBeNull()
    })

    it('marks enabled plugins from settings.json', async () => {
      writeFileSync(settingsPath, JSON.stringify({
        enabledPlugins: { 'gitlab@tmates-plugins': true },
      }))
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'gitlab@tmates-plugins': [{
            version: '0.0.1',
            installedAt: '2026-01-01',
            lastUpdated: '2026-01-01',
            installPath: '/tmp/nonexistent',
            scope: 'user',
          }],
          'other@market': [{
            version: '1.0',
            installedAt: '2026-01-01',
            lastUpdated: '2026-01-01',
            installPath: '/tmp/nonexistent',
            scope: 'user',
          }],
        },
      }))

      const plugins = await service.listPlugins()
      expect(plugins).toHaveLength(2)
      const gitlab = plugins.find(p => p.name === 'gitlab')!
      const other = plugins.find(p => p.name === 'other')!
      expect(gitlab.enabled).toBe(true)
      expect(other.enabled).toBe(false)
    })

    it('loads plugin.json manifest when available', async () => {
      const installPath = path.join(tmpDir, 'install', 'my-plugin')
      mkdirSync(installPath, { recursive: true })
      writeFileSync(path.join(installPath, 'plugin.json'), JSON.stringify({
        name: 'my-plugin',
        version: '1.0.0',
        description: 'A cool plugin',
      }))

      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'my-plugin@market': [{
            version: '1.0.0',
            installedAt: '2026-01-01',
            lastUpdated: '2026-01-01',
            installPath,
            scope: 'user',
          }],
        },
      }))

      const plugins = await service.listPlugins()
      expect(plugins[0].manifest).not.toBeNull()
      expect(plugins[0].manifest!.description).toBe('A cool plugin')
    })

    it('scans components (agents, skills, commands)', async () => {
      const installPath = path.join(tmpDir, 'install', 'full-plugin')

      // agents: flat .md files
      mkdirSync(path.join(installPath, 'agents'), { recursive: true })
      writeFileSync(path.join(installPath, 'agents', 'reviewer.md'), '---\nname: reviewer\n---\nprompt')
      writeFileSync(path.join(installPath, 'agents', 'debugger.md'), '---\nname: debugger\n---\nprompt')

      // skills: dirs with SKILL.md
      mkdirSync(path.join(installPath, 'skills', 'deploy-skill'), { recursive: true })
      writeFileSync(path.join(installPath, 'skills', 'deploy-skill', 'SKILL.md'), '---\nname: deploy\n---\nprompt')
      mkdirSync(path.join(installPath, 'skills', 'empty-dir'), { recursive: true })
      // empty-dir has no SKILL.md, should be skipped

      // commands: flat .md files
      mkdirSync(path.join(installPath, 'commands'), { recursive: true })
      writeFileSync(path.join(installPath, 'commands', 'commit-push.md'), 'commit and push')
      writeFileSync(path.join(installPath, 'commands', 'notes.txt'), 'not a command')

      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'full@market': [{
            version: '1.0.0',
            installedAt: '2026-01-01',
            lastUpdated: '2026-01-01',
            installPath,
            scope: 'user',
          }],
        },
      }))

      const plugins = await service.listPlugins()
      expect(plugins).toHaveLength(1)
      const { components } = plugins[0]
      expect(components.agents).toEqual(['debugger', 'reviewer'])
      expect(components.skills).toEqual(['deploy-skill'])
      expect(components.commands).toEqual(['commit-push'])
      expect(components.hooks).toBeNull()
      expect(components.mcpServers).toBeNull()
      expect(components.lspServers).toBeNull()
    })

    it('scans hooks, mcp, and lsp configs', async () => {
      const installPath = path.join(tmpDir, 'install', 'config-plugin')
      mkdirSync(path.join(installPath, 'hooks'), { recursive: true })

      const hooksData = { hooks: { PostToolUse: [{ matcher: 'Write', hooks: [{ type: 'command', command: 'echo hi' }] }] } }
      writeFileSync(path.join(installPath, 'hooks', 'hooks.json'), JSON.stringify(hooksData))

      const mcpData = { mcpServers: { db: { command: 'node', args: ['server.js'] } } }
      writeFileSync(path.join(installPath, '.mcp.json'), JSON.stringify(mcpData))

      const lspData = { python: { command: 'pyright', extensionToLanguage: { '.py': 'python' } } }
      writeFileSync(path.join(installPath, '.lsp.json'), JSON.stringify(lspData))

      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'config@m': [{ version: '1', installedAt: '', lastUpdated: '', installPath, scope: 'user' }],
        },
      }))

      const plugins = await service.listPlugins()
      const { components } = plugins[0]
      expect(components.hooks).toEqual(hooksData)
      expect(components.mcpServers).toEqual(mcpData)
      expect(components.lspServers).toEqual(lspData)
    })

    it('returns empty components when plugin has no sub-dirs', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'bare@m': [{ version: '1', installedAt: '', lastUpdated: '', installPath: '/tmp/nonexistent', scope: 'user' }],
        },
      }))

      const plugins = await service.listPlugins()
      expect(plugins[0].components).toEqual({
        agents: [],
        skills: [],
        commands: [],
        hooks: null,
        mcpServers: null,
        lspServers: null,
      })
    })

    it('returns sorted by name', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'zebra@m': [{ version: '1', installedAt: '', lastUpdated: '', installPath: '', scope: 'user' }],
          'alpha@m': [{ version: '1', installedAt: '', lastUpdated: '', installPath: '', scope: 'user' }],
        },
      }))

      const plugins = await service.listPlugins()
      expect(plugins[0].name).toBe('alpha')
      expect(plugins[1].name).toBe('zebra')
    })
  })

  describe('getPlugin()', () => {
    it('returns plugin by id', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({
        version: 2,
        plugins: {
          'test@market': [{ version: '1', installedAt: '', lastUpdated: '', installPath: '', scope: 'user' }],
        },
      }))

      const plugin = await service.getPlugin('test@market')
      expect(plugin).not.toBeNull()
      expect(plugin!.name).toBe('test')
    })

    it('returns null when not found', async () => {
      writeFileSync(path.join(pluginsDir, 'installed_plugins.json'), JSON.stringify({ version: 2, plugins: {} }))
      expect(await service.getPlugin('nope')).toBeNull()
    })
  })

  describe('listMarketplaces()', () => {
    it('returns empty array when no file', async () => {
      expect(await service.listMarketplaces()).toEqual([])
    })

    it('parses known marketplaces', async () => {
      writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({
        'my-market': {
          source: { source: 'git', url: 'https://github.com/test/repo' },
          installLocation: '/tmp/market',
          lastUpdated: '2026-01-01',
          autoUpdate: true,
        },
      }))

      const markets = await service.listMarketplaces()
      expect(markets).toHaveLength(1)
      expect(markets[0].id).toBe('my-market')
      expect(markets[0].source.url).toBe('https://github.com/test/repo')
      expect(markets[0].autoUpdate).toBe(true)
    })

    it('returns sorted by id', async () => {
      writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({
        zebra: { source: { source: 'git' }, installLocation: '/tmp/z' },
        alpha: { source: { source: 'git' }, installLocation: '/tmp/a' },
      }))

      const markets = await service.listMarketplaces()
      expect(markets[0].id).toBe('alpha')
      expect(markets[1].id).toBe('zebra')
    })
  })

  describe('getMarketplace()', () => {
    it('returns marketplace by id', async () => {
      writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({
        test: { source: { source: 'git', url: 'https://test.com' }, installLocation: '/tmp/t' },
      }))

      const market = await service.getMarketplace('test')
      expect(market).not.toBeNull()
      expect(market!.source.url).toBe('https://test.com')
    })

    it('returns null when not found', async () => {
      writeFileSync(path.join(pluginsDir, 'known_marketplaces.json'), JSON.stringify({}))
      expect(await service.getMarketplace('nope')).toBeNull()
    })
  })
})
