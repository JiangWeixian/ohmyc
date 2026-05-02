// ============================================================
// @claudeui/timeline — Public API
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

// ------------------------------------------------------------------
// Ingest
// ------------------------------------------------------------------

export { ingestSession } from './ingest.js'

export type { IngestResult } from './ingest.js'

// ------------------------------------------------------------------
// Writer
// ------------------------------------------------------------------

export { createWriter } from './writer.js'
export type { SqliteDatabase, SqliteStatement, Writer, IngestResult as WriterIngestResult } from './writer.js'

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
