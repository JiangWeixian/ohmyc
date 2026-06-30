import { __setTransportForTests } from '../src/lib/transport'
import { resetMock, setMockHandler } from '../src/lib/transport/mock'
import {
  e2eAgents,
  e2eCommands,
  e2eMarketplaces,
  e2ePlugins,
  e2eSkills,
} from './fixtures/agents'

import type { SetupStatus } from '../src/hooks/use-setup-status'
import type { HeatmapPoint, TimelineMetric } from '../src/hooks/use-timeline'

function makeHeatmap(metric: TimelineMetric): HeatmapPoint[] {
  const points: HeatmapPoint[] = []
  for (let i = 90; i >= 0; i -= 7) {
    const d = new Date()
    d.setUTCHours(0, 0, 0, 0)
    d.setUTCDate(d.getUTCDate() - i)
    const base = metric === 'tokens' ? 12_000 : 5
    const variance = metric === 'tokens' ? 5000 : 3
    points.push({
      date: d.toISOString().slice(0, 10),
      value: Math.max(0, base + Math.floor(Math.sin(i / 7) * variance)),
    })
  }
  return points
}

function ready(): void {
  resetMock()
  setMockHandler('setup.status', async () => ({ state: 'ready' }) satisfies SetupStatus)
  setMockHandler('timeline.years', async () => ({ years: [2026] }))
  setMockHandler('timeline.projects', async () => ({ projects: ['ohmyc', 'ohmyc-desktop'] }))
  setMockHandler('timeline.heatmap', async (args: unknown) => {
    const metric = (args as { metric?: TimelineMetric }).metric ?? 'sessions'
    return { data: makeHeatmap(metric) }
  })
  setMockHandler('timeline.events', async () => ({ days: [] }))
  setMockHandler('timeline.status', async () => ({ sessionCount: 42, lastSyncAt: Date.now() }))
  setMockHandler('agents.list', async () => ({ agents: e2eAgents }))
  setMockHandler('agents.get', async (args: unknown) => {
    const name = (args as { name: string }).name
    return { agent: e2eAgents.find(a => a.frontmatter.name === name) ?? e2eAgents[0] }
  })
  setMockHandler('skills.list', async () => ({ skills: e2eSkills }))
  setMockHandler('skills.get', async (args: unknown) => {
    const name = (args as { name: string }).name
    return { skill: e2eSkills.find(s => s.frontmatter.name === name) ?? e2eSkills[0] }
  })
  setMockHandler('commands.list', async () => ({ commands: e2eCommands }))
  setMockHandler('commands.get', async (args: unknown) => {
    const name = (args as { name: string }).name
    return { command: e2eCommands.find(c => c.frontmatter.name === name) ?? e2eCommands[0] }
  })
  setMockHandler('plugins.list', async () => e2ePlugins)
  setMockHandler('marketplaces.list', async () => e2eMarketplaces)
}

function missingStore(): void {
  resetMock()
  setMockHandler('setup.status', async () => ({ state: 'missing_store' }) satisfies SetupStatus)
}

function unreadableStore(): void {
  resetMock()
  setMockHandler('setup.status', async () => ({ state: 'unreadable_store' }) satisfies SetupStatus)
}

function internalError(): void {
  resetMock()
  setMockHandler('setup.status', async () => ({ state: 'internal_error' }) satisfies SetupStatus)
}

function empty(): void {
  resetMock()
  setMockHandler('setup.status', async () => ({ state: 'ready' }) satisfies SetupStatus)
  setMockHandler('timeline.years', async () => ({ years: [] }))
  setMockHandler('timeline.projects', async () => ({ projects: [] }))
  setMockHandler('timeline.heatmap', async () => ({ data: [] }))
  setMockHandler('timeline.events', async () => ({ days: [] }))
  setMockHandler('timeline.status', async () => ({ sessionCount: 0, lastSyncAt: null }))
  setMockHandler('agents.list', async () => ({ agents: [] }))
  setMockHandler('agents.get', async () => ({ agent: null }))
  setMockHandler('skills.list', async () => ({ skills: [] }))
  setMockHandler('skills.get', async () => ({ skill: null }))
  setMockHandler('commands.list', async () => ({ commands: [] }))
  setMockHandler('commands.get', async () => ({ command: null }))
  setMockHandler('plugins.list', async () => ({ plugins: [] }))
  setMockHandler('marketplaces.list', async () => ({ marketplaces: [] }))
}

export type ScenarioName = 'empty' | 'error' | 'missing' | 'ready' | 'unreadable'

export const SCENARIOS: Record<ScenarioName, () => void> = {
  ready,
  missing: missingStore,
  unreadable: unreadableStore,
  error: internalError,
  empty,
}

/**
 * Installs mock handlers for the given scenario and activates the mock
 * transport. Called by the E2E bootstrap before rendering. Also exposed
 * on window.__e2eSetScenario so tests can switch mid-test.
 */
export function installScenario(name: ScenarioName): void {
  __setTransportForTests('mock')
  SCENARIOS[name]?.()
}
