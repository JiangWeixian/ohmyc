import { usePlugins } from '../../hooks/use-plugins'
import { Checkbox } from '@/components/ui/checkbox'
import { cn } from '@/lib/utils'

interface PluginPickerProperties {
  selected: string[]
  onChange: (selected: string[]) => void
}

export function PluginPicker({ selected, onChange }: PluginPickerProperties) {
  const { data: plugins, isLoading } = usePlugins()

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id])
  }

  return (
    <div>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Plugins</div>
      {isLoading
        ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">Loading...</div>
          )
        : (plugins?.length
            ? (
        <div className="space-y-1">
          {plugins.map(p => (
            <label
              key={p.id}
              className={cn(
                'flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 transition-smooth',
                'hover:border-white/5 hover:bg-white/[0.03]',
              )}
            >
              <Checkbox
                checked={selected.includes(p.id)}
                onCheckedChange={() => toggle(p.id)}
                className="mt-0.5 cursor-pointer"
              />
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--text-primary)]">{p.name}</div>
                <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">@{p.marketplace}</div>
              </div>
            </label>
          ))}
        </div>
              )
            : (
        <div className="text-[13px] text-[var(--text-tertiary)]">No plugins installed.</div>
              ))}
    </div>
  )
}
