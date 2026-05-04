import {
  existsSync,
  mkdirSync,
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

import { StoreService } from '@/server/services/store-service'

describe('StoreService', () => {
  let tmpDir: string
  let storeDir: string
  let profilesDir: string
  let service: StoreService

  beforeEach(() => {
    tmpDir = mkdtempSync(path.join(os.tmpdir(), 'store-test-'))
    storeDir = path.join(tmpDir, 'store')
    profilesDir = path.join(tmpDir, 'profiles')
    service = new StoreService(storeDir, profilesDir)
  })

  afterEach(() => {
    rmSync(tmpDir, { recursive: true, force: true })
  })

  describe('import()', () => {
    it('imports agents, skills, commands from source', async () => {
      const source = path.join(tmpDir, 'source')
      mkdirSync(path.join(source, 'agents'), { recursive: true })
      writeFileSync(path.join(source, 'agents', 'a.md'), 'agent')
      mkdirSync(path.join(source, 'skills', 'sk'), { recursive: true })
      writeFileSync(path.join(source, 'skills', 'sk', 'SKILL.md'), 'skill')
      mkdirSync(path.join(source, 'commands'), { recursive: true })
      writeFileSync(path.join(source, 'commands', 'c.md'), 'command')

      const result = await service.import({ sourceDir: source })
      expect(result.imported).toBe(3)
      expect(result.skipped).toBe(0)
      expect(result.overwritten).toBe(0)
      expect(existsSync(path.join(storeDir, 'agents', 'a.md'))).toBe(true)
      expect(existsSync(path.join(storeDir, 'skills', 'sk', 'SKILL.md'))).toBe(true)
      expect(existsSync(path.join(storeDir, 'commands', 'c.md'))).toBe(true)
    })

    it('reports dry-run conflicts without copying files', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true })
      writeFileSync(path.join(storeDir, 'agents', 'a.md'), 'existing')

      const source = path.join(tmpDir, 'source')
      mkdirSync(path.join(source, 'agents'), { recursive: true })
      writeFileSync(path.join(source, 'agents', 'a.md'), 'new')

      const result = await service.import({ sourceDir: source, dryRun: true })
      expect(result.imported).toBe(0)
      expect(result.skipped).toBe(0)
      expect(result.overwritten).toBe(0)
      expect(result.conflicts).toEqual([
        {
          type: 'agents',
          id: 'a',
          sourcePath: path.join(source, 'agents', 'a.md'),
          destinationPath: path.join(storeDir, 'agents', 'a.md'),
        },
      ])
      expect(readFileSync(path.join(storeDir, 'agents', 'a.md'), 'utf8')).toBe('existing')
    })

    it('skips existing components when overwrite is disabled', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true })
      writeFileSync(path.join(storeDir, 'agents', 'a.md'), 'existing')

      const source = path.join(tmpDir, 'source')
      mkdirSync(path.join(source, 'agents'), { recursive: true })
      writeFileSync(path.join(source, 'agents', 'a.md'), 'new')

      const result = await service.import({ sourceDir: source })
      expect(result.skipped).toBe(1)
      expect(result.imported).toBe(0)
      expect(result.overwritten).toBe(0)
    })

    it('overwrites an existing agent when overwrite is enabled', async () => {
      mkdirSync(path.join(storeDir, 'agents'), { recursive: true })
      writeFileSync(path.join(storeDir, 'agents', 'reviewer.md'), 'old content')

      const source = path.join(tmpDir, 'source')
      mkdirSync(path.join(source, 'agents'), { recursive: true })
      writeFileSync(path.join(source, 'agents', 'reviewer.md'), 'new content')

      const result = await service.import({ sourceDir: source, overwrite: true })
      expect(result.overwritten).toBe(1)
      expect(result.imported).toBe(0)
      expect(readFileSync(path.join(storeDir, 'agents', 'reviewer.md'), 'utf8')).toBe('new content')
    })

    it('copies nested skill assets', async () => {
      const source = path.join(tmpDir, 'source')
      mkdirSync(path.join(source, 'skills', 'designer', 'assets', 'icons'), { recursive: true })
      writeFileSync(path.join(source, 'skills', 'designer', 'SKILL.md'), 'skill')
      writeFileSync(path.join(source, 'skills', 'designer', 'assets', 'icons', 'logo.svg'), '<svg />')

      const result = await service.import({ sourceDir: source })
      expect(result.imported).toBe(1)
      expect(
        existsSync(path.join(storeDir, 'skills', 'designer', 'assets', 'icons', 'logo.svg')),
      ).toBe(true)
    })

    it('persists provenance with importPath and importedAt strings', async () => {
      const source = path.join(tmpDir, 'source')
      mkdirSync(path.join(source, 'agents'), { recursive: true })
      writeFileSync(path.join(source, 'agents', 'reviewer.md'), 'agent')

      await service.import({ sourceDir: source })

      const importsIndex = JSON.parse(
        readFileSync(path.join(storeDir, '.metadata', 'imports.json'), 'utf8'),
      )

      expect(importsIndex.agents.reviewer.importPath).toBe(path.join(source, 'agents', 'reviewer.md'))
      expect(typeof importsIndex.agents.reviewer.importedAt).toBe('string')
      expect(Number.isNaN(Date.parse(importsIndex.agents.reviewer.importedAt))).toBe(false)
    })
  })

  describe('getReferencingProfiles()', () => {
    it('returns profiles referencing a component', async () => {
      mkdirSync(path.join(profilesDir, 'prof-a'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'prof-a', 'profile.json'), JSON.stringify({
        name: 'prof-a', agents: ['reviewer'], skills: [], commands: [],
      }))
      mkdirSync(path.join(profilesDir, 'prof-b'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'prof-b', 'profile.json'), JSON.stringify({
        name: 'prof-b', agents: [], skills: [], commands: [],
      }))

      const references = await service.getReferencingProfiles('agents', 'reviewer')
      expect(references).toEqual(['prof-a'])
    })

    it('returns empty array when no references', async () => {
      const references = await service.getReferencingProfiles('agents', 'nobody')
      expect(references).toEqual([])
    })
  })

  describe('getReferencingProfiles() for model-configs', () => {
    it('returns profiles referencing a model config', async () => {
      mkdirSync(path.join(profilesDir, 'prof-a'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'prof-a', 'profile.json'), JSON.stringify({
        name: 'prof-a', agents: [], skills: [], commands: [], modelConfig: 'claude-pro',
      }))
      mkdirSync(path.join(profilesDir, 'prof-b'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'prof-b', 'profile.json'), JSON.stringify({
        name: 'prof-b', agents: [], skills: [], commands: [],
      }))

      const references = await service.getReferencingProfiles('model-configs', 'claude-pro')
      expect(references).toEqual(['prof-a'])
    })

    it('returns empty array when no profiles reference the model config', async () => {
      const references = await service.getReferencingProfiles('model-configs', 'nobody')
      expect(references).toEqual([])
    })

    it('returns multiple profiles referencing the same model config', async () => {
      mkdirSync(path.join(profilesDir, 'p1'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'p1', 'profile.json'), JSON.stringify({
        name: 'p1', agents: [], skills: [], commands: [], modelConfig: 'shared',
      }))
      mkdirSync(path.join(profilesDir, 'p2'), { recursive: true })
      writeFileSync(path.join(profilesDir, 'p2', 'profile.json'), JSON.stringify({
        name: 'p2', agents: [], skills: [], commands: [], modelConfig: 'shared',
      }))

      const references = await service.getReferencingProfiles('model-configs', 'shared')
      expect(references.toSorted()).toEqual(['p1', 'p2'])
    })
  })
})
