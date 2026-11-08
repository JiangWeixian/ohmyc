import { useState } from 'react'

import { MenuBarViewGallery } from './menu-bar-view-gallery'
import { EnvNote } from './quota-section'
import { Button } from '@/components/ui/button'
import { Switch } from '@/components/ui/switch'
import { useAppSettings, useUpdateSettings } from '@/hooks/use-app-settings'

function isMacOS(): boolean {
  return typeof navigator !== 'undefined' && /Mac/.test(navigator.userAgent)
}

export function MenuBarSection() {
  const { data: settings } = useAppSettings()
  const update = useUpdateSettings()
  const [confirming, setConfirming] = useState(false)
  const menubar = settings?.menubarIconVisible

  if (!settings) {
    return null
  }

  return (
    <section className="mb-9">
      <h2 className="text-base font-[590] tracking-[-0.1px]">Menu bar</h2>
      <p className="mb-4 mt-1 text-[13px] text-[var(--text-tertiary)]">
        Choose a complete Popover layout. Preview freely, then apply your preference.
      </p>
      <MenuBarViewGallery settings={settings} />
      {isMacOS() && menubar && (
        <div className="mt-2">
          <div className="flex items-center gap-4 py-3.5">
            <div className="flex-1">
              <div className="text-sm font-[510]">Show quota in the menu bar</div>
              <div className="mt-0.5 text-xs text-[var(--text-tertiary)]">Check quota from the menu bar without opening the main window. Polling continues while hidden.</div>
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
                      // Keep the confirmation open and the icon visible if the write fails.
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
