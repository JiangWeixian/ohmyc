import { MenuBarViewGallery } from './menu-bar-view-gallery'
import { useAppSettings } from '@/hooks/use-app-settings'

export function MenuBarSection() {
  const { data: settings } = useAppSettings()

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
    </section>
  )
}
