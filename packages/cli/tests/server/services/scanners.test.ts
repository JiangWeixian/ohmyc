import {
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

import { scanMdFiles, scanSkillDirs } from '@/server/services/scanners'

describe('scanners', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'scanners-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('scanMdFiles returns empty array when the dir does not exist', async () => {
    expect(await scanMdFiles(path.join(tmp, 'missing'))).toEqual([])
  })

  it('scanMdFiles returns absolute paths to .md files only, sorted', async () => {
    writeFileSync(path.join(tmp, 'b.md'), '')
    writeFileSync(path.join(tmp, 'a.md'), '')
    writeFileSync(path.join(tmp, 'note.txt'), '')
    const out = await scanMdFiles(tmp)
    expect(out.map(f => path.basename(f))).toEqual(['a.md', 'b.md'])
    expect(out.every(f => path.isAbsolute(f))).toBe(true)
  })

  it('scanSkillDirs returns paths to SKILL.md inside immediate subdirectories', async () => {
    mkdirSync(path.join(tmp, 'foo'))
    mkdirSync(path.join(tmp, 'bar'))
    writeFileSync(path.join(tmp, 'foo', 'SKILL.md'), '')
    writeFileSync(path.join(tmp, 'bar', 'NOT-SKILL.md'), '')
    const out = await scanSkillDirs(tmp)
    expect(out.map(f => path.basename(path.dirname(f)))).toEqual(['foo'])
  })
})
