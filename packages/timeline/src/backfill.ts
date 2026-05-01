import { readdirSync } from 'node:fs'
import os from 'node:os'
import path from 'node:path'

import { ingestSession } from './ingest.js'

import type Database from 'better-sqlite3'

export interface BackfillOptions {
  claudeProjectsDir?: string
  onProgress?: (indexed: number, total: number) => void
}

export interface BackfillResult {
  indexed: number
  skipped: number
  errors: number
}

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

export function backfillAll(
  db: Database.Database,
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

  db.prepare("INSERT OR REPLACE INTO meta (key, value) VALUES ('last_full_backfill_at', ?)")
    .run(String(Date.now()))

  return { indexed, skipped, errors }
}
