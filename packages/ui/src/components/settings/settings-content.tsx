// Content router for the settings panel -- renders the appropriate category form
// based on the active sidebar selection.

import { GeneralSettingsPanel } from './general-settings'

import type { CategoryId } from './settings-sidebar'

interface SettingsContentProperties {
  category: CategoryId
}

/**
 * Renders the settings form matching the currently selected sidebar category.
 * Falls back to a "Coming soon" placeholder for unimplemented categories.
 */
export function SettingsContent({ category }: SettingsContentProperties) {
  return (
    <main className="flex-1 overflow-y-auto max-w-3xl mx-auto py-8 px-6">
      {category === 'general'
        ? (
        <GeneralSettingsPanel />
          )
        : (
        <div className="flex flex-col items-center justify-center py-20">
          <p className="text-[var(--text-tertiary)] text-sm">Coming soon</p>
        </div>
          )}
    </main>
  )
}
