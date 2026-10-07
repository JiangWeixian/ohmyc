// Mock quota snapshots for storybook + vitest — one per provider, exercising
// every status the UI renders (ok / tokenExpired / notLoggedIn) and every
// meter kind. Content mirrors assets/quota-mockup-20261001/index.html, with
// timestamps derived from "now" so countdowns and pace ticks stay alive.

import type { UsageSnapshot } from '@/hooks/use-quota'

const MIN = 60_000
const HOUR = 60 * MIN

function isoFromNow(offsetMs: number): string {
  return new Date(Date.now() + offsetMs).toISOString()
}

/** Pace targets chosen so elapsed ≈ 58% / 71% / 44% … against windowSeconds. */
export function quotaSnapshots(): UsageSnapshot[] {
  return [
    {
      provider: 'claude',
      status: 'ok',
      identity: { email: null, plan: 'Max 5x' },
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [
        { kind: 'session', label: '5h', usedPercent: 34, resetsAt: isoFromNow(132 * MIN), windowSeconds: 18_000, model: null },
        { kind: 'weekly', label: 'Weekly', usedPercent: 61, resetsAt: isoFromNow(5910 * MIN), windowSeconds: 604_800, model: null },
        { kind: 'weekly', label: 'Weekly', usedPercent: 12, resetsAt: isoFromNow(7630 * MIN), windowSeconds: 604_800, model: 'sonnet' },
      ],
      meters: [
        { label: 'Extra usage', value: 3.2, kind: 'dollars', currency: 'USD' },
        { label: 'Extra usage limit', value: 50, kind: 'dollars', currency: 'USD' },
      ],
    },
    {
      provider: 'codex',
      status: 'ok',
      identity: { email: null, plan: 'Pro' },
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [
        { kind: 'session', label: '5h', usedPercent: 92, resetsAt: isoFromNow(41 * MIN), windowSeconds: 18_000, model: null },
        { kind: 'weekly', label: 'Weekly', usedPercent: 47, resetsAt: isoFromNow(5210 * MIN), windowSeconds: 604_800, model: null },
      ],
      meters: [
        { label: 'Credits', value: 766.76, kind: 'dollars', currency: 'USD' },
        { label: 'Resets banked', value: 2, kind: 'count', currency: null },
      ],
    },
    {
      provider: 'cursor',
      status: 'ok',
      identity: { email: null, plan: 'Pro' },
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [
        { kind: 'monthly', label: 'Monthly', usedPercent: 53, resetsAt: isoFromNow(18_480 * MIN), windowSeconds: 2_592_000, model: null },
      ],
      meters: [
        { label: 'Remaining this cycle', value: 10.6, kind: 'dollars', currency: 'USD' },
      ],
    },
    {
      provider: 'grok',
      status: 'tokenExpired',
      identity: null,
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [],
      meters: [],
    },
    {
      provider: 'gemini',
      status: 'notLoggedIn',
      identity: null,
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [],
      meters: [],
    },
    {
      provider: 'kimi',
      status: 'ok',
      identity: { email: null, plan: 'Plus' },
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [
        { kind: 'session', label: '5h', usedPercent: 41, resetsAt: isoFromNow(208 * MIN), windowSeconds: 18_000, model: null },
        // Monthly pools carry no fixed window length — no pace tick.
        { kind: 'monthly', label: 'Monthly', usedPercent: 22, resetsAt: isoFromNow(21_900 * MIN), windowSeconds: null, model: null },
      ],
      meters: [
        { label: 'Booster wallet', value: 48.5, kind: 'dollars', currency: 'CNY' },
      ],
    },
    {
      provider: 'opencodeGo',
      status: 'ok',
      identity: { email: null, plan: 'Go' },
      provenance: 'officialEndpoint',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [
        { kind: 'session', label: '5h', usedPercent: 4, resetsAt: isoFromNow(262 * MIN), windowSeconds: 18_000, model: null },
        { kind: 'weekly', label: 'Weekly', usedPercent: 3, resetsAt: isoFromNow(5900 * MIN), windowSeconds: 604_800, model: null },
        { kind: 'monthly', label: 'Monthly', usedPercent: 1, resetsAt: isoFromNow(27_000 * MIN), windowSeconds: null, model: null },
      ],
      meters: [],
    },
    {
      provider: 'glm',
      status: 'ok',
      identity: { email: null, plan: 'Pro' },
      provenance: 'experimental',
      fetchedAt: isoFromNow(-2 * MIN),
      windows: [
        { kind: 'session', label: '5h', usedPercent: 34, resetsAt: isoFromNow(120 * MIN), windowSeconds: 18_000, model: null },
        { kind: 'weekly', label: 'Weekly', usedPercent: 98, resetsAt: isoFromNow(3400 * MIN), windowSeconds: 604_800, model: null },
        { kind: 'monthly', label: 'mcp', usedPercent: 0, resetsAt: isoFromNow(18_000 * MIN), windowSeconds: null, model: null },
      ],
      meters: [
        { label: 'search-prime', value: 0, kind: 'count', currency: null },
        { label: 'web-reader', value: 0, kind: 'count', currency: null },
        { label: 'zread', value: 0, kind: 'count', currency: null },
      ],
    },
  ]
}

/** All eight providers logged out — the page shows its empty-state note. */
export function quotaSnapshotsLoggedOut(): UsageSnapshot[] {
  return ([
    'claude',
    'codex',
    'cursor',
    'grok',
    'gemini',
    'kimi',
    'opencodeGo',
    'glm',
  ] as const).map(provider => ({
    provider,
    status: 'notLoggedIn',
    identity: null,
    provenance: provider === 'opencodeGo' ? 'officialEndpoint' : 'experimental',
    fetchedAt: isoFromNow(-2 * MIN),
    windows: [],
    meters: [],
  }))
}
