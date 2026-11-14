// Quota bar grammar (DESIGN.md §Quota): 6px `--heat-0` track, heat-ladder
// fill, and a 1px pace tick with a 4px dot cap marking the time-elapsed
// position. Fill behind the tick = on pace; fill past the tick = burning
// ahead. Unknown usage renders an empty track with a "—" percent.

import {
  HEAT_FILL_CLASS,
  heatBucket,
  PACE_AHEAD_THRESHOLD,
  paceDelta,
  paceElapsed,
} from './format'
import { cn } from '@/lib/utils'

import type { UsageWindow } from '@/hooks/use-quota'

interface QuotaBarProperties {
  window: UsageWindow
  nowMs: number
  /** Bar height class — the menubar popover uses a thinner 5px variant. */
  className?: string
}

export function QuotaBar({ window, nowMs, className }: QuotaBarProperties) {
  const used = window.usedPercent
  const elapsed = paceElapsed(window, nowMs)
  return (
    <div className={cn('relative h-1.5 rounded-[3px] bg-[var(--heat-0)]', className)}>
      {used != null && (
        <div
          className={cn('absolute inset-y-0 left-0 rounded-[3px]', HEAT_FILL_CLASS[heatBucket(used)])}
          style={{ width: `${Math.min(100, Math.max(0, used))}%` }}
        />
      )}
      {elapsed != null && (
        <div
          className="absolute -inset-y-0.5 w-px bg-[var(--text-quaternary)]"
          style={{ left: `${elapsed * 100}%` }}
          data-pace-tick
        >
          <span className="absolute left-[-1.5px] top-[-3px] size-1 rounded-full bg-[var(--text-tertiary)]" />
        </div>
      )}
    </div>
  )
}

/**
 * Right-aligned mono 9px pace note. Only rendered when the window is ≥5
 * points ahead of its pace tick; a window in reserve stays silent.
 */
export function PaceNote({ window, nowMs }: { window: UsageWindow; nowMs: number }) {
  const delta = paceDelta(window, nowMs)
  if (delta == null || delta < PACE_AHEAD_THRESHOLD) {
    return null
  }
  return (
    <div className="mt-[3px] text-right font-mono-theme text-[9px] text-[var(--text-quaternary)]">
      {`pace +${Math.round(delta)}% ahead — runs out before reset`}
    </div>
  )
}
