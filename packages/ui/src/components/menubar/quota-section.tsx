// Menubar popover Quota section (DESIGN.md §Quota): below the Activity KPI
// cells, the 3 most-constrained healthy providers — highest used% across
// account-level windows, status `ok` only. Model-specific windows (Claude's
// sonnet weekly…) stay on the main page and never enter the popover. No pace
// ticks here. Hidden entirely when no provider is healthy or the fetch fails.

import {
  formatCountdownShort,
  formatUpdatedAgoShort,
  HEAT_FILL_CLASS,
  heatBucket,
  latestFetchedAt,
  PROVIDER_META,
  windowTagShort,
} from '@/components/quota/format'
import { useQuota } from '@/hooks/use-quota'
import { cn } from '@/lib/utils'

import type { UsageSnapshot, UsageWindow } from '@/hooks/use-quota'

function accountWindows(snapshot: UsageSnapshot): UsageWindow[] {
  return snapshot.windows.filter(window => window.model == null)
}

/** Max used% across account-level windows; unknown percents rank lowest. */
function constraintScore(snapshot: UsageSnapshot): number {
  let max = -1
  for (const window of accountWindows(snapshot)) {
    const used = window.usedPercent ?? -1
    if (used > max) {
      max = used
    }
  }
  return max
}

function PopoverWindowRow({ window, nowMs }: { window: UsageWindow; nowMs: number }) {
  const used = window.usedPercent
  const countdown = window.resetsAt ? formatCountdownShort(window.resetsAt, nowMs) : null
  return (
    <div className="grid grid-cols-[22px_1fr_auto] items-center gap-2">
      <span className="font-mono-theme text-[9px] font-[510] uppercase tracking-wider text-[var(--text-quaternary)]">
        {windowTagShort(window)}
      </span>
      <div className="relative h-[5px] w-full rounded-[3px] bg-[var(--heat-0)]">
        {used != null && (
          <div
            className={cn('absolute inset-y-0 left-0 rounded-[3px]', HEAT_FILL_CLASS[heatBucket(used)])}
            style={{ width: `${Math.min(100, Math.max(0, used))}%` }}
          />
        )}
      </div>
      {/* Fixed 11ch (mono) value column: the longest content "100% · 30d" is
          10 chars, so every row's bar track gets the same 1fr width. */}
      <span className="w-[11ch] shrink-0 whitespace-nowrap text-right font-mono-theme text-[10px] text-[var(--text-tertiary)]">
        <b className="font-[510] text-[var(--text-primary)]">
          {used == null ? '—' : `${Math.round(used)}%`}
        </b>
        {countdown && ` · ${countdown}`}
      </span>
    </div>
  )
}

export function MenubarQuotaSection({ nowMs }: { nowMs: number }) {
  const { data } = useQuota()
  const snapshots = data ?? []

  const healthy = snapshots.filter(snapshot => snapshot.status === 'ok')
  const ranked = healthy
    .filter(snapshot => accountWindows(snapshot).length > 0)
    .toSorted((a, b) => constraintScore(b) - constraintScore(a))
  const shown = ranked.slice(0, 3)
  const moreHealthy = healthy.length - shown.length

  if (shown.length === 0) {
    return null
  }

  const fetchedAtMs = latestFetchedAt(snapshots)

  return (
    <>
      <div className="mb-3.5 mt-1 border-t border-[var(--border-subtle)]" />
      <div className="mb-2.5 flex items-baseline justify-between">
        {/* menubar-title carries the themeable ▌ prefix from CSS. */}
        <span className="menubar-title">Quota</span>
        <span className="font-mono-theme text-[9px] text-[var(--text-quaternary)]">
          {fetchedAtMs == null ? '' : formatUpdatedAgoShort(fetchedAtMs, nowMs)}
        </span>
      </div>
      <div className="flex flex-col gap-3.5">
        {shown.map(snapshot => (
          <div key={snapshot.provider} className="flex flex-col gap-1.5">
            <div className="flex items-center gap-1.5">
              <span className="font-mono-theme text-[11px] font-[510] text-[var(--text-primary)]">
                {PROVIDER_META[snapshot.provider].name}
              </span>
            </div>
            {accountWindows(snapshot).map(window => (
              <PopoverWindowRow
                key={`${windowTagShort(window)}|${window.windowSeconds ?? ''}|${window.resetsAt ?? ''}`}
                window={window}
                nowMs={nowMs}
              />
            ))}
          </div>
        ))}
      </div>
      {moreHealthy > 0 && (
        // The popover's own footer already carries the Open OhMyC action, so
        // this row only reports the collapsed healthy count.
        <div className="mt-2.5 font-mono-theme text-[10px] text-[var(--text-quaternary)]">
          {`+ ${moreHealthy} more healthy`}
        </div>
      )}
    </>
  )
}
