// Checkbox list for selecting store components (agents, skills, commands)
// to include in a profile.

import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface ComponentPickerProperties {
  label: string
  available: { id: string; description?: string }[]
  selected: string[]
  onChange: (selected: string[]) => void
  isLoading?: boolean
}

/**
 * Generic checkbox picker for store-managed items. Renders a labeled list
 * with toggle-able checkboxes, a loading placeholder, and an empty-state message.
 */
export function ComponentPicker({ label, available, selected, onChange, isLoading }: ComponentPickerProperties) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
      {isLoading
        ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">Loading...</div>
          )
        : (available.length === 0
            ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">No items in store. Add some first.</div>
              )
            : (
        <div className="space-y-1">
          {available.map(item => (
            <label
              key={item.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 transition-smooth',
                'hover:border-white/5 hover:bg-white/[0.03]',
              )}
            >
              <Checkbox
                checked={selected.includes(item.id)}
                onCheckedChange={() => toggle(item.id)}
                className="mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--text-primary)]">{item.id}</div>
                {item.description && (
                  <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)] line-clamp-2">{item.description}</div>
                )}
              </div>
            </label>
          ))}
        </div>
              ))}
    </div>
  )
}
