// Pressure band (DESIGN.md §Quota): the hero strip between the title row and
// the card grid. Big number = `avg` (mean of per-provider account-window
// maxima — total subscription consumption); the bar = `peak` (the single most
// constrained window) with a right-aligned caption naming it. Right side
// carries the constraint details. Hides entirely when nothing has data.

import {
  computePressure,
  formatCountdown,
  HEAT_FILL_CLASS,
  heatBucket,
  PROVIDER_META,
  windowTag,
} from './format'
import { cn } from '@/lib/utils'

import type { UsageSnapshot } from '@/hooks/use-quota'

export function PressureBand({ snapshots, nowMs }: { snapshots: UsageSnapshot[]; nowMs: number }) {
  const stats = computePressure(snapshots)
  if (stats.avg == null || stats.peak == null) {
    return null
  }

  const peakName = stats.peakProvider ? PROVIDER_META[stats.peakProvider].name : null
  const peakTag = stats.peakWindow ? windowTag(stats.peakWindow) : null
  const peakReset = stats.peakWindow?.resetsAt ? formatCountdown(stats.peakWindow.resetsAt, nowMs) : null

  return (
    <section className="mb-4 flex items-end justify-between gap-6 rounded-lg border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)] px-[22px] pb-4 pt-5">
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline gap-2.5">
          <span className="font-display text-[34px] font-[590] leading-none tracking-[-0.5px] text-[var(--text-primary)]">
            {Math.round(stats.avg)}%
          </span>
          <span className="font-mono-theme text-[10px] uppercase tracking-[0.08em] text-[var(--text-quaternary)]">
            avg across {stats.participating} CLIs
          </span>
        </div>
        <div className="relative mt-3.5 h-1.5 rounded-[3px] bg-[var(--heat-0)]">
          <div
            className={cn('absolute inset-y-0 left-0 rounded-[3px]', HEAT_FILL_CLASS[heatBucket(stats.peak)])}
            style={{ width: `${Math.min(100, Math.max(0, stats.peak))}%` }}
          />
        </div>
        <div className="mt-2 text-right font-mono-theme text-[9px] text-[var(--text-quaternary)]">
          peak {Math.round(stats.peak)}%
          {peakName && ` · ${peakName} ${peakTag}`}
          {peakReset && ` · ${peakReset}`}
        </div>
      </div>
      <div className="shrink-0 text-right font-mono-theme text-[10px] leading-[1.9] text-[var(--text-quaternary)]">
        {peakName && (
          <>
            most constrained{' '}
            <b className="font-[510] text-[var(--text-secondary)]">
              {peakName} · {peakTag}
            </b>
            <br />
          </>
        )}
        {peakReset && (
          <>
            resets in{' '}
            <b className="font-[510] text-[var(--text-secondary)]">{peakReset}</b>
            {' · '}
          </>
        )}
        {stats.aboveHalf} of {stats.participating} above 50%
      </div>
    </section>
  )
}
