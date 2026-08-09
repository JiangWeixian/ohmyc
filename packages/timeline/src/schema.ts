// ============================================================
// @ohmyc/timeline — Database Schema & TypeScript Types
// Source of truth for all DB structures
// ============================================================

// ------------------------------------------------------------------
// 1. Interface definitions for database rows
// ------------------------------------------------------------------

/** A single session record in the `sessions` table. */
export interface SessionRow {
  /** Unique session identifier (UUID). */
  session_id: string
  /** Display-friendly project path (e.g. `~/projects/my-app`). */
  project: string
  /** Name of the agent that produced this session (e.g. `codex`, `claude`, `opencode`). */
  agent_name: string | null
  /** Session start time as Unix epoch milliseconds. */
  started_at: number
  /** Session end time as Unix epoch milliseconds. */
  ended_at: number
  /** Duration in milliseconds (`ended_at - started_at`). */
  duration_ms: number
  /** Number of user turns (natural-language messages only). */
  turns: number
  /** Total input tokens consumed across all assistant turns. */
  tokens_input: number
  /** Total output tokens generated across all assistant turns. */
  tokens_output: number
  /** Total tokens served from the prompt cache. */
  tokens_cached: number
  /** Short summary text — auto-generated or first user message. */
  summary: string | null
  /** How the summary was produced: `"auto"` or `"first_message"`. */
  summary_source: string
  /** Absolute path to the source JSONL transcript file. */
  transcript_path: string
  /** Byte offset of the last ingested line (for incremental re-ingest). */
  last_offset: number
  /** Timestamp when this row was last written to the database. */
  ingested_at: number
  /** Model identifier (e.g. `claude-sonnet-4-20250514`). */
  model: string | null
}

/** A single tool usage record in the `session_tools` table. */
export interface SessionToolRow {
  /** Foreign key to {@link SessionRow.session_id}. */
  session_id: string
  /** Name of the tool (e.g. `Read`, `Bash`, `Skill`). */
  tool_name: string
  /** Number of times this tool was invoked in the session. */
  call_count: number
}

/** A single skill usage record in the `session_skills` table. */
export interface SessionSkillRow {
  /** Foreign key to {@link SessionRow.session_id}. */
  session_id: string
  /** Name of the skill that was invoked (e.g. `investigate`, `qa`). */
  skill_name: string
}

/** A single key/value record in the `meta` table. */
export interface MetaRow {
  /** Unique key (e.g. `schema_version`, `last_sync_at`). */
  key: string
  /** String-encoded value. */
  value: string
}

/** Parsed result of a session transcript. Shared between ingest and writer. */
export interface ParsedSessionData {
  /** Unique session identifier (UUID). */
  sessionId: string
  /** Display-friendly project path. */
  project: string
  /** Name of the agent that produced this session. */
  agentName: string | null
  /** Session start time as Unix epoch milliseconds. */
  startedAt: number
  /** Session end time as Unix epoch milliseconds. */
  endedAt: number
  /** Duration in milliseconds. */
  durationMs: number
  /** Number of user turns (natural-language messages only). */
  turns: number
  /** Total input tokens consumed. */
  tokensInput: number
  /** Total output tokens generated. */
  tokensOutput: number
  /** Total tokens served from the prompt cache. */
  tokensCached: number
  /** Short summary text. */
  summary: string
  /** How the summary was produced. */
  summarySource: 'auto' | 'first_message'
  /** Absolute path to the source JSONL transcript file. */
  transcriptPath: string
  /** Size of the transcript file in bytes. */
  fileSize: number
  /** Tool usage counts for this session. */
  tools: Array<{ toolName: string; callCount: number }>
  /** Skill names invoked during this session. */
  skills: string[]
  /** Model identifier used for the session. */
  model: string | null
}

/** Summary of a write/ingest operation. */
export interface IngestResult {
  /** The session that was written. */
  sessionId: string
  /** Project the session belongs to. */
  project: string
  /** `1` if this was a new session, `0` if it replaced an existing row. */
  sessionsInserted: number
  /** `1` if an existing session was updated, `0` if it was new. */
  sessionsUpdated: number
}

/** A session enriched with its tools and skills. */
export interface SessionDetail extends SessionRow {
  /** Tool usage records for this session. */
  tools: SessionToolRow[]
  /** Skill invocation records for this session. */
  skills: SessionSkillRow[]
}

// ------------------------------------------------------------------
// 2. Query parameter types
// ------------------------------------------------------------------

/** Parameters for the heatmap query. */
export interface HeatmapParams {
  /** Start of the date range (inclusive), `YYYY-MM-DD`. */
  from: string
  /** End of the date range (inclusive), `YYYY-MM-DD`. */
  to: string
  /** Aggregation metric: count of sessions, turns, or total tokens. */
  metric: 'sessions' | 'tokens' | 'turns'
  /** Optional project filter. */
  project?: string
}

/** A single data point in a heatmap response. */
export interface HeatmapPoint {
  /** Calendar day, `YYYY-MM-DD`. */
  date: string
  /** Aggregated value for the day (count or sum, depending on metric). */
  value: number
}

/** Parameters for the events (session list) query. */
export interface EventsParams {
  /** Start of the date range (inclusive), `YYYY-MM-DD`. */
  from?: string
  /** End of the date range (inclusive), `YYYY-MM-DD`. */
  to?: string
  /** Optional project filter. */
  project?: string
  /** Maximum number of distinct days per page. Defaults to `30`. */
  limit?: number
  /** Pagination cursor — the `nextCursor` value from a previous response. */
  cursor?: string
}

/** Result shape for the events query. */
export interface EventsResult {
  /** Session events grouped by calendar day (newest first). */
  days: DayEvents[]
  /** Opaque cursor to pass as `cursor` in the next request, or `undefined` if no more pages. */
  nextCursor?: string
}

/** Events grouped by calendar day. */
export interface DayEvents {
  /** Calendar day, `YYYY-MM-DD`. */
  day: string
  /** Sessions grouped by project within this day. */
  projectGroups: ProjectGroup[]
  /** Total sessions across all projects in this day. */
  session_count: number
  /** Total turns across all projects in this day. */
  turn_count: number
  /** Total tokens across all projects in this day. */
  token_count: number
}

/** A project group within a day, containing sessions and aggregates. */
export interface ProjectGroup {
  /** Display-friendly project path. */
  project: string
  /** Sessions in this project for the day (newest first). */
  sessions: SessionRow[]
  /** Number of sessions in this group. */
  session_count: number
  /** Total turns across sessions in this group. */
  turn_count: number
  /** Total tokens across sessions in this group. */
  token_count: number
  /** Total tool invocations across sessions in this group. */
  tool_count: number
  /** Total skill invocations across sessions in this group. */
  skill_count: number
  /** Distinct agents that produced sessions in this group, in stable display order. */
  agents: string[]
}

// ------------------------------------------------------------------
// 3. Schema constants
// ------------------------------------------------------------------

/** Current schema version. Increment this when adding migrations. */
export const CURRENT_SCHEMA_VERSION = 3

/** Complete SQL to create all tables and indexes. */
export const SCHEMA_SQL = `
CREATE TABLE sessions (
  session_id        TEXT PRIMARY KEY,
  project           TEXT NOT NULL,
  agent_name        TEXT,
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
  3: 'ALTER TABLE sessions ADD COLUMN agent_name TEXT;',
}
