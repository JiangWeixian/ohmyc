// Pure formatting/derivation helpers for the Quota surfaces (page + menubar
// popover). Everything here is unit-tested and free of React.

import type {
  QuotaProviderId,
  UsageMeter,
  UsageSnapshot,
  UsageWindow,
} from '@/hooks/use-quota'

interface ProviderMeta {
  name: string
  /** Official CLI command used in recovery hints on state cards. */
  cli: string
  /**
   * Overrides the token-expired hint for providers whose CLI renews tokens
   * on its own (lazy refresh) — there the state is transient and the user
   * doesn't need to act, so the "open the CLI" nudge would be misleading.
   */
  expiredHint?: string
}

export const PROVIDER_META: Record<QuotaProviderId, ProviderMeta> = {
  claude: { name: 'Claude', cli: 'claude' },
  codex: { name: 'Codex', cli: 'codex' },
  cursor: { name: 'Cursor', cli: 'cursor-agent' },
  grok: { name: 'Grok', cli: 'grok' },
  gemini: { name: 'Gemini', cli: 'gemini', expiredHint: 'Access tokens renew whenever the gemini CLI is used — quota returns automatically on the next poll.' },
  kimi: { name: 'Kimi', cli: 'kimi', expiredHint: 'Access tokens live ~15 min and the kimi CLI renews them on use — quota returns automatically on the next poll.' },
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
  // Round to whole minutes before splitting units — otherwise a remainder
  // like 59.6m renders as the absurd "1h 60m".
  const total = Math.max(0, Math.round(min))
  if (total < 60) {
    return `${total}m`
  }
  if (total < 1440) {
    const h = Math.floor(total / 60)
    const m = total % 60
    return m ? `${h}h ${m}m` : `${h}h`
  }
  const d = Math.floor(total / 1440)
  const h = Math.floor((total % 1440) / 60)
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
  if (min < 60) {
    const rounded = Math.floor(min)
    return rounded === 1 ? '1 min ago' : `${rounded} min ago`
  }
  if (min < 1440) {
    const hours = Math.floor(min / 60)
    return hours === 1 ? '1 hr ago' : `${hours} hr ago`
  }
  const days = Math.floor(min / 1440)
  return days === 1 ? '1 day ago' : `${days} days ago`
}

/** Popover header variant: `2m ago` / `3h ago` / `1d ago`. */
export function formatUpdatedAgoShort(fetchedAtMs: number, nowMs: number): string {
  const min = Math.max(0, (nowMs - fetchedAtMs) / 60_000)
  if (min < 1) {
    return 'now'
  }
  if (min < 60) {
    return `${Math.floor(min)}m ago`
  }
  if (min < 1440) {
    return `${Math.floor(min / 60)}h ago`
  }
  return `${Math.floor(min / 1440)}d ago`
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

/**
 * Cross-provider aggregates (DESIGN.md §Quota pressure band). Per provider,
 * take the max used% across its account-level windows (model-specific windows
 * never aggregate); `avg` is the mean of those maxima, `peak` their max.
 * Providers without any usable window don't participate — an unknown value
 * must not drag the average toward zero. Both are null when nothing has data.
 */
export interface PressureStats {
  /** Mean of per-provider account-window maxima. */
  avg: number | null
  /** Max of per-provider account-window maxima. */
  peak: number | null
  /** Provider + window carrying the peak, for captions. */
  peakProvider: QuotaProviderId | null
  peakWindow: UsageWindow | null
  /** Providers whose per-provider max is ≥ 50%. */
  aboveHalf: number
  /** Providers that contributed to the aggregates. */
  participating: number
}

export function computePressure(snapshots: UsageSnapshot[]): PressureStats {
  let sum = 0
  let participating = 0
  let peak: number | null = null
  let peakProvider: QuotaProviderId | null = null
  let peakWindow: UsageWindow | null = null
  let aboveHalf = 0

  for (const snapshot of snapshots) {
    let max: number | null = null
    let maxWindow: UsageWindow | null = null
    for (const window of snapshot.windows) {
      if (window.model != null || window.usedPercent == null) {
        continue
      }
      if (max == null || window.usedPercent > max) {
        max = window.usedPercent
        maxWindow = window
      }
    }
    if (max == null) {
      continue
    }
    participating += 1
    sum += max
    if (max >= 50) {
      aboveHalf += 1
    }
    if (peak == null || max > peak) {
      peak = max
      peakProvider = snapshot.provider
      peakWindow = maxWindow
    }
  }

  return {
    avg: participating > 0 ? sum / participating : null,
    peak,
    peakProvider,
    peakWindow,
    aboveHalf,
    participating,
  }
}
