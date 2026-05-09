import {
  mkdirSync,
  mkdtempSync,
  rmSync,
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

import { AGENT_DIR_NAME, ConfigLocator } from '@/server/services/config-locator'

describe('ConfigLocator', () => {
  let tmpDir: string
  let savedAgentHome: string | undefined
  let savedOhmycHome: string | undefined

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'config-locator-test-'))
    savedAgentHome = process.env.AGENT_HOME
    savedOhmycHome = process.env.OHMYC_HOME
    delete process.env.AGENT_HOME
    delete process.env.OHMYC_HOME
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
    if (savedAgentHome === undefined) {
      delete process.env.AGENT_HOME
    } else {
      process.env.AGENT_HOME = savedAgentHome
    }
    if (savedOhmycHome === undefined) {
      delete process.env.OHMYC_HOME
    } else {
      process.env.OHMYC_HOME = savedOhmycHome
    }
  })

  describe('constants', () => {
    it('AGENT_DIR_NAME equals .claude', () => {
      expect(AGENT_DIR_NAME).toBe('.claude')
    })
  })

  describe('project discovery', () => {
    it('discovers .claude/ when present in cwd', () => {
      mkdirSync(path.join(tmpDir, '.claude'))
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.hasProject).toBe(true)
      expect(locator.projectPath).toBe(path.join(tmpDir, '.claude'))
    })

    it('returns null projectPath when .claude/ is absent', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.hasProject).toBe(false)
      expect(locator.projectPath).toBeNull()
    })

    it('project discovery uses AGENT_HOME override dir when set', () => {
      process.env.AGENT_HOME = '.custom-claude'
      mkdirSync(path.join(tmpDir, '.custom-claude'))
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.hasProject).toBe(true)
      expect(locator.projectPath).toBe(path.join(tmpDir, '.custom-claude'))
    })
  })

  describe('write path defaults to ~/.config/ohmyc/', () => {
    const expectedBase = path.join(os.homedir(), '.config', 'ohmyc')

    it('baseDir resolves to ~/.config/ohmyc/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(expectedBase)
    })

    it('agentsDir resolves to ~/.config/ohmyc/agents/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.agentsDir).toBe(path.join(expectedBase, 'agents'))
    })

    it('skillsDir resolves to ~/.config/ohmyc/skills/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.skillsDir).toBe(path.join(expectedBase, 'skills'))
    })

    it('commandsDir resolves to ~/.config/ohmyc/commands/', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.commandsDir).toBe(path.join(expectedBase, 'commands'))
    })

    it('settingsPath resolves to ~/.config/ohmyc/settings.json', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.settingsPath).toBe(path.join(expectedBase, 'settings.json'))
    })

    it('pluginsDir resolves to ~/.claude/plugins/ (unchanged) per D-03', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'))
    })

    it('readBaseDir equals writeBaseDir per D-04', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.readBaseDir).toBe(locator.baseDir)
    })
  })

  describe('OHMYC_HOME env var override', () => {
    it('OHMYC_HOME (absolute) overrides writeBaseDir', () => {
      const custom = path.join(tmpDir, 'custom-home')
      process.env.OHMYC_HOME = custom
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(custom)
      expect(locator.agentsDir).toBe(path.join(custom, 'agents'))
      expect(locator.settingsPath).toBe(path.join(custom, 'settings.json'))
    })

    it('OHMYC_HOME does not affect claudeCodeDir (plugins still from ~/.claude/)', () => {
      process.env.OHMYC_HOME = path.join(tmpDir, 'custom-home')
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.claude', 'plugins'))
    })

    it('OHMYC_HOME and AGENT_HOME can be set independently', () => {
      process.env.OHMYC_HOME = path.join(tmpDir, 'custom-home')
      process.env.AGENT_HOME = '.custom-claude'
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(path.join(tmpDir, 'custom-home'))
      expect(locator.pluginsDir).toBe(path.join(os.homedir(), '.custom-claude', 'plugins'))
    })

    it('CUI_HOME is no longer read', () => {
      process.env.CUI_HOME = path.join(tmpDir, 'should-be-ignored')
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.baseDir).toBe(path.join(os.homedir(), '.config', 'ohmyc'))
      delete process.env.CUI_HOME
    })
  })

  describe('project subdirectories', () => {
    it('returns null for project subdirectories when no project', () => {
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.projectAgentsDir).toBeNull()
      expect(locator.projectSkillsDir).toBeNull()
      expect(locator.projectCommandsDir).toBeNull()
    })

    it('returns project subdirectories when project exists', () => {
      mkdirSync(path.join(tmpDir, '.claude'))
      const locator = new ConfigLocator({ cwd: tmpDir })
      expect(locator.projectAgentsDir).toBe(path.join(tmpDir, '.claude', 'agents'))
      expect(locator.projectSkillsDir).toBe(path.join(tmpDir, '.claude', 'skills'))
      expect(locator.projectCommandsDir).toBe(path.join(tmpDir, '.claude', 'commands'))
    })
  })
})
