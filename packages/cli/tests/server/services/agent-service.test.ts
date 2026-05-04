import {
  existsSync,
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
} from 'vitest'

import { AgentService } from '@/server/services/agent-service'

describe('AgentService', () => {
  let tmpDir: string
  let service: AgentService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'agents-test-'))
    service = new AgentService(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('list()', () => {
    it('returns empty array for empty directory', async () => {
      const agents = await service.list()
      expect(agents).toEqual([])
    })

    it('returns parsed agents sorted alphabetically', async () => {
      writeFileSync(path.join(tmpDir, 'zebra-agent.md'), [
        '---',
        'name: zebra-agent',
        'description: Z agent',
        'model: sonnet',
        'tools:',
        '  - Read',
        '  - Grep',
        '---',
        'You are a zebra agent.',
      ].join('\n'))

      writeFileSync(path.join(tmpDir, 'alpha-agent.md'), [
        '---',
        'name: alpha-agent',
        'description: A agent',
        '---',
        'You are an alpha agent.',
      ].join('\n'))

      const agents = await service.list()
      expect(agents).toHaveLength(2)
      expect(agents[0].id).toBe('alpha-agent')
      expect(agents[1].id).toBe('zebra-agent')
      expect(agents[1].frontmatter.tools).toEqual(['Read', 'Grep'])
      expect(agents[0].content).toBe('You are an alpha agent.')
      expect(agents[0].raw).toContain('---')
    })

    it('ignores non-.md files', async () => {
      writeFileSync(path.join(tmpDir, 'notes.txt'), 'not an agent')
      writeFileSync(path.join(tmpDir, 'agent.md'), [
        '---',
        'name: agent',
        'description: An agent',
        '---',
        'prompt',
      ].join('\n'))

      const agents = await service.list()
      expect(agents).toHaveLength(1)
      expect(agents[0].id).toBe('agent')
    })

    it('skips files with malformed frontmatter', async () => {
      writeFileSync(path.join(tmpDir, 'bad.md'), 'no frontmatter here')
      writeFileSync(path.join(tmpDir, 'good.md'), [
        '---',
        'name: good',
        'description: Good agent',
        '---',
        'prompt',
      ].join('\n'))

      const agents = await service.list()
      expect(agents).toHaveLength(1)
      expect(agents[0].id).toBe('good')
    })

    it('returns empty array when directory does not exist', async () => {
      const noDir = new AgentService('/tmp/nonexistent-agents-dir-xyz')
      const agents = await noDir.list()
      expect(agents).toEqual([])
    })
  })

  describe('get()', () => {
    it('returns agent by name', async () => {
      writeFileSync(path.join(tmpDir, 'my-agent.md'), [
        '---',
        'name: my-agent',
        'description: My agent',
        'model: opus',
        '---',
        'You are my agent.',
      ].join('\n'))

      const agent = await service.get('my-agent')
      expect(agent).not.toBeNull()
      expect(agent!.id).toBe('my-agent')
      expect(agent!.frontmatter.name).toBe('my-agent')
      expect(agent!.frontmatter.model).toBe('opus')
      expect(agent!.content).toBe('You are my agent.')
      expect(agent!.source).toBe('local')
    })

    it('returns null when agent does not exist', async () => {
      const agent = await service.get('nonexistent')
      expect(agent).toBeNull()
    })

    it('returns null when directory does not exist', async () => {
      const noDir = new AgentService('/tmp/nonexistent-agents-dir-xyz')
      const agent = await noDir.get('anything')
      expect(agent).toBeNull()
    })

    it('returns null for invalid name', async () => {
      const agent = await service.get('../evil')
      expect(agent).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates agent file and returns agent', async () => {
      const agent = await service.create(
        { name: 'new-agent', description: 'A new agent' },
        'You are a new agent.',
      )

      expect(agent.id).toBe('new-agent')
      expect(agent.frontmatter.name).toBe('new-agent')
      expect(agent.content).toBe('You are a new agent.')
      expect(agent.filename).toBe('new-agent.md')
      expect(agent.source).toBe('local')

      // Verify file was written
      const written = readFileSync(path.join(tmpDir, 'new-agent.md'), 'utf8')
      expect(written).toContain('name: new-agent')
      expect(written).toContain('You are a new agent.')
    })

    it('round-trips correctly (create then get returns same data)', async () => {
      const created = await service.create(
        { name: 'roundtrip', description: 'Roundtrip test' },
        'prompt content',
      )
      const fetched = await service.get('roundtrip')
      expect(fetched).not.toBeNull()
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.frontmatter.name).toBe(created.frontmatter.name)
      expect(fetched!.content).toBe(created.content)
    })

    it('auto-creates directory if it does not exist', async () => {
      const nestedDir = path.join(tmpDir, 'nested', 'agents')
      const nestedService = new AgentService(nestedDir)

      const agent = await nestedService.create(
        { name: 'test', description: 'Test' },
        'prompt',
      )

      expect(agent.id).toBe('test')
      expect(existsSync(path.join(nestedDir, 'test.md'))).toBe(true)
    })

    it('throws when agent with same name already exists', async () => {
      writeFileSync(path.join(tmpDir, 'existing.md'), [
        '---',
        'name: existing',
        'description: Existing agent',
        '---',
        'prompt',
      ].join('\n'))

      await expect(
        service.create({ name: 'existing', description: 'Duplicate' }, 'prompt'),
      ).rejects.toThrow('already exists')
    })

    it('throws when name contains invalid characters', async () => {
      await expect(
        service.create({ name: '../evil', description: 'Bad' }, 'prompt'),
      ).rejects.toThrow('invalid')
    })
  })

  describe('update()', () => {
    beforeEach(() => {
      writeFileSync(path.join(tmpDir, 'updatable.md'), [
        '---',
        'name: updatable',
        'description: Original description',
        'model: sonnet',
        '---',
        'Original prompt.',
      ].join('\n'))
    })

    it('updates frontmatter fields with shallow merge', async () => {
      const agent = await service.update('updatable', {
        frontmatter: { description: 'Updated description' },
      })

      expect(agent).not.toBeNull()
      expect(agent!.frontmatter.description).toBe('Updated description')
      expect(agent!.frontmatter.model).toBe('sonnet')
      expect(agent!.content).toBe('Original prompt.')
    })

    it('updates content only', async () => {
      const agent = await service.update('updatable', {
        content: 'New prompt.',
      })

      expect(agent).not.toBeNull()
      expect(agent!.content).toBe('New prompt.')
      expect(agent!.frontmatter.description).toBe('Original description')
    })

    it('updates both frontmatter and content', async () => {
      const agent = await service.update('updatable', {
        frontmatter: { description: 'New desc' },
        content: 'New prompt.',
      })

      expect(agent).not.toBeNull()
      expect(agent!.frontmatter.description).toBe('New desc')
      expect(agent!.content).toBe('New prompt.')
    })

    it('returns null when agent does not exist', async () => {
      const agent = await service.update('nonexistent', {
        frontmatter: { description: 'nope' },
      })
      expect(agent).toBeNull()
    })
  })

  describe('delete()', () => {
    it('deletes existing agent file', async () => {
      writeFileSync(path.join(tmpDir, 'doomed.md'), [
        '---',
        'name: doomed',
        'description: To be deleted',
        '---',
        'goodbye',
      ].join('\n'))

      const result = await service.delete('doomed')
      expect(result).toBe(true)
      expect(existsSync(path.join(tmpDir, 'doomed.md'))).toBe(false)
    })

    it('returns false when agent does not exist', async () => {
      const result = await service.delete('nonexistent')
      expect(result).toBe(false)
    })

    it('returns false for invalid name', async () => {
      const result = await service.delete('../evil')
      expect(result).toBe(false)
    })
  })
})
