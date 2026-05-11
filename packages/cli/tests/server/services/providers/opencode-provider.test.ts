import {
  mkdirSync,
  mkdtempSync,
  rmSync,
} from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import {
  afterEach,
  beforeEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { OpencodeProvider } from '@/server/services/providers/opencode-provider'

describe('OpencodeProvider', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'oc-prov-'))
    mkdirSync(path.join(tmp, '.opencode'), { recursive: true })
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
    vi.unstubAllEnvs()
  })

  it('id is opencode', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.id).toBe('opencode')
  })

  it('agentsDirs on linux defaults to ~/.config/opencode/agents and <cwd>/.opencode/agents', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, '.config', 'opencode', 'agents'),
      path.join(tmp, '.opencode', 'agents'),
    ])
  })

  it('agentsDirs on darwin uses Library/Application Support', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'darwin', cwd: tmp })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, 'Library', 'Application Support', 'opencode', 'agents'),
      path.join(tmp, '.opencode', 'agents'),
    ])
  })

  it('OPENCODE_CONFIG_DIR overrides the global config dir', () => {
    vi.stubEnv('OPENCODE_CONFIG_DIR', '/custom/opencode')
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.agentsDirs()[0]).toBe('/custom/opencode/agents')
  })

  it('project dir is omitted when <cwd>/.opencode/ does not exist', () => {
    const cwd = path.join(tmp, 'no-project')
    mkdirSync(cwd)
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, '.config', 'opencode', 'agents'),
    ])
  })

  it('parseAgent returns null on missing description', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(p.parseAgent('/x.md', '---\nname: foo\n---\nbody')).toBeNull()
  })

  it('agentBadges emits mode only (not permission)', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    const badges = p.agentBadges({
      frontmatter: { mode: 'subagent', permission: { edit: 'deny' } },
    })
    expect(badges).toEqual([{ kind: 'mono', label: 'subagent' }])
  })

  it('agentBadges tolerates malformed permission (does not throw)', () => {
    const p = new OpencodeProvider({ home: tmp, platform: 'linux', cwd: tmp })
    expect(() => p.agentBadges({ frontmatter: { permission: 'not-an-object' } })).not.toThrow()
  })
})
