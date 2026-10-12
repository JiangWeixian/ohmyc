// Pure formatting/derivation helpers for the Quota surfaces (page + menubar
// popover). Everything here is unit-tested and free of React.

import type {
  QuotaProviderId,
  UsageMeter,
  UsageWindow,
} from '@/hooks/use-quota'

interface ProviderMeta {
  name: string
  /** Official CLI command used in recovery hints on state cards. */
  cli: string
}

export const PROVIDER_META: Record<QuotaProviderId, ProviderMeta> = {
  claude: { name: 'Claude', cli: 'claude' },
  codex: { name: 'Codex', cli: 'codex' },
  cursor: { name: 'Cursor', cli: 'cursor-agent' },
  grok: { name: 'Grok', cli: 'grok' },
  gemini: { name: 'Gemini', cli: 'gemini' },
  kimi: { name: 'Kimi', cli: 'kimi' },
  opencodeGo: { name: 'OpenCode Go', cli: 'opencode' },
  glm: { name: 'GLM', cli: 'opencode auth login' },
}

/**
 * Uppercase window tag derived from data — `windowSeconds` first, `kind` as
 * the fallback for windows without a fixed length (e.g. Kimi's monthly
 * pools). Never from provider identity: providers return whatever windows
 * they actually have.
 */
export function windowTag(window: UsageWindow): string {
  const seconds = window.windowSeconds
  if (seconds != null) {
    if (seconds === 18_000) {
      return '5H'
    }
    if (seconds === 604_800) {
      return 'WEEK'
    }
    if (seconds === 86_400) {
      return '1D'
    }
    if (seconds >= 2_500_000) {
      return 'MO'
    }
    return 'OTHER'
  }
  switch (window.kind) {
    case 'session': { return '5H'
    }
    case 'weekly': { return 'WEEK'
    }
    case 'monthly': { return 'MO'
    }
    case 'daily': { return '1D'
    }
    default: { return 'OTHER'
    }
  }
}

/** Two-character tag for the menubar popover rows. */
export function windowTagShort(window: UsageWindow): string {
  const tag = windowTag(window)
  if (tag === 'WEEK') {
    return 'WK'
  }
  if (tag === 'OTHER') {
    return 'OT'
  }
  return tag
}

/** Heat ladder bucket for a used percentage: <25 low … ≥75 critical. */
export function heatBucket(usedPercent: number): 1 | 2 | 3 | 4 {
  if (usedPercent < 25) {
    return 1
  }
  if (usedPercent < 50) {
    return 2
  }
  if (usedPercent < 75) {
    return 3
  }
  return 4
}

/**
 * Fill classes per heat bucket. Static strings (not `heat-l${n}` templates):
 * eslint-plugin-tailwindcss crashes on interpolated class names, and static
 * strings keep the classes visible to anyone grepping for them.
 */
export const HEAT_FILL_CLASS: Record<1 | 2 | 3 | 4, string> = {
  1: 'heat-l1',
  2: 'heat-l2',
  3: 'heat-l3',
  4: 'heat-l4',
}

function minutesUntil(resetsAt: string, nowMs: number): number | null {
  const target = Date.parse(resetsAt)
  if (Number.isNaN(target)) {
    return null
  }
  return Math.max(0, (target - nowMs) / 60_000)
}

/** Page countdown: `41m` / `2h 12m` / `4d 2h` (two-part precision). */
export function formatCountdown(resetsAt: string, nowMs: number): string | null {
  const min = minutesUntil(resetsAt, nowMs)
  if (min == null) {
    return null
  }
  if (min < 60) {
    return `${Math.round(min)}m`
  }
  if (min < 1440) {
    const h = Math.floor(min / 60)
    const m = Math.round(min % 60)
    return m ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(min / 1440)
  const h = Math.floor((min % 1440) / 60)
  return h ? `${d}d ${h}h` : `${d}d`
}

/** Popover countdown: `41m` / `2h` / `4d` (single-part precision). */
export function formatCountdownShort(resetsAt: string, nowMs: number): string | null {
  const min = minutesUntil(resetsAt, nowMs)
  if (min == null) {
    return null
  }
  if (min < 60) {
    return `${Math.round(min)}m`
  }
  if (min < 1440) {
    return `${Math.floor(min / 60)}h`
  }
  return `${Math.floor(min / 1440)}d`
}

/**
 * Fraction of the window that has elapsed in time, 0–1. Only defined when the
 * window has both a fixed length and a reset instant — the pace tick renders
 * only then.
 */
export function paceElapsed(window: UsageWindow, nowMs: number): number | null {
  if (window.windowSeconds == null || !window.resetsAt) {
    return null
  }
  const target = Date.parse(window.resetsAt)
  if (Number.isNaN(target) || window.windowSeconds <= 0) {
    return null
  }
  const remainingSeconds = (target - nowMs) / 1000
  return Math.min(1, Math.max(0, 1 - remainingSeconds / window.windowSeconds))
}

/**
 * Usage minus time-elapsed, in percentage points. Positive = burning ahead of
 * the pace tick. Null when the pace tick itself is undefined or the used
 * percent is unknown.
 */
export function paceDelta(window: UsageWindow, nowMs: number): number | null {
  const elapsed = paceElapsed(window, nowMs)
  if (elapsed == null || window.usedPercent == null) {
    return null
  }
  return window.usedPercent - elapsed * 100
}

/** Pace note shows only at ≥5 points ahead of the tick. */
export const PACE_AHEAD_THRESHOLD = 5

/** Meter values: dollars with currency symbol, percent with %, count raw. */
export function formatMeterValue(meter: UsageMeter): string {
  switch (meter.kind) {
    case 'dollars': {
      const symbol = meter.currency === 'CNY' ? '¥' : (meter.currency == null || meter.currency === 'USD' ? '$' : `${meter.currency} `)
      return `${symbol}${meter.value.toFixed(2)}`
    }
    case 'percent': { return `${Math.round(meter.value)}%`
    }
    case 'count': { return `${meter.value}`
    }
  }
}

/** `updated N min ago` header meta. */
export function formatUpdatedAgo(fetchedAtMs: number, nowMs: number): string {
  const min = Math.max(0, (nowMs - fetchedAtMs) / 60_000)
  if (min < 1) {
    return 'just now'
  }
  const rounded = Math.floor(min)
  return rounded === 1 ? '1 min ago' : `${rounded} min ago`
}

/** Popover header variant: `2m ago`. */
export function formatUpdatedAgoShort(fetchedAtMs: number, nowMs: number): string {
  const min = Math.max(0, (nowMs - fetchedAtMs) / 60_000)
  if (min < 1) {
    return 'now'
  }
  return `${Math.floor(min)}m ago`
}

/** Newest fetchedAt across snapshots, as epoch ms. Null when no data. */
export function latestFetchedAt(snapshots: { fetchedAt: string }[]): number | null {
  let latest: number | null = null
  for (const snapshot of snapshots) {
    const ms = Date.parse(snapshot.fetchedAt)
    if (!Number.isNaN(ms) && (latest == null || ms > latest)) {
      latest = ms
    }
  }
  return latest
}
