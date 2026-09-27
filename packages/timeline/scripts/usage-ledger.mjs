#!/usr/bin/env node
// Build @ohmyc/timeline first. This maintenance tool never restores an old DB.
import { existsSync, readFileSync, mkdirSync } from 'node:fs'
import { dirname, join, resolve } from 'node:path'
import { spawnSync } from 'node:child_process'
import { DatabaseSync } from 'node:sqlite'
import { openDatabase, closeDatabase, parseUsageEvents, backfillUsageDetails, setUsageMode, usageCoverage } from '../dist/index.js'

const [command, file, extra] = process.argv.slice(2)
if (!['backfill', 'session', 'events', 'status'].includes(command) || !file || !existsSync(file)) {
  throw new Error('Usage: node usage-ledger.mjs <backfill|session|events|status> <existing timeline.db> [opencode.db]')
}
const dbPath = resolve(file)
if (command === 'backfill') {
  const folder = join(dirname(dbPath), 'backups', 'usage-ledger-' + new Date().toISOString().replaceAll(/[:.]/g, '-'))
  mkdirSync(folder, { recursive: true })
  const backup = join(folder, 'timeline.db')
  // SQLite backup API includes committed WAL contents and supports a live writer.
  const result = spawnSync('python3', ['-c', `import sqlite3,sys
a=sqlite3.connect("file:"+sys.argv[1]+"?mode=ro",uri=True)
b=sqlite3.connect(sys.argv[2])
a.backup(b)
assert b.execute("pragma integrity_check").fetchone()[0]=="ok"
b.close()
a.close()`, dbPath, backup], { encoding: 'utf8' })
  if (result.status !== 0) throw new Error(result.stderr || 'Backup failed; no migration attempted')
  console.log(JSON.stringify({ backup }))
}
const db = command === 'backfill' ? openDatabase({ dbPath }) : (() => {
  // Status/rollback should also work before v5 has ever been installed.
  const native = new DatabaseSync(dbPath, { readOnly: command === 'status' })
  return { prepare: sql => native.prepare(sql), close: () => native.close() }
})()
let sourceDb
try {
  if (command === 'backfill') {
    if (extra) sourceDb = new DatabaseSync(resolve(extra), { readOnly: true })
    const sessions = db.prepare('SELECT session_id, agent_name, transcript_path FROM sessions').all()
    let recovered = 0
    for (const session of sessions) {
      let details = { events: [], status: 'unavailable' }
      if (['claude', 'claude-cli', 'codex'].includes(session.agent_name) && existsSync(session.transcript_path)) {
        details = parseUsageEvents(readFileSync(session.transcript_path, 'utf8'), session.agent_name)
      } else if (session.agent_name === 'opencode' && sourceDb) {
        const messages = sourceDb.prepare(`WITH RECURSIVE tree(id) AS (
          SELECT id FROM session WHERE id=?
          UNION SELECT s.id FROM session s JOIN tree t ON s.parent_id=t.id
        ) SELECT m.id,m.session_id,m.time_created,m.data FROM message m JOIN tree t ON m.session_id=t.id`).all(session.session_id)
        let partial = false
        for (const row of messages) {
          let data
          try { data = JSON.parse(row.data) } catch { partial = true; continue }
          if (data.role !== 'assistant') continue
          const time = data.time?.created ?? row.time_created
          const tokens = data.tokens
          if (!tokens || !Number.isSafeInteger(time)) { partial = true; continue }
          const input = tokens.input ?? 0
          const output = (tokens.output ?? 0) + (tokens.reasoning ?? 0)
          const cached = (tokens.cache?.read ?? 0) + (tokens.cache?.write ?? 0)
          if (![input, output, cached].every(n => Number.isSafeInteger(n) && n >= 0)) { partial = true; continue }
          details.events.push({ eventKey: JSON.stringify([row.session_id, row.id]), occurredAt: time,
            tokensInput: input, tokensOutput: output, tokensCached: cached, model: data.modelID ?? null })
        }
        details.status = partial ? 'partial' : details.events.length ? 'complete' : 'unavailable'
      }
      backfillUsageDetails(db, session.session_id, details)
      if (details.events.length) recovered++
    }
    console.log(JSON.stringify({ sessions: sessions.length, recovered }))
  } else if (command !== 'status') {
    setUsageMode(db, command)
  }
  console.log(JSON.stringify(usageCoverage(db)))
  if (db.prepare("SELECT name FROM sqlite_master WHERE name='usage_event_coverage'").get()) {
    console.log(JSON.stringify(db.prepare('SELECT source,status,COUNT(*) AS sessions FROM usage_event_coverage GROUP BY source,status').all()))
  }
} finally {
  sourceDb?.close()
  closeDatabase(db)
}
