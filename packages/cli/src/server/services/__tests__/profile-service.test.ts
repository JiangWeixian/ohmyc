import {
  existsSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readlinkSync,
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

import { ActivationBlockedError, ProfileService } from '../profile-service'

describe('ProfileService', () => {
  let tmpDir: string
  let service: ProfileService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'profile-test-'))
    service = new ProfileService(tmpDir, path.join(tmpDir, 'settings.json'))
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  // Shared helper for model config tests
  function writeModelConfig(name: string, fields: { apiKey?: string; baseUrl?: string; modelName?: string }) {
    const config = {
      name,
      apiKey: fields.apiKey ?? 'sk-test-key-1234',
      baseUrl: fields.baseUrl ?? 'https://api.anthropic.com',
      modelName: fields.modelName ?? '',
      provider: '',
    }
    writeFileSync(
      path.join(tmpDir, 'store', 'model-configs', `${name}.json`),
      JSON.stringify(config, null, 2),
      'utf8',
    )
  }

  describe('list()', () => {
    it('returns empty array when no profiles', async () => {
      const { profiles, active } = await service.list()
      expect(profiles).toEqual([])
      expect(active).toBeNull()
    })

    it('returns profiles sorted by name', async () => {
      await service.create({ name: 'zebra', description: 'Z' })
      await service.create({ name: 'alpha', description: 'A' })
      const { profiles } = await service.list()
      expect(profiles).toHaveLength(2)
      expect(profiles[0].name).toBe('alpha')
      expect(profiles[1].name).toBe('zebra')
    })

    it('returns active profile name', async () => {
      await service.create({ name: 'test' })
      await service.activate('test')
      const { active } = await service.list()
      expect(active).toBe('test')
    })
  })

  describe('get()', () => {
    it('returns profile by name', async () => {
      await service.create({ name: 'my-profile', description: 'Test', agents: ['reviewer'] })
      const profile = await service.get('my-profile')
      expect(profile).not.toBeNull()
      expect(profile!.name).toBe('my-profile')
      expect(profile!.agents).toEqual(['reviewer'])
    })

    it('returns null when not found', async () => {
      expect(await service.get('nope')).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates profile directory with profile.json', async () => {
      const profile = await service.create({ name: 'new-prof', description: 'New' })
      expect(profile.name).toBe('new-prof')
      expect(existsSync(path.join(tmpDir, 'profiles', 'new-prof', 'profile.json'))).toBe(true)
    })

    it('throws for duplicate name', async () => {
      await service.create({ name: 'dup' })
      await expect(service.create({ name: 'dup' })).rejects.toThrow('already exists')
    })

    it('throws for reserved name', async () => {
      await expect(service.create({ name: 'store' })).rejects.toThrow('reserved')
    })

    it('throws for invalid name', async () => {
      await expect(service.create({ name: '../evil' })).rejects.toThrow('invalid')
    })
  })

  describe('update()', () => {
    it('merges updates into profile.json', async () => {
      await service.create({ name: 'up', description: 'Old', agents: ['a'] })
      const updated = await service.update('up', { description: 'New', skills: ['s'] })
      expect(updated!.description).toBe('New')
      expect(updated!.agents).toEqual(['a']) // preserved
      expect(updated!.skills).toEqual(['s'])
    })

    it('returns null when not found', async () => {
      expect(await service.update('nope', { description: 'x' })).toBeNull()
    })
  })

  describe('delete()', () => {
    it('deletes profile directory', async () => {
      await service.create({ name: 'del' })
      expect(await service.delete('del')).toBe(true)
      expect(existsSync(path.join(tmpDir, 'profiles', 'del'))).toBe(false)
    })

    it('returns false when not found', async () => {
      expect(await service.delete('nope')).toBe(false)
    })
  })

  describe('activate()', () => {
    beforeEach(async () => {
      // Create store with components
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Review\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'skills', 'deploy'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'skills', 'deploy', 'SKILL.md'), '---\nname: deploy\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'commands'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'commands', 'push.md'), '---\nname: push\n---\nprompt')

      // Create settings.json
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    })

    it('creates symlinks to store components', async () => {
      await service.create({ name: 'test', agents: ['reviewer'], skills: ['deploy'], commands: ['push'] })
      await service.activate('test')

      const agentLink = path.join(tmpDir, 'profiles', 'test', 'agents', 'reviewer.md')
      expect(existsSync(agentLink)).toBe(true)
      expect(lstatSync(agentLink).isSymbolicLink()).toBe(true)

      const skillLink = path.join(tmpDir, 'profiles', 'test', 'skills', 'deploy')
      expect(existsSync(skillLink)).toBe(true)
      expect(lstatSync(skillLink).isSymbolicLink()).toBe(true)

      const commandLink = path.join(tmpDir, 'profiles', 'test', 'commands', 'push.md')
      expect(existsSync(commandLink)).toBe(true)
      expect(lstatSync(commandLink).isSymbolicLink()).toBe(true)
    })

    it('symlinks resolve to store directory targets', async () => {
      await service.create({ name: 'test', agents: ['reviewer'], skills: ['deploy'], commands: ['push'] })
      await service.activate('test')

      const agentLink = path.join(tmpDir, 'profiles', 'test', 'agents', 'reviewer.md')
      expect(readlinkSync(agentLink)).toContain(path.join('store', 'agents', 'reviewer.md'))

      const skillLink = path.join(tmpDir, 'profiles', 'test', 'skills', 'deploy')
      expect(readlinkSync(skillLink)).toContain(path.join('store', 'skills', 'deploy'))

      const commandLink = path.join(tmpDir, 'profiles', 'test', 'commands', 'push.md')
      expect(readlinkSync(commandLink)).toContain(path.join('store', 'commands', 'push.md'))
    })

    it('generates plugin files including .lsp.json', async () => {
      await service.create({
        name: 'test',
        hooks: { PreToolUse: [] },
        mcpServers: { db: { command: 'node' } },
        lspServers: { 'typescript-language-server': { command: 'typescript-language-server' } },
      })
      await service.activate('test')

      const profileDir = path.join(tmpDir, 'profiles', 'test')
      expect(existsSync(path.join(profileDir, '.claude-plugin', 'plugin.json'))).toBe(true)
      expect(existsSync(path.join(profileDir, 'hooks', 'hooks.json'))).toBe(true)
      expect(existsSync(path.join(profileDir, '.mcp.json'))).toBe(true)
      expect(existsSync(path.join(profileDir, '.lsp.json'))).toBe(true)
    })

    it('backs up and merges settings.json', async () => {
      await service.create({
        name: 'test',
        plugins: ['gitlab@market'],
        settings: { effort: 'high' },
      })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'settings.backup.test.json'))).toBe(true)

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.model).toBe('sonnet') // preserved
      expect(settings.effort).toBe('high') // merged
      expect(settings.enabledPlugins['gitlab@market']).toBe(true)
    })

    it('writes .active with absolute path but list() returns bare name', async () => {
      await service.create({ name: 'test' })
      await service.activate('test')

      // On-disk format is still an absolute path
      const activeFile = readFileSync(path.join(tmpDir, 'profiles', '.active'), 'utf8').trim()
      expect(path.isAbsolute(activeFile)).toBe(true)
      expect(activeFile).toContain('test')

      // But list() normalizes to the bare profile name
      const { active } = await service.list()
      expect(active).toBe('test')
    })

    it('deactivates previous profile before activating new one', async () => {
      await service.create({ name: 'first' })
      await service.create({ name: 'second' })
      await service.activate('first')
      await service.activate('second')

      const active = readFileSync(path.join(tmpDir, 'profiles', '.active'), 'utf8').trim()
      expect(active).toContain('second')

      // settings.json should be merged from original backup, not from first's merge
      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.model).toBe('sonnet')
    })

    it('writes to claudeSettingsPath, not baseDir/settings.json', async () => {
      // Use a separate claude settings path to prove routing
      const claudeDir = path.join(tmpDir, 'claude')
      mkdirSync(claudeDir, { recursive: true })
      const claudeSettingsPath = path.join(claudeDir, 'settings.json')
      writeFileSync(claudeSettingsPath, JSON.stringify({ model: 'opus' }))

      const isolated = new ProfileService(tmpDir, claudeSettingsPath)
      // store/agents already populated by outer beforeEach; recreate empty cui settings
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'unchanged-cui' }))

      await isolated.create({ name: 'test', plugins: ['gitlab@market'], settings: { effort: 'high' } })
      await isolated.activate('test')

      // claude settings.json got merged
      const claudeSettings = JSON.parse(readFileSync(claudeSettingsPath, 'utf8'))
      expect(claudeSettings.model).toBe('opus')
      expect(claudeSettings.effort).toBe('high')
      expect(claudeSettings.enabledPlugins['gitlab@market']).toBe(true)

      // cui settings.json was NOT touched
      const cuiSettings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(cuiSettings).toEqual({ model: 'unchanged-cui' })

      // Backup snapshot reflects pre-activation claude state
      const backup = JSON.parse(readFileSync(path.join(tmpDir, 'settings.backup.test.json'), 'utf8'))
      expect(backup).toEqual({ model: 'opus' })
    })

    it('uses per-profile backup naming when switching', async () => {
      await service.create({ name: 'first', settings: { effort: 'low' } })
      await service.create({ name: 'second', settings: { effort: 'high' } })
      await service.activate('first')
      await service.activate('second')

      // Should have per-profile backup named after the profile being activated
      expect(existsSync(path.join(tmpDir, 'settings.backup.second.json'))).toBe(true)
    })
  })

  describe('activate() - transactional', () => {
    beforeEach(async () => {
      // Create store with components
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Review\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'skills', 'deploy'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'skills', 'deploy', 'SKILL.md'), '---\nname: deploy\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'commands'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'commands', 'push.md'), '---\nname: push\n---\nprompt')

      // Create settings.json
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    })

    it('throws ActivationBlockedError when a referenced agent is missing from store', async () => {
      await service.create({ name: 'test', agents: ['nonexistent'] })
      await expect(service.activate('test')).rejects.toThrow(ActivationBlockedError)
      await expect(service.activate('test')).rejects.toHaveProperty('missing', ['agent:nonexistent'])
    })

    it('throws ActivationBlockedError when a referenced skill is missing from store', async () => {
      await service.create({ name: 'test', skills: ['nonexistent'] })
      await expect(service.activate('test')).rejects.toThrow(ActivationBlockedError)
      await expect(service.activate('test')).rejects.toHaveProperty('missing', ['skill:nonexistent'])
    })

    it('throws ActivationBlockedError when a referenced command is missing from store', async () => {
      await service.create({ name: 'test', commands: ['nonexistent'] })
      await expect(service.activate('test')).rejects.toThrow(ActivationBlockedError)
      await expect(service.activate('test')).rejects.toHaveProperty('missing', ['command:nonexistent'])
    })

    it('no filesystem changes when activation is blocked by missing components', async () => {
      const settingsBefore = readFileSync(path.join(tmpDir, 'settings.json'), 'utf8')
      await service.create({ name: 'test', agents: ['nonexistent'], settings: { effort: 'high' } })

      await expect(service.activate('test')).rejects.toThrow()

      // No settings changes
      const settingsAfter = readFileSync(path.join(tmpDir, 'settings.json'), 'utf8')
      expect(settingsAfter).toBe(settingsBefore)

      // No .active marker
      expect(existsSync(path.join(tmpDir, 'profiles', '.active'))).toBe(false)

      // No backup file
      expect(existsSync(path.join(tmpDir, 'settings.backup.test.json'))).toBe(false)
    })

    it('switching A to B where B has missing components restores A', async () => {
      // Create and activate profile A with all components
      await service.create({ name: 'profile-a', agents: ['reviewer'], settings: { effort: 'low' } })
      await service.activate('profile-a')

      const { active: activeA } = await service.list()
      expect(activeA).toBe('profile-a')

      // Create profile B with missing component
      await service.create({ name: 'profile-b', agents: ['nonexistent'] })

      // Try to switch to B -- should fail and restore A
      await expect(service.activate('profile-b')).rejects.toThrow(ActivationBlockedError)

      // A should be restored as active
      const { active: activeAfter } = await service.list()
      expect(activeAfter).toBe('profile-a')

      // Profile A's symlinks should still exist
      expect(existsSync(path.join(tmpDir, 'profiles', 'profile-a', 'agents', 'reviewer.md'))).toBe(true)
    })

    it('returns settings overwrite warnings', async () => {
      // Current settings has 'effort' key
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet', effort: 'low' }))

      await service.create({ name: 'test', settings: { effort: 'high' } })
      const { warnings } = await service.activate('test')

      expect(warnings).toContain("Settings key 'effort' would be overwritten")
    })

    it('returns empty warnings when profile settings do not overlap with current', async () => {
      await service.create({ name: 'test', settings: { newKey: 'value' } })
      const { warnings } = await service.activate('test')

      expect(warnings).toEqual([])
    })
  })

  describe('preflight()', () => {
    beforeEach(() => {
      // Create store with components
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'skills', 'deploy'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'skills', 'deploy', 'SKILL.md'), '---\nname: deploy\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'commands'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'commands', 'push.md'), '---\nname: push\n---\nprompt')
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    })

    it('returns canActivate true when all components exist', async () => {
      await service.create({ name: 'test', agents: ['reviewer'], skills: ['deploy'], commands: ['push'] })
      const result = await service.preflight('test')
      expect(result.canActivate).toBe(true)
      expect(result.missing).toEqual([])
      expect(result.currentActive).toBeNull()
    })

    it('returns canActivate false when an agent is missing', async () => {
      await service.create({ name: 'test', agents: ['nonexistent'] })
      const result = await service.preflight('test')
      expect(result.canActivate).toBe(false)
      expect(result.missing).toContain('agent:nonexistent')
    })

    it('returns canActivate false when a skill is missing', async () => {
      await service.create({ name: 'test', skills: ['nonexistent'] })
      const result = await service.preflight('test')
      expect(result.canActivate).toBe(false)
      expect(result.missing).toContain('skill:nonexistent')
    })

    it('returns canActivate false when a command is missing', async () => {
      await service.create({ name: 'test', commands: ['nonexistent'] })
      const result = await service.preflight('test')
      expect(result.canActivate).toBe(false)
      expect(result.missing).toContain('command:nonexistent')
    })

    it('returns settings warnings for keys that would be overwritten', async () => {
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet', effort: 'low' }))
      await service.create({ name: 'test', settings: { effort: 'high' } })
      const result = await service.preflight('test')
      expect(result.settingsWarnings).toContain("Settings key 'effort' would be overwritten")
    })

    it('returns no settings warnings for new keys', async () => {
      await service.create({ name: 'test', settings: { brandNewKey: 'value' } })
      const result = await service.preflight('test')
      expect(result.settingsWarnings).toEqual([])
    })

    it('returns currentActive when a profile is active', async () => {
      await service.create({ name: 'test', agents: ['reviewer'] })
      await service.activate('test')
      const result = await service.preflight('test')
      expect(result.currentActive).toBe('test')
    })

    it('throws when profile does not exist', async () => {
      await expect(service.preflight('nonexistent')).rejects.toThrow('not found')
    })
  })

  describe('deactivate() - full cleanup', () => {
    beforeEach(async () => {
      // Create store with components
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\ndescription: Review\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'skills', 'deploy'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'skills', 'deploy', 'SKILL.md'), '---\nname: deploy\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'commands'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'commands', 'push.md'), '---\nname: push\n---\nprompt')
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    })

    it('restores settings.json and removes .active', async () => {
      await service.create({ name: 'test', settings: { effort: 'high' } })
      await service.activate('test')
      await service.deactivate()

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.model).toBe('sonnet')
      expect(settings.effort).toBeUndefined()
      expect(existsSync(path.join(tmpDir, 'profiles', '.active'))).toBe(false)
    })

    it('does nothing when no active profile', async () => {
      await expect(service.deactivate()).resolves.not.toThrow()
    })

    it('removes symlinks from agents/ directory', async () => {
      await service.create({ name: 'test', agents: ['reviewer'] })
      await service.activate('test')

      // Verify symlink exists
      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'agents', 'reviewer.md'))).toBe(true)

      await service.deactivate()

      // Symlink should be removed
      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'agents', 'reviewer.md'))).toBe(false)
    })

    it('removes symlinks from skills/ directory', async () => {
      await service.create({ name: 'test', skills: ['deploy'] })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'skills', 'deploy'))).toBe(true)

      await service.deactivate()

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'skills', 'deploy'))).toBe(false)
    })

    it('removes symlinks from commands/ directory', async () => {
      await service.create({ name: 'test', commands: ['push'] })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'commands', 'push.md'))).toBe(true)

      await service.deactivate()

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'commands', 'push.md'))).toBe(false)
    })

    it('removes .claude-plugin/ directory', async () => {
      await service.create({ name: 'test' })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', '.claude-plugin'))).toBe(true)

      await service.deactivate()

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', '.claude-plugin'))).toBe(false)
    })

    it('removes hooks/ directory', async () => {
      await service.create({ name: 'test', hooks: { PreToolUse: [] } })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'hooks'))).toBe(true)

      await service.deactivate()

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', 'hooks'))).toBe(false)
    })

    it('removes .mcp.json', async () => {
      await service.create({ name: 'test', mcpServers: { db: { command: 'node' } } })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', '.mcp.json'))).toBe(true)

      await service.deactivate()

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', '.mcp.json'))).toBe(false)
    })

    it('removes .lsp.json', async () => {
      await service.create({ name: 'test', lspServers: { ts: { command: 'tsc' } } })
      await service.activate('test')

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', '.lsp.json'))).toBe(true)

      await service.deactivate()

      expect(existsSync(path.join(tmpDir, 'profiles', 'test', '.lsp.json'))).toBe(false)
    })

    it('restores per-profile backup and cleans it up', async () => {
      await service.create({ name: 'test', settings: { effort: 'high' } })
      await service.activate('test')

      // After activation, per-profile backup should exist
      expect(existsSync(path.join(tmpDir, 'settings.backup.test.json'))).toBe(true)

      await service.deactivate()

      // Backup should be cleaned up
      expect(existsSync(path.join(tmpDir, 'settings.backup.test.json'))).toBe(false)
    })
  })

  describe('preflight() - model config changes', () => {
    beforeEach(() => {
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'model-configs'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    })

    it('returns modelConfigChanges with SET actions for profile with model config', async () => {
      writeModelConfig('work-anthropic', { apiKey: 'sk-test-key-1234', baseUrl: 'https://api.anthropic.com', modelName: 'claude-3-opus' })
      await service.create({ name: 'test', modelConfig: 'work-anthropic' })
      const result = await service.preflight('test')

      expect(result.modelConfigChanges).toBeDefined()
      expect(result.modelConfigChanges!.configName).toBe('work-anthropic')
      const changes = result.modelConfigChanges!.changes
      expect(changes).toHaveLength(5)

      const apiKeyChange = changes.find(c => c.key === 'ANTHROPIC_AUTH_TOKEN')
      expect(apiKeyChange).toBeDefined()
      expect(apiKeyChange!.action).toBe('SET')
      expect(apiKeyChange!.value).toBe('****1234')

      const baseUrlChange = changes.find(c => c.key === 'ANTHROPIC_BASE_URL')
      expect(baseUrlChange).toBeDefined()
      expect(baseUrlChange!.action).toBe('SET')
      expect(baseUrlChange!.value).toBe('https://api.anthropic.com')

      expect(changes.find(c => c.key === 'API_TIMEOUT_MS')).toBeDefined()
      expect(changes.find(c => c.key === 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')).toBeDefined()

      const modelChange = changes.find(c => c.key === 'ANTHROPIC_MODEL')
      expect(modelChange).toBeDefined()
      expect(modelChange!.action).toBe('SET')
      expect(modelChange!.value).toBe('claude-3-opus')
    })

    it('skips ANTHROPIC_MODEL when modelName is empty', async () => {
      writeModelConfig('no-model', { apiKey: 'sk-test-key-5678', baseUrl: 'https://api.anthropic.com', modelName: '' })
      await service.create({ name: 'test', modelConfig: 'no-model' })
      const result = await service.preflight('test')

      expect(result.modelConfigChanges).toBeDefined()
      const changes = result.modelConfigChanges!.changes
      expect(changes).toHaveLength(4)
      expect(changes.find(c => c.key === 'ANTHROPIC_MODEL')).toBeUndefined()
      expect(changes.find(c => c.key === 'ANTHROPIC_AUTH_TOKEN')).toBeDefined()
      expect(changes.find(c => c.key === 'ANTHROPIC_BASE_URL')).toBeDefined()
      expect(changes.find(c => c.key === 'API_TIMEOUT_MS')).toBeDefined()
      expect(changes.find(c => c.key === 'CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC')).toBeDefined()
    })

    it('returns CHANGE action when env key already exists', async () => {
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({
        model: 'sonnet',
        env: { ANTHROPIC_AUTH_TOKEN: 'old-key-1234' },
      }))
      writeModelConfig('work-anthropic', { apiKey: 'sk-new-key-5678', baseUrl: 'https://api.anthropic.com' })
      await service.create({ name: 'test', modelConfig: 'work-anthropic' })
      const result = await service.preflight('test')

      const apiKeyChange = result.modelConfigChanges!.changes.find(c => c.key === 'ANTHROPIC_AUTH_TOKEN')
      expect(apiKeyChange!.action).toBe('CHANGE')
      expect(apiKeyChange!.previousValue).toBe('old-key-1234')
    })

    it('masks API key in modelConfigChanges', async () => {
      writeModelConfig('masked', { apiKey: 'sk-very-long-secret-key-9876', baseUrl: 'https://api.anthropic.com' })
      await service.create({ name: 'test', modelConfig: 'masked' })
      const result = await service.preflight('test')

      const apiKeyChange = result.modelConfigChanges!.changes.find(c => c.key === 'ANTHROPIC_AUTH_TOKEN')
      expect(apiKeyChange!.value).toBe('****9876')
      // Should NOT contain the raw key
      expect(apiKeyChange!.value).not.toContain('sk-very-long-secret-key')
    })

    it('returns no modelConfigChanges when profile has no modelConfig', async () => {
      await service.create({ name: 'test' })
      const result = await service.preflight('test')
      expect(result.modelConfigChanges).toBeUndefined()
    })

    it('returns no modelConfigChanges when model config file does not exist', async () => {
      await service.create({ name: 'test', modelConfig: 'deleted-config' })
      const result = await service.preflight('test')
      expect(result.modelConfigChanges).toBeUndefined()
    })

    it('returns deactivationChanges with REMOVE actions when switching', async () => {
      writeModelConfig('config-a', { apiKey: 'sk-key-a-1111', baseUrl: 'https://a.anthropic.com', modelName: 'model-a' })
      writeModelConfig('config-b', { apiKey: 'sk-key-b-2222', baseUrl: 'https://b.anthropic.com' })

      await service.create({ name: 'profile-a', modelConfig: 'config-a' })
      await service.create({ name: 'profile-b', modelConfig: 'config-b' })

      // Activate profile-a first
      await service.activate('profile-a')

      // Preflight profile-b (switch scenario)
      const result = await service.preflight('profile-b')

      expect(result.modelConfigChanges).toBeDefined()
      expect(result.modelConfigChanges!.deactivationChanges).toBeDefined()
      expect(result.modelConfigChanges!.deactivationConfigName).toBe('config-a')

      const deactChanges = result.modelConfigChanges!.deactivationChanges!
      expect(deactChanges.length).toBeGreaterThanOrEqual(4)

      const removeApiKey = deactChanges.find(c => c.key === 'ANTHROPIC_AUTH_TOKEN')
      expect(removeApiKey).toBeDefined()
      expect(removeApiKey!.action).toBe('REMOVE')

      const removeBaseUrl = deactChanges.find(c => c.key === 'ANTHROPIC_BASE_URL')
      expect(removeBaseUrl).toBeDefined()
      expect(removeBaseUrl!.action).toBe('REMOVE')
    })
  })

  describe('activate() - model config env vars', () => {
    beforeEach(() => {
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'model-configs'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
    })

    it('writes ANTHROPIC_AUTH_TOKEN and ANTHROPIC_BASE_URL to settings.json env', async () => {
      writeModelConfig('test-mc', { apiKey: 'sk-test-key-1234', baseUrl: 'https://api.anthropic.com' })
      await service.create({ name: 'test', modelConfig: 'test-mc' })
      await service.activate('test')

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-key-1234')
      expect(settings.env.ANTHROPIC_BASE_URL).toBe('https://api.anthropic.com')
      expect(settings.env.API_TIMEOUT_MS).toBe('3000000')
      expect(settings.env.CLAUDE_CODE_DISABLE_NONESSENTIAL_TRAFFIC).toBe('1')
    })

    it('writes ANTHROPIC_MODEL when model config has modelName', async () => {
      writeModelConfig('test-mc', { apiKey: 'sk-test-key-1234', baseUrl: 'https://api.anthropic.com', modelName: 'claude-3-opus' })
      await service.create({ name: 'test', modelConfig: 'test-mc' })
      await service.activate('test')

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.env.ANTHROPIC_MODEL).toBe('claude-3-opus')
    })

    it('skips ANTHROPIC_MODEL when model config has empty modelName', async () => {
      writeModelConfig('test-mc', { apiKey: 'sk-test-key-1234', baseUrl: 'https://api.anthropic.com', modelName: '' })
      await service.create({ name: 'test', modelConfig: 'test-mc' })
      await service.activate('test')

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-key-1234')
      expect(settings.env.ANTHROPIC_MODEL).toBeUndefined()
    })

    it('proceeds without env vars when model config file is deleted', async () => {
      await service.create({ name: 'test', modelConfig: 'deleted' })
      await service.activate('test')

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.env).toBeUndefined()
    })

    it('model config env vars take precedence over profile.settings.env', async () => {
      writeModelConfig('test-mc', { apiKey: 'sk-new-key-9999', baseUrl: 'https://api.anthropic.com' })
      await service.create({
        name: 'test',
        modelConfig: 'test-mc',
        settings: { env: { ANTHROPIC_AUTH_TOKEN: 'old-key' } },
      })
      await service.activate('test')

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-new-key-9999')
    })
  })

  describe('deactivate() - model config env var restoration', () => {
    beforeEach(() => {
      mkdirSync(path.join(tmpDir, 'store', 'agents'), { recursive: true })
      writeFileSync(path.join(tmpDir, 'store', 'agents', 'reviewer.md'), '---\nname: reviewer\n---\nprompt')
      mkdirSync(path.join(tmpDir, 'store', 'model-configs'), { recursive: true })
    })

    it('restores env field to pre-activation state on deactivation', async () => {
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({
        model: 'sonnet',
        env: { CUSTOM_VAR: 'hello' },
      }))
      writeModelConfig('test-mc', { apiKey: 'sk-test-key-1234', baseUrl: 'https://api.anthropic.com' })

      await service.create({ name: 'test', modelConfig: 'test-mc' })
      await service.activate('test')

      // After activation, env should have ANTHROPIC_* vars merged in
      const afterActivate = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(afterActivate.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-test-key-1234')
      expect(afterActivate.env.CUSTOM_VAR).toBe('hello')
      expect(afterActivate.env.API_TIMEOUT_MS).toBe('3000000')

      await service.deactivate()

      const settings = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(settings.env.CUSTOM_VAR).toBe('hello')
      expect(settings.env.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
    })

    it('switching from profile with model config to profile without restores env vars', async () => {
      writeFileSync(path.join(tmpDir, 'settings.json'), JSON.stringify({ model: 'sonnet' }))
      writeModelConfig('config-a', { apiKey: 'sk-key-a-1111', baseUrl: 'https://a.anthropic.com' })

      await service.create({ name: 'profile-a', modelConfig: 'config-a' })
      await service.create({ name: 'profile-b' })

      await service.activate('profile-a')
      const afterA = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(afterA.env.ANTHROPIC_AUTH_TOKEN).toBe('sk-key-a-1111')

      await service.activate('profile-b')
      const afterB = JSON.parse(readFileSync(path.join(tmpDir, 'settings.json'), 'utf8'))
      expect(afterB.env?.ANTHROPIC_AUTH_TOKEN).toBeUndefined()
      expect(afterB.env?.ANTHROPIC_BASE_URL).toBeUndefined()
      expect(afterB.env?.API_TIMEOUT_MS).toBeUndefined()
    })
  })
})
