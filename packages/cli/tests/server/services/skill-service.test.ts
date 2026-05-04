import {
  existsSync,
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

import { SkillService } from '@/server/services/skill-service'

describe('SkillService', () => {
  let tmpDir: string
  let service: SkillService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'skills-test-'))
    service = new SkillService(tmpDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  function createSkillDir(name: string, content: string) {
    const dir = path.join(tmpDir, name)
    mkdirSync(dir, { recursive: true })
    writeFileSync(path.join(dir, 'SKILL.md'), content)
  }

  describe('list()', () => {
    it('returns empty array for empty directory', async () => {
      const skills = await service.list()
      expect(skills).toEqual([])
    })

    it('returns empty array when directory does not exist', async () => {
      const noDir = new SkillService('/tmp/nonexistent-skills-xyz')
      const skills = await noDir.list()
      expect(skills).toEqual([])
    })

    it('returns parsed skills sorted alphabetically', async () => {
      createSkillDir('zebra-skill', [
        '---',
        'name: zebra-skill',
        'description: Z skill',
        'model: sonnet',
        '---',
        'You are a zebra skill.',
      ].join('\n'))

      createSkillDir('alpha-skill', [
        '---',
        'name: alpha-skill',
        'description: A skill',
        '---',
        'You are an alpha skill.',
      ].join('\n'))

      const skills = await service.list()
      expect(skills).toHaveLength(2)
      expect(skills[0].id).toBe('alpha-skill')
      expect(skills[1].id).toBe('zebra-skill')
      expect(skills[0].content).toBe('You are an alpha skill.')
    })

    it('ignores non-directory entries', async () => {
      writeFileSync(path.join(tmpDir, 'stray-file.txt'), 'not a skill')
      createSkillDir('real-skill', '---\nname: real-skill\ndescription: Real\n---\nprompt')

      const skills = await service.list()
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('real-skill')
    })

    it('skips directories without SKILL.md', async () => {
      mkdirSync(path.join(tmpDir, 'empty-dir'))
      createSkillDir('good', '---\nname: good\ndescription: Good\n---\nprompt')

      const skills = await service.list()
      expect(skills).toHaveLength(1)
      expect(skills[0].id).toBe('good')
    })

    it('uses directory name when frontmatter name is missing', async () => {
      createSkillDir('my-skill', '---\ndescription: No name field\n---\nprompt')

      const skills = await service.list()
      expect(skills).toHaveLength(1)
      expect(skills[0].frontmatter.name).toBe('my-skill')
    })
  })

  describe('get()', () => {
    it('returns skill by name', async () => {
      createSkillDir('my-skill', [
        '---',
        'name: my-skill',
        'description: My skill',
        'model: opus',
        '---',
        'You are my skill.',
      ].join('\n'))

      const skill = await service.get('my-skill')
      expect(skill).not.toBeNull()
      expect(skill!.id).toBe('my-skill')
      expect(skill!.frontmatter.name).toBe('my-skill')
      expect(skill!.content).toBe('You are my skill.')
      expect(skill!.source).toBe('local')
    })

    it('returns null when skill does not exist', async () => {
      const skill = await service.get('nonexistent')
      expect(skill).toBeNull()
    })

    it('returns null for invalid name', async () => {
      const skill = await service.get('../evil')
      expect(skill).toBeNull()
    })
  })

  describe('create()', () => {
    it('creates skill directory with SKILL.md', async () => {
      const skill = await service.create(
        { name: 'new-skill', description: 'A new skill' },
        'You are a new skill.',
      )

      expect(skill.id).toBe('new-skill')
      expect(skill.dirName).toBe('new-skill')
      expect(skill.content).toBe('You are a new skill.')
      expect(existsSync(path.join(tmpDir, 'new-skill', 'SKILL.md'))).toBe(true)
    })

    it('round-trips correctly', async () => {
      const created = await service.create(
        { name: 'roundtrip', description: 'Test' },
        'prompt content',
      )
      const fetched = await service.get('roundtrip')
      expect(fetched!.id).toBe(created.id)
      expect(fetched!.content).toBe(created.content)
    })

    it('throws when skill already exists', async () => {
      createSkillDir('existing', '---\nname: existing\ndescription: Exists\n---\nprompt')

      await expect(
        service.create({ name: 'existing', description: 'Dup' }, 'prompt'),
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
      createSkillDir('updatable', [
        '---',
        'name: updatable',
        'description: Original',
        'model: sonnet',
        '---',
        'Original prompt.',
      ].join('\n'))
    })

    it('updates frontmatter with shallow merge', async () => {
      const skill = await service.update('updatable', {
        frontmatter: { description: 'Updated' },
      })

      expect(skill!.frontmatter.description).toBe('Updated')
      expect(skill!.frontmatter.model).toBe('sonnet')
      expect(skill!.content).toBe('Original prompt.')
    })

    it('updates content only', async () => {
      const skill = await service.update('updatable', { content: 'New prompt.' })
      expect(skill!.content).toBe('New prompt.')
      expect(skill!.frontmatter.description).toBe('Original')
    })

    it('returns null when skill does not exist', async () => {
      const skill = await service.update('nonexistent', { content: 'x' })
      expect(skill).toBeNull()
    })
  })

  describe('delete()', () => {
    it('deletes skill directory', async () => {
      createSkillDir('doomed', '---\nname: doomed\ndescription: Del\n---\nbye')

      const result = await service.delete('doomed')
      expect(result).toBe(true)
      expect(existsSync(path.join(tmpDir, 'doomed'))).toBe(false)
    })

    it('returns false when skill does not exist', async () => {
      const result = await service.delete('nonexistent')
      expect(result).toBe(false)
    })

    it('returns false for invalid name', async () => {
      const result = await service.delete('../evil')
      expect(result).toBe(false)
    })
  })
})
