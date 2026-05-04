import {
  existsSync,
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

import { CommandService } from '@/server/services/command-service'

describe('CommandService', () => {
  let tmpDir: string
  let service: CommandService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'commands-test-'))
    service = new CommandService(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('list()', () => {
    it('returns empty array for empty directory', async () => {
      expect(await service.list()).toEqual([])
    })

    it('returns empty array when directory does not exist', async () => {
      const noDir = new CommandService('/tmp/nonexistent-commands-xyz')
      expect(await noDir.list()).toEqual([])
    })

    it('returns parsed commands sorted alphabetically', async () => {
      writeFileSync(path.join(tmpDir, 'deploy.md'), '---\nname: deploy\ndescription: Deploy app\n---\nDeploy steps.')
      writeFileSync(path.join(tmpDir, 'audit.md'), '---\nname: audit\ndescription: Run audit\n---\nAudit steps.')

      const commands = await service.list()
      expect(commands).toHaveLength(2)
      expect(commands[0].id).toBe('audit')
      expect(commands[1].id).toBe('deploy')
    })

    it('ignores non-.md files', async () => {
      writeFileSync(path.join(tmpDir, 'notes.txt'), 'not a command')
      writeFileSync(path.join(tmpDir, 'cmd.md'), '---\nname: cmd\ndescription: A cmd\n---\nprompt')

      const commands = await service.list()
      expect(commands).toHaveLength(1)
    })

    it('uses filename as name when frontmatter name is missing', async () => {
      writeFileSync(path.join(tmpDir, 'my-cmd.md'), '---\ndescription: No name\n---\nprompt')

      const commands = await service.list()
      expect(commands).toHaveLength(1)
      expect(commands[0].frontmatter.name).toBe('my-cmd')
    })
  })

  describe('get()', () => {
    it('returns command by name', async () => {
      writeFileSync(path.join(tmpDir, 'deploy.md'), '---\nname: deploy\ndescription: Deploy\n---\nDeploy it.')

      const cmd = await service.get('deploy')
      expect(cmd).not.toBeNull()
      expect(cmd!.id).toBe('deploy')
      expect(cmd!.content).toBe('Deploy it.')
    })

    it('returns null when not found', async () => {
      expect(await service.get('nope')).toBeNull()
    })

    it('returns null for invalid name', async () => {
      expect(await service.get('../evil')).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates command file', async () => {
      const cmd = await service.create({ name: 'new-cmd', description: 'New' }, 'Do stuff.')

      expect(cmd.id).toBe('new-cmd')
      expect(cmd.filename).toBe('new-cmd.md')
      expect(existsSync(path.join(tmpDir, 'new-cmd.md'))).toBe(true)
    })

    it('round-trips correctly', async () => {
      const created = await service.create({ name: 'rt', description: 'Test' }, 'prompt')
      const fetched = await service.get('rt')
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.content).toBe(created.content)
    })

    it('throws when already exists', async () => {
      writeFileSync(path.join(tmpDir, 'existing.md'), '---\nname: existing\n---\nprompt')
      await expect(service.create({ name: 'existing' }, 'x')).rejects.toThrow('already exists')
    })

    it('throws for invalid name', async () => {
      await expect(service.create({ name: '../evil' }, 'x')).rejects.toThrow('invalid')
    })
  })

  describe('update()', () => {
    beforeEach(() => {
      writeFileSync(path.join(tmpDir, 'up.md'), '---\nname: up\ndescription: Old\nmodel: sonnet\n---\nOld prompt.')
    })

    it('shallow merges frontmatter', async () => {
      const cmd = await service.update('up', { frontmatter: { description: 'New' } })
      expect(cmd!.frontmatter.description).toBe('New')
      expect(cmd!.frontmatter.model).toBe('sonnet')
      expect(cmd!.content).toBe('Old prompt.')
    })

    it('updates content only', async () => {
      const cmd = await service.update('up', { content: 'New prompt.' })
      expect(cmd!.content).toBe('New prompt.')
      expect(cmd!.frontmatter.description).toBe('Old')
    })

    it('returns null when not found', async () => {
      expect(await service.update('nope', { content: 'x' })).toBeNull()
    })
  })

  describe('delete()', () => {
    it('deletes command file', async () => {
      writeFileSync(path.join(tmpDir, 'del.md'), '---\nname: del\n---\nbye')
      expect(await service.delete('del')).toBe(true)
      expect(existsSync(path.join(tmpDir, 'del.md'))).toBe(false)
    })

    it('returns false when not found', async () => {
      expect(await service.delete('nope')).toBe(false)
    })

    it('returns false for invalid name', async () => {
      expect(await service.delete('../evil')).toBe(false)
    })
  })
})
