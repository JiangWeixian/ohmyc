import { readFileSync } from 'node:fs'
import path from 'node:path'

import {
  describe,
  expect,
  it,
} from 'vitest'

describe('Codex plugin manifest', () => {
  it('uses the validation-safe Codex manifest shape', () => {
    const manifestPath = path.resolve(import.meta.dirname, '../../.codex-plugin/plugin.json')
    const manifest = JSON.parse(readFileSync(manifestPath, 'utf8')) as Record<string, unknown>
    const interfaceMeta = manifest.interface as Record<string, unknown>

    expect(manifest.name).toBe('timeline')
    expect(manifest.version).toBe('1.0.0')
    expect(manifest).not.toHaveProperty('hooks')
    expect(interfaceMeta.defaultPrompt).toEqual([
      'Show my recent Claude Code, OpenCode, and Codex session activity.',
    ])
  })
})
