import { cn } from '@/lib/utils';

interface ComponentPickerProps {
  label: string;
  available: { id: string; description?: string }[];
  selected: string[];
  onChange: (selected: string[]) => void;
  isLoading?: boolean;
}

export function ComponentPicker({ label, available, selected, onChange, isLoading }: ComponentPickerProps) {
  const toggle = (id: string) => {
    onChange(selected.includes(id) ? selected.filter(s => s !== id) : [...selected, id]);
  };

  return (
    <div>
      <div className="mb-3 text-[11px] font-medium uppercase tracking-wide text-[var(--text-tertiary)]">{label}</div>
      {isLoading ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">Loading...</div>
      ) : available.length === 0 ? (
        <div className="text-[13px] text-[var(--text-tertiary)]">No items in store. Add some first.</div>
      ) : (
        <div className="space-y-1">
          {available.map(item => (
            <label
              key={item.id}
              className={cn(
                "flex cursor-pointer items-start gap-3 rounded-[var(--radius-sm)] border border-transparent px-3 py-2 transition-smooth",
                "hover:border-white/5 hover:bg-white/[0.03]"
              )}
            >
              <input
                type="checkbox"
                checked={selected.includes(item.id)}
                onChange={() => toggle(item.id)}
                className={cn(
                  "mt-0.5 size-4 rounded-[var(--radius-sm)] border-[var(--border-default)]",
                  "bg-[var(--surface-panel)]",
                  "text-[var(--accent-blue)]",
                  "focus:ring-[var(--accent-blue)]/30",
                  "cursor-pointer"
                )}
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
      )}
    </div>
  );
}
