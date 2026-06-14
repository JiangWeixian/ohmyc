// ============================================================
// @ohmyc/timeline — Public API
// ============================================================

// ------------------------------------------------------------------
// Database
// ------------------------------------------------------------------

export {
  openDatabase,
  closeDatabase,
  getDefaultDbPath,
} from './db.js'

export type { OpenDatabaseOptions as DatabaseOptions } from './db.js'
export { migrate } from './migrate.js'
export type { MigrateOptions } from './migrate.js'

// ------------------------------------------------------------------
// Ingest
// ------------------------------------------------------------------

export {
  ingestSession,
  parseTranscript,
  upsertSessionData,
} from './ingest.js'

export type {
  IngestResult,
  TranscriptParseOptions,
} from './ingest.js'

// ------------------------------------------------------------------
// Writer
// ------------------------------------------------------------------

export { createWriter } from './writer.js'
export type { SqliteDatabase, SqliteStatement, Writer } from './writer.js'
export type { NodeSqliteDatabase } from './node-sqlite.js'

// ------------------------------------------------------------------
// Backfill
// ------------------------------------------------------------------

export {
  backfillAll,
  getDefaultProjectsDir,
} from './backfill.js'

export type {
  BackfillOptions,
  BackfillResult,
} from './backfill.js'

// ------------------------------------------------------------------
// Query
// ------------------------------------------------------------------

export {
  getHeatmap,
  getEvents,
  getSession,
  getProjects,
  getYears,
  getStatus,
} from './query.js'

// ------------------------------------------------------------------
// Schema — types and constants
// ------------------------------------------------------------------

export type {
  SessionRow,
  SessionToolRow,
  SessionSkillRow,
  MetaRow,
  SessionDetail,
  ParsedSessionData,
  HeatmapParams,
  HeatmapPoint,
  EventsParams,
  EventsResult,
  DayEvents,
  ProjectGroup,
} from './schema.js'

export {
  CURRENT_SCHEMA_VERSION,
  SCHEMA_SQL,
  MIGRATIONS,
} from './schema.js'
