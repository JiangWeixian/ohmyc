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

import { skillsRoutes } from '@/server/routes/skills'
import { ProviderRegistry } from '@/server/services/provider-registry'
import { ClaudeProvider } from '@/server/services/providers/claude-provider'
import { OpencodeProvider } from '@/server/services/providers/opencode-provider'

function buildRegistry(skillsDir: string, projectDir?: string | null) {
  const claude = new ClaudeProvider({
    agentsGlobalDir: path.join(skillsDir, '..', 'agents'),
    skillsGlobalDir: skillsDir,
    commandsGlobalDir: path.join(skillsDir, '..', 'commands'),
    projectDir: projectDir ?? null,
  })
  return new ProviderRegistry([claude])
}

describe('skills routes', () => {
  let temporaryRoot: string
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  function createSkillDir(name: string, content: string) {
    const dir = path.join(tmpDir, name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'SKILL.md'), content)
  }

  beforeEach(async () => {
    temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'skills-route-test-'))
    tmpDir = path.join(temporaryRoot, 'skills')
    mkdirSync(tmpDir, { recursive: true })
    app = Fastify()
    await app.register(skillsRoutes, {
      skillsDir: tmpDir,
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

  describe('GET /api/skills', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ skills: [] })
    })

    it('returns skills list', async () => {
      createSkillDir('test', '---\nname: test\ndescription: Test\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      expect(res.statusCode).toBe(200)
      expect(res.json().skills).toHaveLength(1)
    })

    it('tags regular dir as source: local', async () => {
      createSkillDir('local', '---\nname: local\ndescription: Local\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const local = res.json().skills.find((skill: any) => skill.id === 'local')
      expect(local.source).toBe('local')
    })

    it('treats non-profile symlink dirs as local', async () => {
      const realDir = path.join(tmpDir, '_real-skill')
      mkdirSync(realDir, { recursive: true })
      writeFileSync(path.join(realDir, 'SKILL.md'), '---\nname: linked\ndescription: Linked\n---\nprompt')
      symlinkSync(realDir, path.join(tmpDir, 'linked'))
      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const linked = res.json().skills.find((s: any) => s.id === 'linked')
      expect(linked.source).toBe('local')
    })

    it('marks only symlink dirs inside the active profile directory as profile', async () => {
      const activeProfileDir = path.join(temporaryRoot, 'profiles', 'daily')
      mkdirSync(path.join(activeProfileDir, 'skills'), { recursive: true })
      writeFileSync(path.join(temporaryRoot, 'profiles', '.active'), activeProfileDir)

      const storeDir = path.join(temporaryRoot, 'review-skill')
      mkdirSync(storeDir, { recursive: true })
      writeFileSync(path.join(storeDir, 'SKILL.md'), '---\nname: linked\ndescription: Linked\n---\nprompt')

      const activeLinkPath = path.join(activeProfileDir, 'skills', 'linked')
      symlinkSync(storeDir, activeLinkPath)
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked'))

      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const linked = res.json().skills.find((s: any) => s.id === 'linked')

      expect(linked.source).toBe('profile')
    })

    it('keeps local and profile skills distinct in the same listing', async () => {
      createSkillDir('local', '---\nname: local\ndescription: Local\n---\nprompt')
      const activeProfileDir = path.join(temporaryRoot, 'profiles', 'daily')
      mkdirSync(path.join(activeProfileDir, 'skills'), { recursive: true })
      writeFileSync(path.join(temporaryRoot, 'profiles', '.active'), activeProfileDir)
      const storeDir = path.join(temporaryRoot, 'review-skill')
      mkdirSync(storeDir, { recursive: true })
      writeFileSync(path.join(storeDir, 'SKILL.md'), '---\nname: linked\ndescription: Linked\n---\nprompt')
      const activeLinkPath = path.join(activeProfileDir, 'skills', 'linked')
      symlinkSync(storeDir, activeLinkPath)
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked'))

      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const { skills } = res.json()

      expect(skills.find((skill: any) => skill.id === 'local')?.source).toBe('local')
      expect(skills.find((skill: any) => skill.id === 'linked')?.source).toBe('profile')
    })

    it('tags entries with origins[]', async () => {
      createSkillDir('foo', '---\nname: foo\ndescription: a skill\n---\nbody')
      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      const foo = body.skills.find((s: any) => s.id === 'foo')
      expect(foo?.origins).toEqual(['claude'])
    })

    it('?origins=opencode hides claude skills', async () => {
      createSkillDir('foo', '---\nname: foo\ndescription: a skill\n---\nbody')
      const res = await app.inject({ method: 'GET', url: '/api/skills?origins=opencode' })
      expect(res.json().skills.find((s: any) => s.id === 'foo')).toBeUndefined()
    })
  })

  describe('project-local loading', () => {
    let projectDir: string

    beforeEach(async () => {
      await app.close()
      projectDir = path.join(temporaryRoot, '.claude')
      mkdirSync(path.join(projectDir, 'skills'), { recursive: true })
      app = Fastify()
      await app.register(skillsRoutes, {
        skillsDir: tmpDir,
        projectSkillsDir: path.join(projectDir, 'skills'),
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: buildRegistry(tmpDir, projectDir),
      })
      await app.ready()
    })

    it('returns both global and project skills with correct scope', async () => {
      createSkillDir('global', '---\nname: global\ndescription: Global\n---\nprompt')
      mkdirSync(path.join(projectDir, 'skills', 'proj'), { recursive: true })
      writeFileSync(path.join(projectDir, 'skills', 'proj', 'SKILL.md'), '---\nname: proj\ndescription: Proj\n---\nprompt')

      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const { skills } = res.json()

      const global = skills.find((s: any) => s.id === 'global')
      const proj = skills.find((s: any) => s.id === 'proj')
      expect(global.source).toBe('local')
      expect(global.scope).toBe('global')
      expect(proj.source).toBe('project')
      expect(proj.scope).toBe('project')
    })

    it('sorts project skill first when names collide', async () => {
      createSkillDir('shared', '---\nname: shared\ndescription: Global version\n---\nglobal')
      mkdirSync(path.join(projectDir, 'skills', 'shared'), { recursive: true })
      writeFileSync(path.join(projectDir, 'skills', 'shared', 'SKILL.md'), '---\nname: shared\ndescription: Project version\n---\nproject')

      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const { skills } = res.json()

      expect(skills).toHaveLength(2)
      expect(skills[0].scope).toBe('project')
      expect(skills[1].scope).toBe('global')
    })

    it('returns only global skills when projectSkillsDir is null', async () => {
      await app.close()
      createSkillDir('only', '---\nname: only\ndescription: Only\n---\nprompt')
      app = Fastify()
      await app.register(skillsRoutes, {
        skillsDir: tmpDir,
        projectSkillsDir: null,
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: buildRegistry(tmpDir),
      })
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api/skills' })
      const { skills } = res.json()
      expect(skills).toHaveLength(1)
      expect(skills[0].scope).toBe('global')
    })
  })

  describe('GET /api/skills/:name', () => {
    it('returns 404 for nonexistent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/skills/nope' })
      expect(res.statusCode).toBe(404)
    })

    it('returns skill', async () => {
      createSkillDir('test', '---\nname: test\ndescription: Test\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/skills/test' })
      expect(res.statusCode).toBe(200)
      expect(res.json().skill.id).toBe('test')
    })

    it('resolves opencode skill via registry when source=opencode', async () => {
      await app.close()
      const opencodeHome = path.join(temporaryRoot, 'oc-home')
      const opencodeSkillsDir = path.join(opencodeHome, '.config', 'opencode', 'skills', 'fixture-skill')
      mkdirSync(opencodeSkillsDir, { recursive: true })
      writeFileSync(
        path.join(opencodeSkillsDir, 'SKILL.md'),
        '---\nname: fixture-skill\ndescription: An opencode skill\n---\nprompt',
      )

      const claude = new ClaudeProvider({
        agentsGlobalDir: path.join(tmpDir, '..', 'agents'),
        skillsGlobalDir: tmpDir,
        commandsGlobalDir: path.join(tmpDir, '..', 'commands'),
        projectDir: null,
      })
      const opencode = new OpencodeProvider({
        home: opencodeHome,
        platform: 'linux',
        cwd: opencodeHome,
      })

      app = Fastify()
      await app.register(skillsRoutes, {
        skillsDir: tmpDir,
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: new ProviderRegistry([claude, opencode]),
      })
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api/skills/fixture-skill?source=opencode' })
      expect(res.statusCode).toBe(200)
      const body = res.json()
      expect(body.skill.id).toBe('fixture-skill')
      expect(body.skill.source).toBe('opencode')
      expect(body.skill.origins).toEqual(['opencode'])
    })
  })
})
