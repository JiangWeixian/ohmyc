import {
  describe,
  expect,
  it,
} from 'vitest'

import {
  computePressure,
  formatCountdown,
  formatCountdownShort,
  formatMeterValue,
  formatUpdatedAgo,
  formatUpdatedAgoShort,
  heatBucket,
  latestFetchedAt,
  paceDelta,
  paceElapsed,
  windowTag,
  windowTagShort,
} from '@/components/quota/format'

import type { UsageSnapshot, UsageWindow } from '@/hooks/use-quota'

function windowWith(overrides: Partial<UsageWindow>): UsageWindow {
  return {
    kind: 'other',
    label: 'x',
    usedPercent: null,
    resetsAt: null,
    windowSeconds: null,
    model: null,
    ...overrides,
  }
}

const NOW = Date.UTC(2026, 9, 1, 12, 0, 0)

describe('windowTag', () => {
  it('derives tags from windowSeconds', () => {
    expect(windowTag(windowWith({ windowSeconds: 18_000 }))).toBe('5H')
    expect(windowTag(windowWith({ windowSeconds: 604_800 }))).toBe('WEEK')
    expect(windowTag(windowWith({ windowSeconds: 86_400 }))).toBe('1D')
    expect(windowTag(windowWith({ windowSeconds: 2_592_000 }))).toBe('MO')
    expect(windowTag(windowWith({ windowSeconds: 3600 }))).toBe('OTHER')
  })

  it('falls back to kind when windowSeconds is null', () => {
    expect(windowTag(windowWith({ kind: 'session' }))).toBe('5H')
    expect(windowTag(windowWith({ kind: 'weekly' }))).toBe('WEEK')
    expect(windowTag(windowWith({ kind: 'monthly' }))).toBe('MO')
    expect(windowTag(windowWith({ kind: 'daily' }))).toBe('1D')
    expect(windowTag(windowWith({ kind: 'other' }))).toBe('OTHER')
  })

  it('has a 2-char popover variant', () => {
    expect(windowTagShort(windowWith({ windowSeconds: 18_000 }))).toBe('5H')
    expect(windowTagShort(windowWith({ windowSeconds: 604_800 }))).toBe('WK')
    expect(windowTagShort(windowWith({ kind: 'monthly' }))).toBe('MO')
    expect(windowTagShort(windowWith({ windowSeconds: 3600 }))).toBe('OT')
  })
})

describe('heatBucket', () => {
  it('maps percentages onto the heat ladder', () => {
    expect(heatBucket(0)).toBe(1)
    expect(heatBucket(24)).toBe(1)
    expect(heatBucket(25)).toBe(2)
    expect(heatBucket(49)).toBe(2)
    expect(heatBucket(50)).toBe(3)
    expect(heatBucket(74)).toBe(3)
    expect(heatBucket(75)).toBe(4)
    expect(heatBucket(100)).toBe(4)
  })
})

describe('formatCountdown', () => {
  it('formats minutes, hours, and days', () => {
    const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
    expect(formatCountdown(at(41 * 60_000), NOW)).toBe('41m')
    expect(formatCountdown(at(132 * 60_000), NOW)).toBe('2h 12m')
    expect(formatCountdown(at(4 * 3_600_000), NOW)).toBe('4h')
    expect(formatCountdown(at((5910) * 60_000), NOW)).toBe('4d 2h')
    expect(formatCountdown(at(3 * 86_400_000), NOW)).toBe('3d')
    expect(formatCountdown(at(-60_000), NOW)).toBe('0m')
    expect(formatCountdown('not a date', NOW)).toBeNull()
  })

  it('rounds total minutes before splitting units — never "1h 60m"', () => {
    const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
    // 119.6 minutes used to render as "1h 60m".
    expect(formatCountdown(at(119.6 * 60_000), NOW)).toBe('2h')
    expect(formatCountdown(at(59.6 * 60_000), NOW)).toBe('1h')
    expect(formatCountdown(at(90.4 * 60_000), NOW)).toBe('1h 30m')
  })
})

describe('formatCountdownShort', () => {
  it('keeps a single unit', () => {
    const at = (offsetMs: number) => new Date(NOW + offsetMs).toISOString()
    expect(formatCountdownShort(at(41 * 60_000), NOW)).toBe('41m')
    expect(formatCountdownShort(at(132 * 60_000), NOW)).toBe('2h')
    expect(formatCountdownShort(at(5910 * 60_000), NOW)).toBe('4d')
  })
})

describe('pace', () => {
  it('computes elapsed fraction from windowSeconds and resetsAt', () => {
    const window = windowWith({
      windowSeconds: 18_000,
      resetsAt: new Date(NOW + 3_600_000).toISOString(), // 1h left of 5h
    })
    expect(paceElapsed(window, NOW)).toBeCloseTo(0.8, 5)
  })

  it('is null without windowSeconds or resetsAt', () => {
    expect(paceElapsed(windowWith({ windowSeconds: 18_000 }), NOW)).toBeNull()
    expect(paceElapsed(windowWith({ resetsAt: new Date(NOW).toISOString() }), NOW)).toBeNull()
  })

  it('clamps into 0..1 when the reset instant lies outside the window', () => {
    const future = windowWith({
      windowSeconds: 18_000,
      resetsAt: new Date(NOW + 10 * 3_600_000).toISOString(),
    })
    expect(paceElapsed(future, NOW)).toBe(0)
  })

  it('paceDelta compares used% against elapsed time', () => {
    const window = windowWith({
      windowSeconds: 18_000,
      resetsAt: new Date(NOW + 3_600_000).toISOString(),
      usedPercent: 92,
    })
    expect(paceDelta(window, NOW)).toBeCloseTo(12, 5)
    expect(paceDelta(windowWith({ ...window, usedPercent: null }), NOW)).toBeNull()
  })
})

describe('formatMeterValue', () => {
  it('formats dollars by currency, percent, and count', () => {
    expect(formatMeterValue({ label: 'x', value: 766.76, kind: 'dollars', currency: 'USD' })).toBe('$766.76')
    expect(formatMeterValue({ label: 'x', value: 48.5, kind: 'dollars', currency: 'CNY' })).toBe('¥48.50')
    expect(formatMeterValue({ label: 'x', value: 3.2, kind: 'dollars', currency: null })).toBe('$3.20')
    expect(formatMeterValue({ label: 'x', value: 20, kind: 'percent', currency: null })).toBe('20%')
    expect(formatMeterValue({ label: 'x', value: 2, kind: 'count', currency: null })).toBe('2')
  })
})

describe('updated-ago meta', () => {
  it('formats the page and popover variants', () => {
    expect(formatUpdatedAgo(NOW - 30_000, NOW)).toBe('just now')
    expect(formatUpdatedAgo(NOW - 60_000, NOW)).toBe('1 min ago')
    expect(formatUpdatedAgo(NOW - 5 * 60_000, NOW)).toBe('5 min ago')
    expect(formatUpdatedAgoShort(NOW - 30_000, NOW)).toBe('now')
    expect(formatUpdatedAgoShort(NOW - 7 * 60_000, NOW)).toBe('7m ago')
  })

  it('scales to hours and days for stale data', () => {
    expect(formatUpdatedAgo(NOW - 75 * 60_000, NOW)).toBe('1 hr ago')
    expect(formatUpdatedAgo(NOW - 130 * 60_000, NOW)).toBe('2 hr ago')
    expect(formatUpdatedAgo(NOW - 26 * 3_600_000, NOW)).toBe('1 day ago')
    expect(formatUpdatedAgo(NOW - 3 * 86_400_000, NOW)).toBe('3 days ago')
    expect(formatUpdatedAgoShort(NOW - 130 * 60_000, NOW)).toBe('2h ago')
    expect(formatUpdatedAgoShort(NOW - 3 * 86_400_000, NOW)).toBe('3d ago')
  })

  it('finds the newest fetchedAt', () => {
    expect(latestFetchedAt([])).toBeNull()
    expect(latestFetchedAt([
      { fetchedAt: new Date(NOW - 120_000).toISOString() },
      { fetchedAt: new Date(NOW - 30_000).toISOString() },
      { fetchedAt: 'garbage' },
    ])).toBe(NOW - 30_000)
  })
})

function snap(provider: UsageSnapshot['provider'], windows: Partial<UsageWindow>[]): UsageSnapshot {
  return {
    provider,
    status: 'ok',
    provenance: 'experimental',
    fetchedAt: new Date(NOW).toISOString(),
    identity: null,
    meters: [],
    windows: windows.map(w => windowWith(w)),
  }
}

describe('computePressure', () => {
  it('averages per-provider account maxima and peaks at the max', () => {
    // Kimi carries 5H 100% + MO 43% (account) + a model window; GLM 63%,
    // Codex 18%. avg = (100 + 63 + 18) / 3 ≈ 60.3; peak = 100 @ kimi 5H.
    const stats = computePressure([
      snap('kimi', [
        { kind: 'session', usedPercent: 100, windowSeconds: 18_000 },
        { kind: 'monthly', usedPercent: 43 },
        { kind: 'weekly', usedPercent: 99, model: 'sonnet' },
      ]),
      snap('glm', [{ kind: 'weekly', usedPercent: 63, windowSeconds: 604_800 }]),
      snap('codex', [{ kind: 'weekly', usedPercent: 18, windowSeconds: 604_800 }]),
    ])
    expect(stats.participating).toBe(3)
    expect(stats.avg).toBeCloseTo(60.33, 1)
    expect(stats.peak).toBe(100)
    expect(stats.peakProvider).toBe('kimi')
    expect(stats.peakWindow?.kind).toBe('session')
    expect(stats.aboveHalf).toBe(2)
  })

  it('skips providers with no usable account window instead of dragging the mean', () => {
    const stats = computePressure([
      snap('kimi', [{ kind: 'session', usedPercent: 80, windowSeconds: 18_000 }]),
      snap('gemini', []),
      snap('claude', [{ kind: 'weekly', usedPercent: null }]),
    ])
    expect(stats.participating).toBe(1)
    expect(stats.avg).toBe(80)
    expect(stats.aboveHalf).toBe(1)
  })

  it('is null-safe when nothing has data', () => {
    const stats = computePressure([])
    expect(stats.avg).toBeNull()
    expect(stats.peak).toBeNull()
    expect(stats.peakProvider).toBeNull()
    expect(stats.aboveHalf).toBe(0)
  })
})
