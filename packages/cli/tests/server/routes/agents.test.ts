import {
  mkdirSync,
  mkdtempSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import Fastify from 'fastify'
import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { agentsRoutes } from '@/server/routes/agents'
import { ProviderRegistry } from '@/server/services/provider-registry'
import { ClaudeProvider } from '@/server/services/providers/claude-provider'
import { OpencodeProvider } from '@/server/services/providers/opencode-provider'

function buildRegistry(agentsDir: string, projectDir?: string | null) {
  const claude = new ClaudeProvider({
    agentsGlobalDir: agentsDir,
    skillsGlobalDir: path.join(agentsDir, '..', 'skills'),
    commandsGlobalDir: path.join(agentsDir, '..', 'commands'),
    projectDir: projectDir ?? null,
  })
  return new ProviderRegistry([claude])
}

describe('agents routes', () => {
  let temporaryRoot: string
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'agents-route-test-'))
    tmpDir = path.join(temporaryRoot, 'agents')
    mkdirSync(tmpDir, { recursive: true })
    app = Fastify()
    await app.register(agentsRoutes, {
      agentsDir: tmpDir,
      pluginsDir: path.join(temporaryRoot, '_plugins'),
      claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
      baseDir: temporaryRoot,
      registry: buildRegistry(tmpDir),
    })
    await app.ready()
  })

  afterEach(async () => {
    await app.close()
    rmSync(temporaryRoot, { recursive: true, force: true })
  })

  describe('GET /api/agents', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ agents: [] })
    })

    it('returns agents list', async () => {
      writeFileSync(path.join(tmpDir, 'test.md'), '---\nname: test\ndescription: Test\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      expect(res.statusCode).toBe(200)
      expect(res.json().agents).toHaveLength(1)
    })

    it('tags regular file as source: local', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const local = res.json().agents.find((agent: any) => agent.id === 'local')
      expect(local.source).toBe('local')
    })

    it('treats non-profile symlinks as local', async () => {
      const realFile = path.join(tmpDir, '_real.md')
      writeFileSync(realFile, '---\nname: linked\ndescription: Linked\n---\nprompt')
      symlinkSync(realFile, path.join(tmpDir, 'linked.md'))
      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const linked = res.json().agents.find((a: any) => a.id === 'linked')
      expect(linked.source).toBe('local')
    })

    it('marks only symlinks inside the active profile directory as profile', async () => {
      const activeProfileDir = path.join(temporaryRoot, 'profiles', 'daily')
      mkdirSync(path.join(activeProfileDir, 'agents'), { recursive: true })
      writeFileSync(path.join(temporaryRoot, 'profiles', '.active'), activeProfileDir)

      const storeFile = path.join(temporaryRoot, 'store-agent.md')
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt')
      symlinkSync(storeFile, path.join(tmpDir, 'linked.md'))

      const activeLinkPath = path.join(activeProfileDir, 'agents', 'linked.md')
      symlinkSync(storeFile, activeLinkPath)
      rmSync(path.join(tmpDir, 'linked.md'))
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'))

      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const linked = res.json().agents.find((a: any) => a.id === 'linked')

      expect(linked.source).toBe('profile')
    })

    it('keeps local and profile items distinct in the same listing', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt')

      const activeProfileDir = path.join(temporaryRoot, 'profiles', 'daily')
      mkdirSync(path.join(activeProfileDir, 'agents'), { recursive: true })
      writeFileSync(path.join(temporaryRoot, 'profiles', '.active'), activeProfileDir)
      const storeFile = path.join(temporaryRoot, 'linked-source.md')
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt')
      const activeLinkPath = path.join(activeProfileDir, 'agents', 'linked.md')
      symlinkSync(storeFile, activeLinkPath)
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'))

      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const { agents } = res.json()

      expect(agents.find((agent: any) => agent.id === 'local')?.source).toBe('local')
      expect(agents.find((agent: any) => agent.id === 'linked')?.source).toBe('profile')
    })

    it('tags each agent with origins: ["claude"]', async () => {
      writeFileSync(path.join(tmpDir, 'alpha.md'),
        '---\nname: alpha\ndescription: A\n---\nbody')

      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      const alpha = body.agents.find((a: any) => a.id === 'alpha')
      expect(alpha?.origins).toEqual(['claude'])
    })

    it('attaches provider badges to each agent in the response', async () => {
      // Stand up a separate fastify with claude + opencode providers wired in.
      await app.close()
      const opencodeHome = path.join(temporaryRoot, 'oc-home')
      const opencodeAgentsDir = path.join(opencodeHome, '.config', 'opencode', 'agents')
      mkdirSync(opencodeAgentsDir, { recursive: true })
      writeFileSync(
        path.join(opencodeAgentsDir, 'fixture-opencode.md'),
        '---\nname: fixture-opencode\ndescription: An opencode agent\nmode: primary\n---\nprompt',
      )

      const claude = new ClaudeProvider({
        agentsGlobalDir: tmpDir,
        skillsGlobalDir: path.join(tmpDir, '..', 'skills'),
        commandsGlobalDir: path.join(tmpDir, '..', 'commands'),
        projectDir: null,
      })
      const opencode = new OpencodeProvider({
        home: opencodeHome,
        platform: 'linux',
        cwd: opencodeHome,
      })

      app = Fastify()
      await app.register(agentsRoutes, {
        agentsDir: tmpDir,
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: new ProviderRegistry([claude, opencode]),
      })
      await app.ready()

      const response = await app.inject({ method: 'GET', url: '/api/agents' })
      const body = response.json() as { agents: Array<{ id: string; badges: Array<{ kind: string; label: string }> }> }
      const agent = body.agents.find(a => a.id === 'fixture-opencode')!
      expect(agent).toBeDefined()
      expect(agent.badges).toEqual(expect.arrayContaining([
        expect.objectContaining({ kind: 'mono', label: 'primary' }),
      ]))
    })

    it('?origins=opencode returns no claude agents', async () => {
      writeFileSync(path.join(tmpDir, 'alpha.md'),
        '---\nname: alpha\ndescription: A\n---\nbody')
      const res = await app.inject({ method: 'GET', url: '/api/agents?origins=opencode' })
      expect(res.statusCode).toBe(200)
      expect(res.json().agents.find((a: any) => a.id === 'alpha')).toBeUndefined()
    })
  })

  describe('project-local loading', () => {
    let projectDir: string

    beforeEach(async () => {
      await app.close()
      projectDir = path.join(temporaryRoot, '.claude')
      mkdirSync(path.join(projectDir, 'agents'), { recursive: true })
      app = Fastify()
      await app.register(agentsRoutes, {
        agentsDir: tmpDir,
        projectAgentsDir: path.join(projectDir, 'agents'),
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: buildRegistry(tmpDir, projectDir),
      })
      await app.ready()
    })

    it('returns both global and project agents with correct scope', async () => {
      writeFileSync(path.join(tmpDir, 'global.md'), '---\nname: global\ndescription: Global\n---\nprompt')
      writeFileSync(path.join(projectDir, 'agents', 'proj.md'), '---\nname: proj\ndescription: Proj\n---\nprompt')

      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const { agents } = res.json()

      const global = agents.find((a: any) => a.id === 'global')
      const proj = agents.find((a: any) => a.id === 'proj')
      expect(global.source).toBe('local')
      expect(global.scope).toBe('global')
      expect(proj.source).toBe('project')
      expect(proj.scope).toBe('project')
    })

    it('sorts project agent first when names collide', async () => {
      writeFileSync(path.join(tmpDir, 'shared.md'), '---\nname: shared\ndescription: Global version\n---\nglobal')
      writeFileSync(path.join(projectDir, 'agents', 'shared.md'), '---\nname: shared\ndescription: Project version\n---\nproject')

      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const { agents } = res.json()

      expect(agents).toHaveLength(2)
      expect(agents[0].scope).toBe('project')
      expect(agents[1].scope).toBe('global')
    })

    it('returns only global agents when projectAgentsDir is null', async () => {
      await app.close()
      writeFileSync(path.join(tmpDir, 'only.md'), '---\nname: only\ndescription: Only\n---\nprompt')
      app = Fastify()
      await app.register(agentsRoutes, {
        agentsDir: tmpDir,
        projectAgentsDir: null,
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: buildRegistry(tmpDir),
      })
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api/agents' })
      const { agents } = res.json()
      expect(agents).toHaveLength(1)
      expect(agents[0].scope).toBe('global')
    })

    it('finds project agent by name with source=project', async () => {
      writeFileSync(path.join(projectDir, 'agents', 'proj.md'), '---\nname: proj\ndescription: Proj\n---\nprompt')

      const res = await app.inject({ method: 'GET', url: '/api/agents/proj?source=project' })
      expect(res.statusCode).toBe(200)
      expect(res.json().agent.source).toBe('project')
      expect(res.json().agent.scope).toBe('project')
    })
  })

  describe('GET /api/agents/:name', () => {
    it('returns 404 for nonexistent agent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/agents/nope' })
      expect(res.statusCode).toBe(404)
    })

    it('returns agent', async () => {
      writeFileSync(path.join(tmpDir, 'test.md'), '---\nname: test\ndescription: Test\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/agents/test' })
      expect(res.statusCode).toBe(200)
      expect(res.json().agent.id).toBe('test')
    })
  })
})
