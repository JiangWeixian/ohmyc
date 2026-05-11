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
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'agents-prov-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('id is agents and only exposes skills dirs', () => {
    const p = new AgentsSharedProvider({ home: tmp, cwd: tmp })
    expect(p.id).toBe('agents')
    expect(p.agentsDirs()).toEqual([])
    expect(p.commandsDirs()).toEqual([])
  })

  it('skillsDirs lists ~/.agents/skills then <cwd>/.agents/skills when the project dir exists', () => {
    mkdirSync(path.join(tmp, '.agents'))
    const p = new AgentsSharedProvider({ home: tmp, cwd: tmp })
    expect(p.skillsDirs()).toEqual([
      path.join(tmp, '.agents', 'skills'),
      path.join(tmp, '.agents', 'skills'),
    ])
  })

  it('omits project dir when <cwd>/.agents does not exist', () => {
    const cwd = path.join(tmp, 'no-agents')
    mkdirSync(cwd)
    const p = new AgentsSharedProvider({ home: tmp, cwd })
    expect(p.skillsDirs()).toEqual([path.join(tmp, '.agents', 'skills')])
  })
})
