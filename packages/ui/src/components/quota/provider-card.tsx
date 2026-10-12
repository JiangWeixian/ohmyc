// Provider card (DESIGN.md §Quota, Level-1 surface): header = name + plan
// pill + provenance/state marker; body = one row per quota window, then an
// optional meters row. Non-ok statuses render a dimmed state card with a
// recovery hint pointing at the official CLI — credentials are read-only by
// design, so recovery always happens there.

import { Fragment } from 'react'

import {
  formatCountdown,
  formatMeterValue,
  PROVIDER_META,
  windowTag,
} from './format'
import { PaceNote, QuotaBar } from './quota-bar'
import { cn } from '@/lib/utils'

import type { UsageSnapshot, UsageWindow } from '@/hooks/use-quota'

function ProvenanceMarker({ provenance }: { provenance: UsageSnapshot['provenance'] }) {
  const official = provenance === 'officialEndpoint'
  return (
    <span className="flex items-center gap-[7px]">
      <span
        className={cn(
          'size-1.5 rounded-full',
          official ? 'bg-[var(--heat-4)]' : 'border border-[var(--text-quaternary)] bg-transparent',
        )}
      />
      <span className="font-mono-theme text-[10px] text-[var(--text-quaternary)]">
        {official ? 'official' : 'experimental'}
      </span>
    </span>
  )
}

function WindowRow({ window, nowMs }: { window: UsageWindow; nowMs: number }) {
  const countdown = window.resetsAt ? formatCountdown(window.resetsAt, nowMs) : null
  return (
    <Fragment>
      <div className="grid grid-cols-[64px_1fr_46px_64px] items-center gap-3">
        <span className="font-mono-theme text-[10px] font-[510] uppercase tracking-[0.06em] text-[var(--text-tertiary)]">
          {windowTag(window)}
          {window.model && (
            <span className="normal-case tracking-normal text-[var(--text-quaternary)]">
              {' '}
              {window.model}
            </span>
          )}
        </span>
        <QuotaBar window={window} nowMs={nowMs} />
        <span
          className={cn(
            'text-right font-mono-theme text-[12px]',
            window.usedPercent == null
              ? 'font-normal text-[var(--text-quaternary)]'
              : 'font-[510] text-[var(--text-primary)]',
          )}
        >
          {window.usedPercent == null ? '—' : `${Math.round(window.usedPercent)}%`}
        </span>
        <span className="whitespace-nowrap text-right font-mono-theme text-[10px] text-[var(--text-quaternary)]">
          {countdown ?? '—'}
        </span>
      </div>
      <PaceNote window={window} nowMs={nowMs} />
    </Fragment>
  )
}

function StateBody({ snapshot }: { snapshot: UsageSnapshot }) {
  const meta = PROVIDER_META[snapshot.provider]
  switch (snapshot.status) {
    case 'tokenExpired': {
      return (
        <div className="flex flex-col gap-2 pb-1 pt-1.5">
          <p className="text-[13px] font-[510] text-[var(--text-secondary)]">Credentials expired</p>
          <p className="font-mono-theme text-[11px] leading-[1.6] text-[var(--text-quaternary)]">
            {meta.expiredHint ?? (
              <>
                Tokens are read-only here by design. Open the official CLI once to refresh:
                {' '}
                <code className="rounded border border-[var(--border-subtle)] bg-[var(--heat-0)] px-[5px] py-px text-[var(--text-secondary)]">{meta.cli}</code>
              </>
            )}
          </p>
        </div>
      )
    }
    case 'notLoggedIn': {
      return (
        <div className="flex flex-col gap-2 pb-1 pt-1.5">
          <p className="text-[13px] font-[510] text-[var(--text-secondary)]">No credentials found</p>
          <p className="font-mono-theme text-[11px] leading-[1.6] text-[var(--text-quaternary)]">
            Sign in once with the official CLI:
            {' '}
            <code className="rounded border border-[var(--border-subtle)] bg-[var(--heat-0)] px-[5px] py-px text-[var(--text-secondary)]">{meta.cli}</code>
          </p>
        </div>
      )
    }
    case 'rateLimited': {
      const retry = snapshot.retryAfterSeconds == null
        ? 'retry in a few minutes'
        : `retry in ${Math.max(1, Math.round(snapshot.retryAfterSeconds / 60))}m`
      return (
        <div className="flex flex-col gap-2 pb-1 pt-1.5">
          <p className="text-[13px] font-[510] text-[var(--text-secondary)]">Rate limited</p>
          <p className="font-mono-theme text-[11px] leading-[1.6] text-[var(--text-quaternary)]">
            The provider throttled the quota endpoint —
            {retry}
            .
          </p>
        </div>
      )
    }
    case 'error': {
      return (
        <div className="flex flex-col gap-2 pb-1 pt-1.5">
          <p className="text-[13px] font-[510] text-[var(--text-secondary)]">Couldn’t fetch quota</p>
          <p className="line-clamp-2 break-all font-mono-theme text-[11px] leading-[1.6] text-[var(--text-quaternary)]">
            {snapshot.message ?? 'unknown error'}
          </p>
        </div>
      )
    }
    case 'unsupported': {
      return (
        <div className="flex flex-col gap-2 pb-1 pt-1.5">
          <p className="text-[13px] font-[510] text-[var(--text-secondary)]">Polling disabled</p>
          <p className="font-mono-theme text-[11px] leading-[1.6] text-[var(--text-quaternary)]">
            {snapshot.message ?? 'This provider can’t report quota yet.'}
          </p>
        </div>
      )
    }
  }
}

function stateBadgeLabel(snapshot: UsageSnapshot): string | null {
  switch (snapshot.status) {
    case 'tokenExpired': { return 'token expired'
    }
    case 'notLoggedIn': { return 'not logged in'
    }
    case 'rateLimited': { return 'rate limited'
    }
    case 'error': { return 'error'
    }
    case 'unsupported': { return 'polling off'
    }
    default: { return null
    }
  }
}

export function ProviderCard({ snapshot, nowMs }: { snapshot: UsageSnapshot; nowMs: number }) {
  const meta = PROVIDER_META[snapshot.provider]
  const ok = snapshot.status === 'ok'
  const badge = stateBadgeLabel(snapshot)

  return (
    <section className="rounded-lg border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)] px-[22px] pb-4 pt-5 transition-colors hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)]">
      <div className="mb-4 flex items-center gap-2.5">
        <span className={cn('font-display text-[14px] font-[590] tracking-[-0.1px] text-[var(--text-primary)]', !ok && 'opacity-50')}>
          {meta.name}
        </span>
        {snapshot.identity?.plan && (
          <span className={cn('rounded-full border border-[var(--border-primary)] px-[9px] py-0.5 font-mono-theme text-[10px] font-[510] text-[var(--text-tertiary)]', !ok && 'opacity-50')}>
            {snapshot.identity.plan}
          </span>
        )}
        <span className="ml-auto flex items-center gap-[7px]">
          {ok || !badge
            ? <ProvenanceMarker provenance={snapshot.provenance} />
            : (
                <span className="inline-flex w-fit items-center gap-1.5 rounded-full border border-[var(--border-primary)] px-[9px] py-0.5 font-mono-theme text-[10px] font-[510] text-[var(--text-tertiary)]">
                  {snapshot.status === 'tokenExpired' && (
                    <span className="size-[5px] rounded-full bg-[var(--text-tertiary)]" />
                  )}
                  {badge}
                </span>
              )}
        </span>
      </div>

      {ok
        ? (
            <>
              <div className="flex flex-col gap-[11px]">
                {snapshot.windows.map(window => (
                  <WindowRow
                    key={`${windowTag(window)}|${window.model ?? ''}|${window.windowSeconds ?? ''}|${window.resetsAt ?? ''}`}
                    window={window}
                    nowMs={nowMs}
                  />
                ))}
              </div>
              {snapshot.meters.length > 0 && (
                <div className="mt-3.5 flex flex-wrap gap-x-[18px] gap-y-1.5 border-t border-[var(--border-subtle)] pt-3">
                  {snapshot.meters.map(meter => (
                    <span key={meter.label} className="font-mono-theme text-[11px] text-[var(--text-tertiary)]">
                      {meter.label}
                      {' '}
                      <b className="font-[510] text-[var(--text-secondary)]">{formatMeterValue(meter)}</b>
                    </span>
                  ))}
                </div>
              )}
            </>
          )
        : <StateBody snapshot={snapshot} />}
    </section>
  )
}
