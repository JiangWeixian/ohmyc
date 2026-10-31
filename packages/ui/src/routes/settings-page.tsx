// /explore/settings — quota polling and appearance preferences. Without a
// settings backend (web dev, no Tauri), only the theme cards render.
import { AppearanceSection } from '@/components/settings/appearance-section'
import { QuotaSection } from '@/components/settings/quota-section'
import { useAppSettings } from '@/hooks/use-app-settings'

export function SettingsPage() {
  const { isError } = useAppSettings()
  return (
    <div className="mx-auto max-w-[860px]">
      <h1 className="text-[28px] font-[510] tracking-[-0.5px]">Settings</h1>
      <p className="mb-9 mt-2 text-sm text-[var(--text-tertiary)]">
        Quota polling, menu bar, and appearance. Changes apply immediately and persist across restarts.
      </p>
      {!isError && <QuotaSection />}
      <AppearanceSection />
    </div>
  )
}
