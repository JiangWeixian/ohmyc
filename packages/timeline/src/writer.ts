// ============================================================
// @ohmyc/timeline — Session Writer
// Prepares parameterized SQL statements upfront and provides a
// transactional write method for upserting session data.
// ============================================================

import type { IngestResult, ParsedSessionData } from './schema.js'

export type { IngestResult } from './schema.js'

/**
 * Minimal SQLite-like interface that works with both better-sqlite3 and bun:sqlite.
 * Abstracting over the driver lets the same writer logic run in Node (better-sqlite3)
 * and Bun (bun:sqlite) without changes.
 */
export interface SqliteDatabase {
  /** Compiles a SQL string into a reusable prepared statement. */
  prepare: (sql: string) => SqliteStatement
  /** Executes raw SQL (no prepared statement, no return value). */
  exec: (sql: string) => void
  /** Wraps a function in a database transaction. */
  transaction: (fn: () => void) => () => void
}

/** Prepared statement handle produced by {@link SqliteDatabase.prepare}. */
export interface SqliteStatement {
  /** Runs the statement with the given parameters (write operations). */
  run: (...params: any[]) => void
  /** Returns the first matching row, or `undefined`. */
  get: (...params: any[]) => unknown
  /** Returns all matching rows as an array. */
  all: (...params: any[]) => unknown[]
}

/** Writes parsed session data (plus tools and skills) into SQLite in a single transaction. */
export interface Writer {
  /** Upserts a complete session record and its associated tools/skills. */
  writeSession: (data: ParsedSessionData) => IngestResult
}

/**
 * Creates a {@link Writer} bound to the given database.
 * All SQL statements are prepared once at creation time for reuse across calls.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @returns A {@link Writer} instance.
 */
export function createWriter(db: SqliteDatabase): Writer {
  const checkExisting = db.prepare('SELECT 1 FROM sessions WHERE session_id = ?')
  const upsertSession = db.prepare(`
    INSERT OR REPLACE INTO sessions (
      session_id, project, agent_name, started_at, ended_at, duration_ms,
      turns, tokens_input, tokens_output, tokens_cached,
      summary, summary_source, transcript_path, last_offset, ingested_at, model
    ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
  `)
  const deleteTools = db.prepare('DELETE FROM session_tools WHERE session_id = ?')
  const insertTool = db.prepare('INSERT OR REPLACE INTO session_tools (session_id, tool_name, call_count) VALUES (?, ?, ?)')
  const deleteSkills = db.prepare('DELETE FROM session_skills WHERE session_id = ?')
  const insertSkill = db.prepare('INSERT OR REPLACE INTO session_skills (session_id, skill_name) VALUES (?, ?)')

  return {
    writeSession(data: ParsedSessionData): IngestResult {
      const existingRow = checkExisting.get(data.sessionId) as { 1: number } | undefined

      const sessionsInserted = existingRow ? 0 : 1
      const sessionsUpdated = existingRow ? 1 : 0
      const ingestedAt = Date.now()

      // NOTE: Delete-then-reinsert tools/skills rather than diffing — simpler and
      // correct because the row count is small and we own the entire session record.
      const transaction = db.transaction(() => {
        upsertSession.run(
          data.sessionId,
          data.project,
          data.agentName,
          data.startedAt,
          data.endedAt,
          data.durationMs,
          data.turns,
          data.tokensInput,
          data.tokensOutput,
          data.tokensCached,
          data.summary,
          data.summarySource,
          data.transcriptPath,
          data.fileSize,
          ingestedAt,
          data.model,
        )

        deleteTools.run(data.sessionId)
        for (const tool of data.tools) {
          insertTool.run(data.sessionId, tool.toolName, tool.callCount)
        }

        deleteSkills.run(data.sessionId)
        for (const skillName of data.skills) {
          insertSkill.run(data.sessionId, skillName)
        }
      })

      transaction()

      return {
        sessionId: data.sessionId,
        project: data.project,
        sessionsInserted,
        sessionsUpdated,
      }
    },
  }
}
