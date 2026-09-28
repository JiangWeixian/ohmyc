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
  const mode = usageMode(db)
  if (mode === 'session') {
    return { usageMode: mode, usageIncomplete: 0 }
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
