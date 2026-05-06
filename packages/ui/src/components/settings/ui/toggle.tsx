// Settings-scoped toggle switch with optional label and description text.

import { Switch } from '@/components/ui/switch'

interface ToggleProperties {
  checked: boolean
  onChange: (checked: boolean) => void
  label?: string
  description?: string
}

/**
 * Boolean toggle for settings forms. Wraps the shadcn Switch with a label
 * and a muted description line for additional context.
 */
export function Toggle({ checked, onChange, label, description }: ToggleProperties) {
  return (
    <div className="flex items-start gap-3">
      <Switch checked={checked} onCheckedChange={onChange} />
      {(label || description) && (
        <div className="flex flex-col gap-0.5">
          {label && (
            <label
              className="text-[13px] font-medium text-[var(--text-primary)] cursor-pointer"
              onClick={() => onChange(!checked)}
            >
              {label}
            </label>
          )}
          {description && (
            <span className="text-[12px] text-[var(--text-tertiary)]">
              {description}
            </span>
          )}
        </div>
      )}
    </div>
  )
}
