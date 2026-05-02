// packages/timeline/src/writer.ts
import type { ParsedSessionData } from './ingest.js'

/**
 * Minimal SQLite-like interface that works with both better-sqlite3 and bun:sqlite
 */
export interface SqliteDatabase {
  prepare: (sql: string) => {
    run: (...params: unknown[]) => void
    get: (...params: unknown[]) => unknown
    all: (...params: unknown[]) => unknown[]
  }
  exec: (sql: string) => void
  transaction: (fn: () => void) => () => void
}

export interface Writer {
  writeSession: (data: ParsedSessionData) => IngestResult
}

export interface IngestResult {
  sessionId: string
  project: string
  sessionsInserted: number
  sessionsUpdated: number
}

export function createWriter(db: SqliteDatabase): Writer {
  return {
    writeSession(data: ParsedSessionData): IngestResult {
      const existingRow = db
        .prepare('SELECT 1 FROM sessions WHERE session_id = ?')
        .get(data.sessionId) as { 1: number } | undefined

      const sessionsInserted = existingRow ? 0 : 1
      const sessionsUpdated = existingRow ? 1 : 0
      const ingestedAt = Date.now()

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
