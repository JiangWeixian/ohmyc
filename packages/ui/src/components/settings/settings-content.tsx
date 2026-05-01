import { GeneralSettingsPanel } from './general-settings'

import type { CategoryId } from './settings-sidebar'

interface SettingsContentProperties {
  category: CategoryId
}

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
