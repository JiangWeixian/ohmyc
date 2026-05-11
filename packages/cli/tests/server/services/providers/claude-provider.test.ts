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

import { ClaudeProvider } from '@/server/services/providers/claude-provider'

describe('ClaudeProvider', () => {
  let tmp: string
  beforeEach(() => {
    tmp = mkdtempSync(path.join(os.tmpdir(), 'claude-prov-'))
  })
  afterEach(() => {
    rmSync(tmp, { recursive: true, force: true })
  })

  it('exposes id and displayName', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    expect(p.id).toBe('claude')
    expect(p.displayName).toMatch(/claude/i)
  })

  it('agentsDirs returns global then project, omitting null', () => {
    const projectDir = path.join(tmp, 'project')
    mkdirSync(projectDir, { recursive: true })
    const p = new ClaudeProvider({
      agentsGlobalDir: path.join(tmp, 'global', 'agents'),
      skillsGlobalDir: path.join(tmp, 'global', 'skills'),
      commandsGlobalDir: path.join(tmp, 'global', 'commands'),
      projectDir,
    })
    expect(p.agentsDirs()).toEqual([
      path.join(tmp, 'global', 'agents'),
      path.join(projectDir, 'agents'),
    ])
  })

  it('parseAgent returns null when required frontmatter is missing', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    expect(p.parseAgent('/x.md', '---\n---\nbody')).toBeNull()
  })

  it('parseAgent returns parsed agent with name+description', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    const parsed: any = p.parseAgent('/x.md', '---\nname: foo\ndescription: bar\n---\nbody')
    expect(parsed.frontmatter.name).toBe('foo')
    expect(parsed.frontmatter.description).toBe('bar')
  })

  it('agentBadges emits model when present', () => {
    const p = new ClaudeProvider({ agentsGlobalDir: tmp, projectDir: null })
    const badges = p.agentBadges({ frontmatter: { model: 'sonnet' } })
    expect(badges).toEqual([{ kind: 'mono', label: 'sonnet' }])
  })
})
