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

import { migrateLegacyHome } from '@/migrate-home'

describe('migrateLegacyHome', () => {
  let tmpHome: string
  let savedOhmycHome: string | undefined

  beforeEach(() => {
    tmpHome = mkdtempSync(path.join(os.tmpdir(), 'migrate-home-test-'))
    savedOhmycHome = process.env.OHMYC_HOME
    delete process.env.OHMYC_HOME
  })

  afterEach(() => {
    rmSync(tmpHome, { recursive: true, force: true })
    if (savedOhmycHome === undefined) {
      delete process.env.OHMYC_HOME
    } else {
      process.env.OHMYC_HOME = savedOhmycHome
    }
  })

  it('moves ~/.cui to ~/.config/ohmyc when target is missing and source exists', () => {
    const legacy = path.join(tmpHome, '.cui')
    const target = path.join(tmpHome, '.config', 'ohmyc')
    mkdirSync(legacy, { recursive: true })
    writeFileSync(path.join(legacy, 'settings.json'), '{"ok":true}')

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('migrated')
    expect(existsSync(legacy)).toBe(false)
    expect(existsSync(target)).toBe(true)
    expect(readFileSync(path.join(target, 'settings.json'), 'utf8')).toBe('{"ok":true}')
  })

  it('does nothing when target already exists', () => {
    const legacy = path.join(tmpHome, '.cui')
    const target = path.join(tmpHome, '.config', 'ohmyc')
    mkdirSync(legacy, { recursive: true })
    mkdirSync(target, { recursive: true })
    writeFileSync(path.join(legacy, 'legacy.txt'), 'legacy')
    writeFileSync(path.join(target, 'new.txt'), 'new')

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('skipped-target-exists')
    expect(existsSync(path.join(legacy, 'legacy.txt'))).toBe(true)
    expect(existsSync(path.join(target, 'new.txt'))).toBe(true)
  })

  it('does nothing when legacy ~/.cui does not exist', () => {
    const result = migrateLegacyHome({ home: tmpHome })
    expect(result).toBe('skipped-no-legacy')
    expect(existsSync(path.join(tmpHome, '.config', 'ohmyc'))).toBe(false)
  })

  it('does nothing when OHMYC_HOME is set (user chose a custom location)', () => {
    process.env.OHMYC_HOME = path.join(tmpHome, 'custom')
    const legacy = path.join(tmpHome, '.cui')
    mkdirSync(legacy, { recursive: true })

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('skipped-env-set')
    expect(existsSync(legacy)).toBe(true)
    expect(existsSync(path.join(tmpHome, '.config', 'ohmyc'))).toBe(false)
  })

  it('does not import the pino logger (would eagerly create target dir)', () => {
    const source = readFileSync(
      path.resolve(import.meta.dirname, '../src/migrate-home.ts'),
      'utf8',
    )
    expect(source).not.toMatch(/from ['"]\.\/logger['"]/)
  })

  it('migrates even when ~/.config already exists (parent dir, not target)', () => {
    const legacy = path.join(tmpHome, '.cui')
    const target = path.join(tmpHome, '.config', 'ohmyc')
    mkdirSync(path.join(tmpHome, '.config'), { recursive: true })
    mkdirSync(legacy, { recursive: true })
    writeFileSync(path.join(legacy, 'settings.json'), '{"ok":true}')

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('migrated')
    expect(existsSync(target)).toBe(true)
    expect(readFileSync(path.join(target, 'settings.json'), 'utf8')).toBe('{"ok":true}')
  })

  it('propagates filesystem errors to the caller (e.g. ~/.config blocked by a file)', () => {
    // Real-world failure mode: parent path exists as a non-directory, so
    // mkdirSync(path.dirname(target), {recursive:true}) throws ENOTDIR.
    // This exercises the same error-surface path that EXDEV / EACCES would.
    mkdirSync(path.join(tmpHome, '.cui'), { recursive: true })
    writeFileSync(path.join(tmpHome, '.config'), 'not a directory')

    expect(() => migrateLegacyHome({ home: tmpHome })).toThrow()
  })

  it('creates ~/.config parent directory if it does not exist', () => {
    const legacy = path.join(tmpHome, '.cui')
    mkdirSync(legacy, { recursive: true })
    expect(existsSync(path.join(tmpHome, '.config'))).toBe(false)

    const result = migrateLegacyHome({ home: tmpHome })

    expect(result).toBe('migrated')
    expect(existsSync(path.join(tmpHome, '.config', 'ohmyc'))).toBe(true)
  })
})
