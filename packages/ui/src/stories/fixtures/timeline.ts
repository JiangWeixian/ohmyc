import type {
  DayEvents,
  HeatmapPoint,
  ProjectGroup,
  SessionRow,
} from '@/hooks/use-timeline'

const baseStart = Date.UTC(2026, 5, 19, 9, 0, 0)

function relativeDate(daysAgo: number): string {
  const date = new Date()
  date.setUTCHours(0, 0, 0, 0)
  date.setUTCDate(date.getUTCDate() - daysAgo)
  return date.toISOString().slice(0, 10)
}

function session(overrides: Partial<SessionRow>): SessionRow {
  return {
    session_id: overrides.session_id ?? 'session-1',
    project: overrides.project ?? 'ohmyc',
    started_at: overrides.started_at ?? baseStart,
    ended_at: overrides.ended_at ?? baseStart + 12 * 60 * 1000,
    duration_ms: overrides.duration_ms ?? 12 * 60 * 1000,
    turns: overrides.turns ?? 8,
    tokens_input: overrides.tokens_input ?? 12_000,
    tokens_output: overrides.tokens_output ?? 4300,
    tokens_cached: overrides.tokens_cached ?? 2000,
    summary: overrides.summary ?? 'Polished the monitor route and motion details',
    summary_source: overrides.summary_source ?? 'generated',
    transcript_path: overrides.transcript_path ?? '/tmp/session.jsonl',
    last_offset: overrides.last_offset ?? 42,
    ingested_at: overrides.ingested_at ?? baseStart + 13 * 60 * 1000,
    model: overrides.model ?? 'claude-opus-4-1',
    agent_name: overrides.agent_name ?? 'claude',
  }
}

export const timelineHeatmap: HeatmapPoint[] = [
  { date: '2026-01-04', value: 1 },
  { date: '2026-02-14', value: 4 },
  { date: '2026-03-20', value: 8 },
  { date: '2026-04-22', value: 16 },
  { date: '2026-05-21', value: 32 },
  { date: '2026-06-19', value: 48 },
]

export const menubarTokens: HeatmapPoint[] = [
  { date: relativeDate(4), value: 5000 },
  { date: relativeDate(3), value: 12_000 },
  { date: relativeDate(2), value: 8000 },
  { date: relativeDate(1), value: 22_000 },
  { date: relativeDate(0), value: 15_000 },
]

export const menubarSessions: HeatmapPoint[] = [
  { date: relativeDate(4), value: 1 },
  { date: relativeDate(3), value: 3 },
  { date: relativeDate(2), value: 2 },
  { date: relativeDate(1), value: 5 },
  { date: relativeDate(0), value: 4 },
]

const ohmycSessions = [
  session({ session_id: 'ohmyc-a', summary: 'Wire Storybook fixtures for Timeline', turns: 14 }),
  session({ session_id: 'ohmyc-b', summary: 'Review command palette layout', started_at: baseStart - 90 * 60 * 1000, turns: 6 }),
]

const desktopSessions = [
  session({
    session_id: 'desktop-a',
    project: 'ohmyc-desktop',
    summary: 'Tune menubar heatmap tooltip behavior',
    agent_name: 'opencode',
    turns: 9,
  }),
]

export const timelineProjectGroups: ProjectGroup[] = [
  {
    project: 'ohmyc',
    sessions: ohmycSessions,
    session_count: 2,
    turn_count: 20,
    token_count: 36_300,
    tool_count: 7,
    skill_count: 2,
    agents: ['claude'],
  },
  {
    project: 'ohmyc-desktop',
    sessions: desktopSessions,
    session_count: 1,
    turn_count: 9,
    token_count: 18_300,
    tool_count: 4,
    skill_count: 1,
    agents: ['opencode'],
  },
]

export const timelineDays: DayEvents[] = [
  {
    day: '2026-06-19',
    projectGroups: timelineProjectGroups,
    session_count: 3,
    turn_count: 29,
    token_count: 54_600,
  },
]

export const timelineEventsResponse = {
  days: timelineDays,
}

export const longProjectName = 'generated-workspace-with-a-very-long-project-title-that-keeps-growing-past-the-row-budget'

const longProjectSessions = [
  session({
    session_id: 'long-project-a',
    project: longProjectName,
    summary: 'Verify long timeline project names preserve rollup metrics',
    turns: 6,
    tokens_input: 40_000,
    tokens_output: 36_000,
    tokens_cached: 84_000,
  }),
]

export const longProjectTimelineDays: DayEvents[] = [
  {
    day: '2026-06-19',
    projectGroups: [
      {
        project: longProjectName,
        sessions: longProjectSessions,
        session_count: 1,
        turn_count: 6,
        token_count: 160_000,
        tool_count: 1,
        skill_count: 1,
        agents: ['claude'],
      },
      ...timelineProjectGroups,
    ],
    session_count: 4,
    turn_count: 35,
    token_count: 214_600,
  },
]

export const longProjectTimelineEventsResponse = {
  days: longProjectTimelineDays,
}
