import { totalSessionTokens } from './tokens.js'

import type { UsageDetails } from './usage-events.js'
import type { SqliteDatabase } from './writer.js'

interface UsageSession {
  session_id: string
  agent_name: string | null
  tokens_input: number
  tokens_output: number
  tokens_cached: number
}

/** Called inside the session writer transaction, so a failed event never leaves a partial session update. */
export function storeUsageDetails(db: SqliteDatabase, session: UsageSession, details: UsageDetails, ingestedAt: number): void {
  const insertUsage = db.prepare(`INSERT INTO token_usage_events VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
    ON CONFLICT(source, session_id, event_key) DO UPDATE SET
    occurred_at=excluded.occurred_at, tokens_input=excluded.tokens_input,
    tokens_output=excluded.tokens_output, tokens_cached=excluded.tokens_cached,
    model=excluded.model, ingested_at=excluded.ingested_at`)
  const clearUsage = db.prepare('DELETE FROM token_usage_events WHERE source=? AND session_id=?')
  const coverage = db.prepare(`INSERT INTO usage_event_coverage VALUES (?, ?, ?, ?, ?)
    ON CONFLICT(source, session_id) DO UPDATE SET status=excluded.status,
    reconciled_total=excluded.reconciled_total, updated_at=excluded.updated_at`)

  const source = session.agent_name ?? 'unknown'
  const total = totalSessionTokens(session)
  const eventTotal = details.events.reduce((sum, e) => sum + e.tokensInput + e.tokensOutput + e.tokensCached, 0)
  const status = details.status === 'complete' && total !== eventTotal ? 'partial' : details.status
  if (status === 'complete') {
    clearUsage.run(source, session.session_id)
  }
  for (const e of details.events) {
    if (!Number.isSafeInteger(e.occurredAt) || ![e.tokensInput, e.tokensOutput, e.tokensCached].every(n => Number.isSafeInteger(n) && n >= 0)) {
      throw new Error('Invalid usage event')
    }
    insertUsage.run(source, session.session_id, e.eventKey, e.occurredAt, e.tokensInput, e.tokensOutput, e.tokensCached, e.model, ingestedAt)
  }
  coverage.run(source, session.session_id, status, total, ingestedAt)
}

/** Historical import only touches the new tables; reread totals under the write lock. */
export function backfillUsageDetails(db: SqliteDatabase, sessionId: string, details: UsageDetails): void {
  db.transaction(() => {
    const session = db.prepare('SELECT * FROM sessions WHERE session_id=?').get(sessionId) as UsageSession | undefined
    if (!session) {
      throw new Error('Session no longer exists')
    }
    storeUsageDetails(db, session, details, Date.now())
  })()
}
