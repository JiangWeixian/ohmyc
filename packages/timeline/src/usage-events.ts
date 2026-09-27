import { collectClaudeUsage } from './claude-usage.js'

export interface UsageEvent {
  eventKey: string
  occurredAt: number
  tokensInput: number
  tokensOutput: number
  tokensCached: number
  model: string | null
}
export interface UsageDetails {
  events: UsageEvent[]
  status: 'complete' | 'partial' | 'unavailable'
}
const record = (value: unknown): Record<string, any> | undefined => value && typeof value === 'object' && !Array.isArray(value) ? value as Record<string, any> : undefined
const count = (n: unknown): n is number => typeof n === 'number' && Number.isSafeInteger(n) && n >= 0

/** Reparse a full transcript; event identity is independent of ingestion time. */
export function parseUsageEvents(content: string, source: string): UsageDetails {
  if (!['codex', 'claude', 'claude-cli'].includes(source)) {
    return { events: [], status: 'unavailable' }
  }
  let partial = false
  let model: string | null = null
  let offset = 0
  let previous = { input: 0, output: 0, cached: 0 }
  const events = new Map<string, UsageEvent>()
  for (const line of content.split('\n')) {
    const position = offset
    offset += Buffer.byteLength(line, 'utf8') + 1
    if (!line.trim()) {
      continue
    }
    let row: Record<string, any> | undefined
    try {
      row = record(JSON.parse(line))
    } catch {
      partial = true
      continue
    }
    if (!row) {
      continue
    }
    const payload = record(row.payload)
    if (row.type === 'turn_context' && typeof payload?.model === 'string') {
      model = payload.model
    }
    const occurredAt = typeof row.timestamp === 'string' ? Date.parse(row.timestamp) : Number.NaN
    if (source === 'codex') {
      const info = row.type === 'event_msg' && payload?.type === 'token_count' ? record(payload.info) : undefined
      const usage = record(info?.total_token_usage) ?? (info && 'input_tokens' in info ? info : undefined)
        ?? (row.type === 'turn.completed' ? record(row.usage) : undefined)
      if (!usage) {
        continue
      }
      const input = usage.input_tokens
      const output = usage.output_tokens
      const cached = usage.cached_input_tokens ?? 0
      if (![input, output, cached].every(count) || cached > input) {
        partial = true
        continue
      }
      const delta = { input: input - previous.input, output: output - previous.output, cached: cached - previous.cached }
      previous = { input, output, cached }
      if (!Number.isFinite(occurredAt) || delta.input < 0 || delta.output < 0 || delta.cached < 0 || delta.cached > delta.input) {
        partial = true
        continue
      }
      if (delta.input + delta.output === 0) {
        continue
      }
      events.set(`line:${position}`, {
        eventKey: `line:${position}`,
        occurredAt,
        tokensInput: delta.input - delta.cached,
        tokensOutput: delta.output,
        tokensCached: delta.cached,
        model,
      })
    } else {
      const message = record(row.message)
      if (row.type !== 'assistant' || message?.role !== 'assistant' || !record(message.usage)) {
        continue
      }
      const key = typeof message.id === 'string' && message.id ? `message:${message.id}` : `line:${position}`
      if (!Number.isFinite(occurredAt)) {
        partial = true
        events.delete(key)
        continue
      }
      const usage = collectClaudeUsage([row])
      events.set(key, { eventKey: key, occurredAt, ...usage, model: typeof message.model === 'string' ? message.model : null })
    }
  }
  return { events: [...events.values()], status: partial ? 'partial' : (events.size > 0 ? 'complete' : 'unavailable') }
}
