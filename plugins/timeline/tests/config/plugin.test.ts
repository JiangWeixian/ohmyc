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

describe('Codex marketplace entry', () => {
  it('points the timeline plugin entry at plugins/timeline', () => {
    const marketplacePath = path.resolve(import.meta.dirname, '../../../../.agents/plugins/marketplace.json')
    const marketplace = JSON.parse(readFileSync(marketplacePath, 'utf8')) as {
      name: string
      plugins: Array<{
        name: string
        source: { source: string; path: string }
        policy: { installation: string; authentication: string }
        category: string
      }>
    }

    const entry = marketplace.plugins.find(plugin => plugin.name === 'timeline')
    expect(marketplace.name).toBe('ohmyc')
    expect(entry).toEqual({
      name: 'timeline',
      source: {
        source: 'local',
        path: './plugins/timeline',
      },
      policy: {
        installation: 'AVAILABLE',
        authentication: 'ON_INSTALL',
      },
      category: 'Productivity',
    })
  })
})

describe('hook configuration compatibility', () => {
  it('routes Claude Code Stop hook to ingest-claude.sh with CLAUDE_SESSION_ID', () => {
    const pluginRoot = '$' + '{PLUGIN_ROOT:-$CLAUDE_PLUGIN_ROOT}'
    const hooksJson = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, '../../hooks/hooks.json'), 'utf8'),
    ) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } }

    const command = hooksJson.hooks.Stop[0].hooks[0].command
    expect(command).toBe(`${pluginRoot}/hooks/ingest-claude.sh $CLAUDE_SESSION_ID`)
  })

  it('routes Codex Stop hook to ingest-codex.sh without Claude arguments', () => {
    const pluginRoot = '$' + '{PLUGIN_ROOT}'
    const hooksJson = JSON.parse(
      readFileSync(path.resolve(import.meta.dirname, '../../hooks.json'), 'utf8'),
    ) as { hooks: { Stop: Array<{ hooks: Array<{ command: string }> }> } }

    const command = hooksJson.hooks.Stop[0].hooks[0].command
    expect(command).toBe(`${pluginRoot}/hooks/ingest-codex.sh`)
  })
})
