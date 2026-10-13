import { TOKEN_TOTAL_SQL } from './tokens.js'

import type { SqliteDatabase } from './writer.js'

export type UsageMode = 'events' | 'session'
export function usageMode(db: SqliteDatabase): UsageMode {
  const row = db.prepare("SELECT value FROM meta WHERE key='usage_mode'").get() as { value: string } | undefined
  return row?.value === 'events' ? 'events' : 'session'
}
export function setUsageMode(db: SqliteDatabase, mode: UsageMode): void {
  if (!['session', 'events'].includes(mode)) {
    throw new Error('Invalid usage mode')
  }
  if (mode === 'events') {
    db.prepare('SELECT 1 FROM token_usage_events LIMIT 1').get()
  }
  db.prepare("INSERT INTO meta(key,value) VALUES('usage_mode',?) ON CONFLICT(key) DO UPDATE SET value=excluded.value").run(mode)
}
export function usageCoverage(db: SqliteDatabase): { usageMode: UsageMode; usageIncomplete: number } {
  const mode = 'events'
  if (!hasTable(db, 'usage_event_coverage')) {
    const row = db.prepare('SELECT COUNT(*) AS n FROM sessions').get() as { n: number }
    return { usageMode: mode, usageIncomplete: row.n }
  }
  const row = db.prepare(`SELECT COUNT(*) AS n FROM sessions s WHERE NOT EXISTS (
    SELECT 1 FROM usage_event_coverage c WHERE c.session_id=s.session_id
    AND c.source=COALESCE(s.agent_name,'unknown') AND c.status='complete'
    AND c.reconciled_total=(${TOKEN_TOTAL_SQL}))`).get() as { n: number }
  return { usageMode: mode, usageIncomplete: row.n }
}
export function localDateMs(date: string): number {
  const [year, month, day] = date.split('-').map(Number)
  return new Date(year, month - 1, day).getTime()
}

export function hasTable(db: SqliteDatabase, table: string): boolean {
  return !!db.prepare("SELECT 1 FROM sqlite_master WHERE type='table' AND name=?").get(table)
}

export const LEGACY_ONLY_SQL = "NOT EXISTS (SELECT 1 FROM token_usage_events e WHERE e.session_id=s.session_id AND e.source=COALESCE(s.agent_name,'unknown'))"

export function tokenTotal(db: SqliteDatabase, from: number, to: number, legacyFrom = from, legacyTo = to): number {
  const hasEvents = hasTable(db, 'token_usage_events')
  const legacyOnly = hasEvents ? LEGACY_ONLY_SQL : '1'
  const legacySql = `SELECT COALESCE(SUM(${TOKEN_TOTAL_SQL}),0) AS value FROM sessions s
    WHERE s.started_at>=? AND s.started_at<? AND ${legacyOnly}`
  const sql = hasEvents
    ? `SELECT SUM(value) AS value FROM (
        SELECT COALESCE(SUM(e.tokens_input+e.tokens_output+e.tokens_cached),0) AS value
        FROM token_usage_events e JOIN sessions s ON s.session_id=e.session_id AND COALESCE(s.agent_name,'unknown')=e.source
        WHERE e.occurred_at>=? AND e.occurred_at<? UNION ALL ${legacySql})`
    : legacySql
  const args = hasEvents ? [from, to, legacyFrom, legacyTo] : [legacyFrom, legacyTo]
  const row = db.prepare(sql).get(...args) as { value: number }
  return row.value
}
