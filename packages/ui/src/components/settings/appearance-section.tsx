// Appearance settings: the five theme cards (band preview + name) and the
// menu bar icon row. The menu bar row is a desktop/macOS-only surface and
// asks for confirmation before hiding the icon — the recovery path (#30)
// is what makes hiding safe.
import { Check } from 'lucide-react'
import { useState } from 'react'

import { EnvNote } from './quota-section'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppSettings, useUpdateSettings } from '@/hooks/use-app-settings'
import { cn } from '@/lib/utils'
import { type ThemeId, themes } from '@/theme/registry'
import { useTheme } from '@/theme/theme-provider'

const THEME_BANDS: Record<ThemeId, { background: string; color: string }> = {
  monitor: { background: 'linear-gradient(135deg,#141517,#08090a)', color: '#f7f8f8' },
  phosphor: { background: 'linear-gradient(135deg,#101211,#050706)', color: '#e8f0e8' },
  amber: { background: 'linear-gradient(135deg,#1a1300,#0a0700)', color: '#ffb000' },
  retro: { background: 'linear-gradient(135deg,#2b0a3d,#0b2733)', color: '#00f0ff' },
  cyberpunk: { background: 'linear-gradient(135deg,#232006,#0a0a08)', color: '#fcee0a' },
}

function isMacOS(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
}

export function AppearanceSection() {
  const { theme, setTheme, sources } = useTheme()
  const { data: settings } = useAppSettings()
  const update = useUpdateSettings()
  const [confirming, setConfirming] = useState(false)
  const themeEnvOverride = sources.theme === 'env'
  const menubar = settings?.menubarIconVisible

  return (
    <section className="mb-9">
      <h2 className="text-base font-[590] tracking-[-0.1px]">Appearance</h2>
      <p className="mb-4 mt-1 text-[13px] text-[var(--text-tertiary)]">Personality is your choice. Same dark foundation, five voices.</p>
      <div className="grid grid-cols-3 gap-3">
        {themes.map((t) => {
          const selected = theme === t.id
          return (
            <button
              key={t.id}
              type="button"
              data-testid={`theme-card-${t.id}`}
              disabled={themeEnvOverride}
              onClick={() => setTheme(t.id).catch(() => {})}
              aria-pressed={selected}
              className={cn(
                'relative overflow-hidden rounded-[10px] border border-[var(--border-subtle)] bg-[rgba(255,255,255,0.02)] text-left transition-[border-color,background-color] duration-150',
                !themeEnvOverride && 'hover:border-[rgba(255,255,255,0.18)]',
                selected && 'bg-[rgba(255,255,255,0.03)]',
                themeEnvOverride && 'cursor-not-allowed opacity-50',
              )}
            >
              {selected && (
                <span data-testid={`theme-check-${t.id}`} className="absolute bottom-3 right-3 z-10 flex size-[17px] items-center justify-center rounded-full bg-[var(--text-primary)] text-[var(--bg-deep)]">
                  <Check size={10} strokeWidth={3.5} />
                </span>
              )}
              <div className="flex h-10 items-end px-2.5 pb-1.5" style={{ background: THEME_BANDS[t.id].background, color: THEME_BANDS[t.id].color }}>
                <span className="font-mono-theme text-[10px] opacity-85">Aa 01</span>
              </div>
              <div className="px-3 pb-3 pt-2.5">
                <div className="text-[13px] font-[510]">{t.name}</div>
                <div className="mt-0.5 text-[11px] text-[var(--text-tertiary)]">{t.description}</div>
              </div>
            </button>
          )
        })}
      </div>
      {themeEnvOverride && (
        <p className="mt-2 text-[11px] text-[var(--text-quaternary)]">
          Theme is overridden by <code className="font-mono-theme">{settings?.themeId.envVar ?? 'OHMYC_THEME'}</code> — palette and card switches are disabled.
        </p>
      )}
      {isMacOS() && menubar && (
        <div className="mt-2">
          <div className="flex items-center gap-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm font-[510]">Show menu bar icon</div>
              <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">Quick access to the quota popover. Quota keeps refreshing while hidden.</div>
            </div>
            <Switch
              checked={menubar.value}
              disabled={menubar.source === 'env'}
              onCheckedChange={(next) => {
                if (next) {
                  update({ menubar: { iconVisible: true } }).catch(() => {})
                } else {
                  setConfirming(true)
                }
              }}
              aria-label="Show menu bar icon"
            />
          </div>
          <EnvNote setting={menubar} />
          {confirming && (
            <div data-testid="menubar-confirm" className="border-t border-[var(--border-subtle)] py-4">
              <p className="text-[13px] text-[var(--text-secondary)]">Hide the menu bar icon? OhMyC keeps running and polling in the background.</p>
              <p className="mt-1.5 font-mono-theme text-xs text-[var(--text-tertiary)]">
                To get back: reopen OhMyC from Applications, Dock, or Spotlight — the main window returns, and you can re-enable the icon here.
              </p>
              <div className="mt-3.5 flex gap-2.5">
                <Button
                  onClick={async () => {
                    try {
                      await update({ menubar: { iconVisible: false } })
                      setConfirming(false)
                    } catch {
                      // Write failed: keep the confirmation open and the icon visible.
                    }
                  }}
                >
                  Hide icon
                </Button>
                <Button variant="ghost" onClick={() => setConfirming(false)}>Cancel</Button>
              </div>
            </div>
          )}
        </div>
      )}
    </section>
  )
}
