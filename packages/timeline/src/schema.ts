// ============================================================
// @claudeui/timeline — Database Schema & TypeScript Types
// Source of truth for all DB structures
// ============================================================

// ------------------------------------------------------------------
// 1. Interface definitions for database rows
// ------------------------------------------------------------------

/** A single session record in the `sessions` table. */
export interface SessionRow {
  session_id: string
  project: string
  started_at: number
  ended_at: number
  duration_ms: number
  turns: number
  tokens_input: number
  tokens_output: number
  tokens_cached: number
  summary: string | null
  summary_source: string
  transcript_path: string
  last_offset: number
  ingested_at: number
  model: string | null
}

/** A single tool usage record in the `session_tools` table. */
export interface SessionToolRow {
  session_id: string
  tool_name: string
  call_count: number
}

/** A single skill usage record in the `session_skills` table. */
export interface SessionSkillRow {
  session_id: string
  skill_name: string
}

/** A single key/value record in the `meta` table. */
export interface MetaRow {
  key: string
  value: string
}

/** A session enriched with its tools and skills. */
export interface SessionDetail extends SessionRow {
  tools: SessionToolRow[]
  skills: SessionSkillRow[]
}

// ------------------------------------------------------------------
// 2. Query parameter types
// ------------------------------------------------------------------

/** Parameters for the heatmap query. */
export interface HeatmapParams {
  from: string // YYYY-MM-DD
  to: string // YYYY-MM-DD
  metric: 'sessions' | 'tokens' | 'turns'
  project?: string
}

/** A single data point in a heatmap response. */
export interface HeatmapPoint {
  date: string // YYYY-MM-DD
  value: number
}

/** Parameters for the events (session list) query. */
export interface EventsParams {
  from?: string // YYYY-MM-DD
  to?: string // YYYY-MM-DD
  project?: string
  limit?: number
  cursor?: string
}

/** Result shape for the events query. */
export interface EventsResult {
  days: DayEvents[]
  nextCursor?: string
}

/** Events grouped by calendar day. */
export interface DayEvents {
  day: string // YYYY-MM-DD
  projectGroups: ProjectGroup[]
  session_count: number
  turn_count: number
  token_count: number
}

/** A project group within a day, containing sessions and aggregates. */
export interface ProjectGroup {
  project: string
  sessions: SessionRow[]
  session_count: number
  turn_count: number
  token_count: number
  tool_count: number
  skill_count: number
}

// ------------------------------------------------------------------
// 3. Schema constants
// ------------------------------------------------------------------

/** Current schema version. Increment this when adding migrations. */
export const CURRENT_SCHEMA_VERSION = 2

/** Complete SQL to create all tables and indexes. */
export const SCHEMA_SQL = `
CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,
  project           TEXT NOT NULL,
  started_at        INTEGER NOT NULL,
  ended_at          INTEGER NOT NULL,
  duration_ms       INTEGER NOT NULL,
  turns             INTEGER NOT NULL,
  tokens_input      INTEGER NOT NULL DEFAULT 0,
  tokens_output     INTEGER NOT NULL DEFAULT 0,
  tokens_cached     INTEGER NOT NULL DEFAULT 0,
  summary           TEXT,
  summary_source    TEXT NOT NULL,
  transcript_path   TEXT NOT NULL,
  last_offset       INTEGER NOT NULL,
  ingested_at       INTEGER NOT NULL,
  model             TEXT
);

CREATE INDEX idx_sessions_started_at ON sessions(started_at DESC);
CREATE INDEX idx_sessions_project    ON sessions(project, started_at DESC);

CREATE TABLE session_tools (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  tool_name   TEXT NOT NULL,
  call_count  INTEGER NOT NULL DEFAULT 1,
  PRIMARY KEY (session_id, tool_name)
);

CREATE TABLE session_skills (
  session_id  TEXT NOT NULL REFERENCES sessions(session_id) ON DELETE CASCADE,
  skill_name  TEXT NOT NULL,
  PRIMARY KEY (session_id, skill_name)
);

CREATE TABLE meta (
  key    TEXT PRIMARY KEY,
  value  TEXT NOT NULL
);
`

/** Migrations map: version → SQL string. V1 is the baseline (empty). */
export const MIGRATIONS: Record<number, string> = {
  1: '',
  2: 'ALTER TABLE sessions ADD COLUMN model TEXT;',
}
