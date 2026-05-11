import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
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

import { ProviderRegistry } from '@/server/services/provider-registry'
import { AgentsSharedProvider } from '@/server/services/providers/agents-shared-provider'
import { ClaudeProvider } from '@/server/services/providers/claude-provider'

function writeSkill(dir: string, name: string) {
  mkdirSync(path.join(dir, name), { recursive: true })
  writeFileSync(
    path.join(dir, name, 'SKILL.md'),
    `---\nname: ${name}\ndescription: test ${name}\n---\nbody`,
  )
}

function writeAgent(dir: string, name: string) {
  mkdirSync(dir, { recursive: true })
  writeFileSync(
    path.join(dir, `${name}.md`),
    `---\nname: ${name}\ndescription: agent ${name}\n---\nbody`,
  )
}

describe('ProviderRegistry', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'registry-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('listAgents merges entries from all providers and tags origin', async () => {
    const claudeDir = path.join(tmp, 'claude-agents')
    writeAgent(claudeDir, 'alpha')
    const claude = new ClaudeProvider({ agentsGlobalDir: claudeDir, projectDir: null })
    const registry = new ProviderRegistry([claude])

    const agents = await registry.listAgents()
    expect(agents).toHaveLength(1)
    expect(agents[0].origins).toEqual(['claude'])
    expect((agents[0].data as any).id).toBe('alpha')
  })

  it('filter.origins narrows results by origin', async () => {
    const claudeDir = path.join(tmp, 'claude-agents')
    writeAgent(claudeDir, 'alpha')
    const claude = new ClaudeProvider({ agentsGlobalDir: claudeDir, projectDir: null })
    const registry = new ProviderRegistry([claude])

    expect(await registry.listAgents({ origins: ['opencode'] })).toEqual([])
    expect(await registry.listAgents({ origins: ['claude'] })).toHaveLength(1)
  })

  it('listSkills dedupes by canonical path and merges origins[]', async () => {
    const realRoot = path.join(tmp, 'real')
    writeSkill(realRoot, 'shared')
    const realSkill = path.join(realRoot, 'shared', 'SKILL.md')

    const claudeSkills = path.join(tmp, 'claude', 'skills')
    mkdirSync(claudeSkills, { recursive: true })
    symlinkSync(path.join(realRoot, 'shared'), path.join(claudeSkills, 'shared'))

    const agentsHome = path.join(tmp, 'home-agents')
    mkdirSync(path.join(agentsHome, '.agents', 'skills'), { recursive: true })
    symlinkSync(path.join(realRoot, 'shared'), path.join(agentsHome, '.agents', 'skills', 'shared'))

    const claude = new ClaudeProvider({
      agentsGlobalDir: path.join(tmp, 'unused-agents'),
      skillsGlobalDir: claudeSkills,
      projectDir: null,
    })
    const agents = new AgentsSharedProvider({ home: agentsHome, cwd: tmp })

    const registry = new ProviderRegistry([claude, agents])
    const skills = await registry.listSkills()

    expect(skills).toHaveLength(1)
    expect(skills[0].sourceFile).toBe(path.join(claudeSkills, 'shared', 'SKILL.md'))
    expect(skills[0].origins.toSorted()).toEqual(['agents', 'claude'])
  })

  it('listSkills filter matches any origin in origins[]', async () => {
    const claudeSkills = path.join(tmp, 'claude-skills')
    writeSkill(claudeSkills, 'foo')
    const claude = new ClaudeProvider({
      agentsGlobalDir: path.join(tmp, 'unused'),
      skillsGlobalDir: claudeSkills,
      projectDir: null,
    })
    const registry = new ProviderRegistry([claude])
    expect(await registry.listSkills({ origins: ['opencode'] })).toEqual([])
    expect(await registry.listSkills({ origins: ['claude'] })).toHaveLength(1)
  })
})
