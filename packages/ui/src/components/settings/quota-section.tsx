// Quota settings: master switch (text pill) + the eight provider cards.
// A card toggles with a click anywhere; the top-right check marks "polled".
// Env-overridden controls are disabled and name the variable instead.
import { Check } from 'lucide-react'

import { ProviderGlyph } from './provider-glyph'
import { formatUpdatedAgoShort, PROVIDER_META } from '@/components/quota/format'
import { useAppSettings, useUpdateSettings } from '@/hooks/use-app-settings'
import {
  type QuotaProviderId,
  type UsageSnapshot,
  useQuota,
} from '@/hooks/use-quota'
import { cn } from '@/lib/utils'

import type { ResolvedSetting } from '@/hooks/use-app-settings'

const PROVIDER_IDS: QuotaProviderId[] = ['claude', 'codex', 'cursor', 'gemini', 'glm', 'grok', 'kimi', 'opencodeGo']

function snapshotText(snapshot: UsageSnapshot | undefined): string {
  if (!snapshot) {
    return '—'
  }
  switch (snapshot.status) {
    case 'ok': {
      return `ok · ${formatUpdatedAgoShort(Date.parse(snapshot.fetchedAt), Date.now())}`
    }
    case 'disabled': {
      return 'disabled'
    }
    case 'notLoggedIn': {
      return 'not logged in'
    }
    case 'tokenExpired': {
      return 'token expired'
    }
    case 'rateLimited': {
      return 'rate limited'
    }
    case 'unsupported': {
      return 'unsupported'
    }
    case 'error': {
      return 'error'
    }
  }
  return 'error'
}

export function EnvNote({ setting }: { setting: ResolvedSetting<unknown> }) {
  if (setting.source !== 'env') {
    return null
  }
  return (
    <p className="mt-1.5 text-[11px] text-[var(--text-quaternary)]">
      Overridden by <code className="rounded border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.04)] px-1 py-px font-mono-theme text-[10px]">{setting.envVar}</code>
      {' '}— effective value <code className="font-mono-theme text-[10px]">{String(setting.value)}</code>. UI changes have no effect.
    </p>
  )
}

function ProviderCard({ id, setting, snapshot, onToggle }: {
  id: QuotaProviderId
  setting: ResolvedSetting<boolean>
  snapshot: UsageSnapshot | undefined
  onToggle: () => void
}) {
  const selected = setting.value
  const envOverride = setting.source === 'env'
  const healthy = snapshot?.status === 'ok'
  return (
    <button
      type="button"
      disabled={envOverride}
      onClick={onToggle}
      aria-pressed={selected}
      className={cn(
        'relative flex flex-wrap items-center gap-3 rounded-[10px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] p-4 text-left transition-[border-color,background-color] duration-150',
        !envOverride && 'hover:border-[rgba(255,255,255,0.16)] hover:bg-[rgba(255,255,255,0.035)]',
        selected && 'bg-[rgba(255,255,255,0.03)]',
        envOverride && 'cursor-not-allowed opacity-50',
      )}
    >
      {selected
        ? (
            <span data-testid={`provider-check-${id}`} className="absolute right-3 top-3 flex size-[17px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-deep)]">
              <Check size={10} strokeWidth={3.5} />
            </span>
          )
        : <span className="absolute right-3 top-3 size-[17px] rounded-full border border-[var(--border-standard)]" />}
      <span className={cn('flex size-[34px] shrink-0 items-center justify-center rounded-lg border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.05)] text-[var(--text-secondary)]', !selected && 'opacity-45')}>
        <ProviderGlyph id={id} />
      </span>
      <span className="min-w-0 flex-1 pr-5">
        <span className="block text-sm font-[510]">{PROVIDER_META[id].name}</span>
        <span className="mt-0.5 flex items-center gap-1.5 text-[11px] text-[var(--text-quaternary)]">
          <span className={cn('size-1 rounded-full', healthy ? 'bg-[var(--text-primary)]' : 'bg-[var(--text-quaternary)]')} />
          {snapshotText(snapshot)}
        </span>
      </span>
      {envOverride && (
        <span className="w-full text-[10px] text-[var(--text-quaternary)]">
          env <code className="font-mono-theme">{setting.envVar}</code> = {String(setting.value)}
        </span>
      )}
    </button>
  )
}

export function QuotaSection() {
  const { data: settings } = useAppSettings()
  const update = useUpdateSettings()
  const { data: snapshots } = useQuota()
  if (!settings) {
    return null
  }
  const master = settings.quotaEnabled
  const masterOff = !master.value
  return (
    <section className="mb-9">
      <div className="flex items-center gap-4">
        <div className="flex-1">
          <h2 className="text-base font-[590] tracking-[-0.1px]">Quota</h2>
          <p className="mb-4 mt-1 text-[13px] text-[var(--text-tertiary)]">Choose which providers to poll. Disabled providers are never contacted.</p>
        </div>
        <button
          type="button"
          disabled={master.source === 'env'}
          onClick={() => update({ quota: { enabled: masterOff } })}
          aria-pressed={master.value}
          aria-label="Enable quota polling"
          className={cn(
            'inline-flex items-center gap-1.5 rounded-full border px-3 py-1 font-mono-theme text-[11px] tracking-[0.02em] transition-[color,border-color] duration-150',
            master.value ? 'border-[rgba(255,255,255,0.18)] text-[var(--text-primary)]' : 'border-[var(--border-subtle)] text-[var(--text-tertiary)]',
            master.source === 'env' && 'cursor-not-allowed opacity-50',
          )}
        >
          <span aria-hidden="true">{master.value ? '●' : '○'}</span>
          {master.value ? 'on' : 'off'}
        </button>
      </div>
      <EnvNote setting={master} />
      <div
        data-testid="provider-grid"
        className={cn('grid grid-cols-2 gap-3 transition-opacity duration-150', masterOff && 'all-off pointer-events-none opacity-40')}
      >
        {PROVIDER_IDS.map(id => (
          <ProviderCard
            key={id}
            id={id}
            setting={settings.providers[id]}
            snapshot={snapshots?.find(s => s.provider === id)}
            onToggle={() => update({ quota: { providers: { [id]: { enabled: !settings.providers[id].value } } } })}
          />
        ))}
      </div>
    </section>
  )
}
