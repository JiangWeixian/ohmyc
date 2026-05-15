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
} from 'vitest'

import { AgentsSharedProvider } from '@/server/services/providers/agents-shared-provider'

describe('AgentsSharedProvider', () => {
  let home: string
  let cwd: string
  beforeEach(() => {
    home = mkdtempSync(path.join(os.tmpdir(), 'agents-prov-home-'))
    cwd = mkdtempSync(path.join(os.tmpdir(), 'agents-prov-cwd-'))
  })
  afterEach(() => {
    rmSync(home, { recursive: true, force: true })
    rmSync(cwd, { recursive: true, force: true })
  })

  it('id is agents and only exposes skills dirs', () => {
    const p = new AgentsSharedProvider({ home, cwd })
    expect(p.id).toBe('agents')
    expect(p.agentsDirs()).toEqual([])
    expect(p.commandsDirs()).toEqual([])
  })

  it('skillsDirs lists ~/.agents/skills then <cwd>/.agents/skills when the project dir exists', () => {
    mkdirSync(path.join(cwd, '.agents'))
    const p = new AgentsSharedProvider({ home, cwd })
    expect(p.skillsDirs()).toEqual([
      path.join(home, '.agents', 'skills'),
      path.join(cwd, '.agents', 'skills'),
    ])
  })

  it('omits project dir when <cwd>/.agents does not exist', () => {
    const p = new AgentsSharedProvider({ home, cwd })
    expect(p.skillsDirs()).toEqual([path.join(home, '.agents', 'skills')])
  })
})
