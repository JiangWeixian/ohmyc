// Menubar popover page — setup gating, shell behavior, and the resolved
// layout. Shared preset rendering lives in MenubarPresetContent.

import { useEffect, useState } from 'react'

import { MenubarOnboard } from './menubar-onboard'
import { MenubarPresetContent } from './menubar-preset-content'
import { useAppSettings } from '@/hooks/use-app-settings'
import { useFsChanged } from '@/hooks/use-fs-changed'
import { usePopoverAutosize } from '@/hooks/use-popover-autosize'
import { useSetupStatus } from '@/hooks/use-setup-status'

import type { SetupStatus } from '@/hooks/use-setup-status'

function MenubarActivity() {
  useFsChanged()
  const { data: settings } = useAppSettings()
  const popoverRef = usePopoverAutosize<HTMLDivElement>()
  const [today, setToday] = useState(() => new Date())

  useEffect(() => {
    const timer = setInterval(() => setToday(new Date()), 30_000)
    return () => clearInterval(timer)
  }, [])

  return (
    <MenubarPresetContent
      ref={popoverRef}
      view={settings?.menubarView.value ?? 'area'}
      today={today}
      onOpen={async () => {
        // Tauri supplies this module at runtime in the desktop shell.
        // eslint-disable-next-line import/no-extraneous-dependencies
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('open_main_window')
        await invoke('hide_popover')
      }}
    />
  )
}

/** Compact status line for the popover (mirrors the main gate). */
function menubarStatusLine(state: SetupStatus['state']): string | undefined {
  switch (state) {
    case 'unreadable_store': {
      return 'Local monitor store exists but could not be opened.'
    }
    case 'internal_error': {
      return 'OhMyC could not confirm the monitor connection.'
    }
    default: {
      return undefined
    }
  }
}

/**
 * Menubar popover page. Resolves the persisted layout through app settings.
 * When the monitor store is not ready it shows the compact MenubarOnboard
 * instead of an empty activity chart. Lives at
 * /menubar — outside the main-window setup gate.
 */
export function MenubarPage() {
  const { data, isLoading } = useSetupStatus()

  // While the readiness check is in flight, render nothing — the popover is
  // transient and a flash of empty space is preferable to a flash of the
  // wrong surface.
  if (isLoading || !data) {
    return null
  }
  if (data.state !== 'ready') {
    return <MenubarOnboard statusLine={menubarStatusLine(data.state)} />
  }
  return <MenubarActivity />
}
