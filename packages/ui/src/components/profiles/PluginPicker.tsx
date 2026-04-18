import { usePlugins } from '../../hooks/usePlugins';
import { cn } from '../cn';

interface PluginPickerProps {
  selected: string[];
  onChange: (selected: string[]) => void;
}

export function PluginPicker({ selected, onChange }: PluginPickerProps) {
  const { data: plugins, isLoading } = usePlugins();

  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">Plugins</div>
      {isLoading ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">Loading...</div>
      ) : !plugins?.length ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">No plugins installed.</div>
      ) : (
        <div className="space-y-1">
          {plugins.map(p => (
            <label
              key={p.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 transition-smooth",
                "hover:border-white/5 hover:bg-white/[0.03]"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(p.id)}
                onChange={() => toggle(p.id)}
                className={cn(
                  "mt-0.5 size-4 rounded-[var(--radius-sm)] border-[var(--border-default)]",
                  "bg-[var(--surface-panel)]",
                  "text-[var(--accent-blue)]",
                  "focus:ring-[var(--accent-blue)]/30",
                  "cursor-pointer"
                )}
              />
              <div className="min-w-0">
                <div className="text-[13px] text-[var(--text-primary)]">{p.name}</div>
                <div className="mt-0.5 text-[12px] text-[var(--text-tertiary)]">@{p.marketplace}</div>
              </div>
            </label>
          ))}
        </div>
      )}
    </div>
  );
}
