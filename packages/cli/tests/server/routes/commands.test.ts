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

import { commandsRoutes } from '@/server/routes/commands'
import { ProviderRegistry } from '@/server/services/provider-registry'
import { ClaudeProvider } from '@/server/services/providers/claude-provider'

function buildRegistry(commandsDir: string, projectDir?: string | null) {
  const claude = new ClaudeProvider({
    agentsGlobalDir: path.join(commandsDir, '..', 'agents'),
    commandsGlobalDir: commandsDir,
    projectDir,
  })
  return new ProviderRegistry([claude])
}

describe('commands routes', () => {
  let temporaryRoot: string
  let tmpDir: string
  let app: ReturnType<typeof Fastify>

  beforeEach(async () => {
    temporaryRoot = mkdtempSync(path.join(os.tmpdir(), 'commands-route-test-'))
    tmpDir = path.join(temporaryRoot, 'commands')
    mkdirSync(tmpDir, { recursive: true })
    app = Fastify()
    await app.register(commandsRoutes, {
      commandsDir: tmpDir,
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

  describe('GET /api/commands', () => {
    it('returns empty list', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      expect(res.statusCode).toBe(200)
      expect(res.json()).toEqual({ commands: [] })
    })

    it('returns commands list', async () => {
      writeFileSync(path.join(tmpDir, 'deploy.md'), '---\nname: deploy\ndescription: Deploy\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      expect(res.statusCode).toBe(200)
      expect(res.json().commands).toHaveLength(1)
    })

    it('tags regular file as source: local', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const local = res.json().commands.find((command: any) => command.id === 'local')
      expect(local.source).toBe('local')
    })

    it('treats non-profile symlinks as local', async () => {
      const realFile = path.join(tmpDir, '_real.md')
      writeFileSync(realFile, '---\nname: linked\ndescription: Linked\n---\nprompt')
      symlinkSync(realFile, path.join(tmpDir, 'linked.md'))
      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const linked = res.json().commands.find((c: any) => c.id === 'linked')
      expect(linked.source).toBe('local')
    })

    it('marks only symlinks inside the active profile directory as profile', async () => {
      const activeProfileDir = path.join(temporaryRoot, 'profiles', 'daily')
      mkdirSync(path.join(activeProfileDir, 'commands'), { recursive: true })
      writeFileSync(path.join(temporaryRoot, 'profiles', '.active'), activeProfileDir)

      const storeFile = path.join(temporaryRoot, 'linked-source.md')
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt')
      const activeLinkPath = path.join(activeProfileDir, 'commands', 'linked.md')
      symlinkSync(storeFile, activeLinkPath)
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'))

      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const linked = res.json().commands.find((c: any) => c.id === 'linked')

      expect(linked.source).toBe('profile')
    })

    it('keeps local and profile commands distinct in the same listing', async () => {
      writeFileSync(path.join(tmpDir, 'local.md'), '---\nname: local\ndescription: Local\n---\nprompt')
      const activeProfileDir = path.join(temporaryRoot, 'profiles', 'daily')
      mkdirSync(path.join(activeProfileDir, 'commands'), { recursive: true })
      writeFileSync(path.join(temporaryRoot, 'profiles', '.active'), activeProfileDir)
      const storeFile = path.join(temporaryRoot, 'linked-source.md')
      writeFileSync(storeFile, '---\nname: linked\ndescription: Linked\n---\nprompt')
      const activeLinkPath = path.join(activeProfileDir, 'commands', 'linked.md')
      symlinkSync(storeFile, activeLinkPath)
      symlinkSync(activeLinkPath, path.join(tmpDir, 'linked.md'))

      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const { commands } = res.json()

      expect(commands.find((command: any) => command.id === 'local')?.source).toBe('local')
      expect(commands.find((command: any) => command.id === 'linked')?.source).toBe('profile')
    })

    it('tags entries with origins: ["claude"]', async () => {
      writeFileSync(path.join(tmpDir, 'hi.md'),
        '---\nname: hi\ndescription: hello\n---\nbody')
      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      expect(res.statusCode).toBe(200)
      expect(res.json().commands.find((c: any) => c.id === 'hi')?.origins).toEqual(['claude'])
    })

    it('?origins=opencode hides claude commands', async () => {
      writeFileSync(path.join(tmpDir, 'hi.md'),
        '---\nname: hi\ndescription: hello\n---\nbody')
      const res = await app.inject({ method: 'GET', url: '/api/commands?origins=opencode' })
      expect(res.json().commands.find((c: any) => c.id === 'hi')).toBeUndefined()
    })
  })

  describe('project-local loading', () => {
    let projectDir: string

    beforeEach(async () => {
      await app.close()
      projectDir = path.join(temporaryRoot, '.claude')
      mkdirSync(path.join(projectDir, 'commands'), { recursive: true })
      app = Fastify()
      await app.register(commandsRoutes, {
        commandsDir: tmpDir,
        projectCommandsDir: path.join(projectDir, 'commands'),
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: buildRegistry(tmpDir, projectDir),
      })
      await app.ready()
    })

    it('returns both global and project commands with correct scope', async () => {
      writeFileSync(path.join(tmpDir, 'global.md'), '---\nname: global\ndescription: Global\n---\nprompt')
      writeFileSync(path.join(projectDir, 'commands', 'proj.md'), '---\nname: proj\ndescription: Proj\n---\nprompt')

      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const { commands } = res.json()

      const global = commands.find((c: any) => c.id === 'global')
      const proj = commands.find((c: any) => c.id === 'proj')
      expect(global.source).toBe('local')
      expect(global.scope).toBe('global')
      expect(proj.source).toBe('project')
      expect(proj.scope).toBe('project')
    })

    it('sorts project command first when names coincide', async () => {
      writeFileSync(path.join(tmpDir, 'shared.md'), '---\nname: shared\ndescription: Global version\n---\nglobal')
      writeFileSync(path.join(projectDir, 'commands', 'shared.md'), '---\nname: shared\ndescription: Project version\n---\nproject')

      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const { commands } = res.json()

      expect(commands).toHaveLength(2)
      expect(commands[0].scope).toBe('project')
      expect(commands[1].scope).toBe('global')
    })

    it('returns only global commands when projectCommandsDir is null', async () => {
      await app.close()
      writeFileSync(path.join(tmpDir, 'only.md'), '---\nname: only\ndescription: Only\n---\nprompt')
      app = Fastify()
      await app.register(commandsRoutes, {
        commandsDir: tmpDir,
        projectCommandsDir: null,
        pluginsDir: path.join(temporaryRoot, '_plugins'),
        claudeSettingsPaths: [path.join(temporaryRoot, '_settings.json')],
        baseDir: temporaryRoot,
        registry: buildRegistry(tmpDir),
      })
      await app.ready()

      const res = await app.inject({ method: 'GET', url: '/api/commands' })
      const { commands } = res.json()
      expect(commands).toHaveLength(1)
      expect(commands[0].scope).toBe('global')
    })
  })

  describe('GET /api/commands/:name', () => {
    it('returns 404 for nonexistent', async () => {
      const res = await app.inject({ method: 'GET', url: '/api/commands/nope' })
      expect(res.statusCode).toBe(404)
    })

    it('returns command', async () => {
      writeFileSync(path.join(tmpDir, 'deploy.md'), '---\nname: deploy\ndescription: Deploy\n---\nprompt')
      const res = await app.inject({ method: 'GET', url: '/api/commands/deploy' })
      expect(res.statusCode).toBe(200)
      expect(res.json().command.id).toBe('deploy')
    })
  })
})
