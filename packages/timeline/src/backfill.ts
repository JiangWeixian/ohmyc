// ============================================================
// @ohmyc/timeline — Batch Backfill
// Scans the Claude Code projects directory for all JSONL
// transcripts and ingests any sessions not yet in the database.
// ============================================================

import { readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ingestSession } from './ingest.js'

import type { SqliteDatabase } from './writer.js'

/** Options for {@link backfillAll}. */
export interface BackfillOptions {
  /** Custom Claude Code projects directory. Defaults to `~/.claude/projects` or `$AGENT_HOME/projects`. */
  claudeProjectsDir?: string
  /** Progress callback invoked after each transcript is processed. */
  onProgress?: (indexed: number, total: number) => void
}

/** Result of a batch backfill operation. */
export interface BackfillResult {
  /** Number of new sessions successfully indexed. */
  indexed: number
  /** Number of transcripts skipped (already in DB). */
  skipped: number
  /** Number of transcripts that failed to parse. */
  errors: number
}

/**
 * Returns the default Claude Code projects directory (`$AGENT_HOME/projects` or `~/.claude/projects`).
 *
 * @returns Absolute path to the projects directory.
 */
export function getDefaultProjectsDir(): string {
  const agentHome = process.env.AGENT_HOME
  if (agentHome) {
    return path.join(agentHome, 'projects')
  }
  return path.join(os.homedir(), '.claude', 'projects')
}

function findJsonlFiles(dir: string): string[] {
  const results: string[] = []

  try {
    const entries = readdirSync(dir, { withFileTypes: true })
    for (const entry of entries) {
      const fullPath = path.join(dir, entry.name)
      if (entry.isDirectory()) {
        results.push(...findJsonlFiles(fullPath))
      } else if (entry.isFile() && entry.name.endsWith('.jsonl')) {
        results.push(fullPath)
      }
    }
  } catch {
    // Directory doesn't exist or isn't readable — return empty
  }

  return results
}

/**
 * Recursively finds all `.jsonl` files under the Claude Code projects directory
 * and ingests each one, skipping sessions that already exist in the database.
 * Records the completion timestamp in the `meta` table.
 *
 * @param db - Database handle conforming to {@link SqliteDatabase}.
 * @param options - Custom projects directory and progress callback.
 * @returns Counts of indexed, skipped, and errored transcripts.
 */
export function backfillAll(
  db: SqliteDatabase,
  options?: BackfillOptions,
): BackfillResult {
  const projectsDir = options?.claudeProjectsDir ?? getDefaultProjectsDir()

  const transcriptPaths = findJsonlFiles(projectsDir)

  const existingSessionIds = new Set(
    (db.prepare('SELECT session_id FROM sessions').all() as { session_id: string }[])
      .map(row => row.session_id),
  )

  let indexed = 0
  let skipped = 0
  let errors = 0
  const total = transcriptPaths.length

  for (const transcriptPath of transcriptPaths) {
    const sessionId = path.basename(transcriptPath, '.jsonl')

    if (existingSessionIds.has(sessionId)) {
      skipped++
      options?.onProgress?.(indexed + skipped, total)
      continue
    }

    try {
      const result = ingestSession(db, sessionId, transcriptPath)
      if (result.sessionsInserted > 0 || result.sessionsUpdated > 0) {
        indexed++
      } else {
        skipped++
      }
    } catch {
      errors++
    }

    options?.onProgress?.(indexed + skipped, total)
  }

  // Record when this backfill completed so the UI can show last-sync status
  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_full_backfill_at', ?)")
    .run(String(Date.now()))

  return { indexed, skipped, errors }
}
