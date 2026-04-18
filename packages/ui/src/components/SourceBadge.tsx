type InventorySource = 'local' | 'profile' | 'plugin' | 'project';

interface SourceBadgeProps {
  source: InventorySource;
  pluginId?: string;
}

export function SourceBadge({ source, pluginId }: SourceBadgeProps) {
  if (source === 'local') {
    return (
      <span className="rounded-[var(--radius-sm)] bg-[var(--surface-overlay)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]">
        local
      </span>
    );
  }
  if (source === 'profile') {
    return (
      <span className="rounded-[var(--radius-sm)] bg-[var(--accent-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-blue)]">
        profile
      </span>
    );
  }
  if (source === 'plugin') {
    const label = pluginId ? pluginId.split('@')[0] : 'plugin';
    return (
      <span className="inline-flex items-center gap-1 rounded-[var(--radius-sm)] bg-[var(--accent-purple)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-purple)]">
        <span>plugin</span>
        {pluginId ? <span className="normal-case">{label}</span> : null}
      </span>
    );
  }
  if (source === 'project') {
    return (
      <span className="rounded-[var(--radius-sm)] bg-[#22c55e]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#22c55e]">
        project
      </span>
    );
  }
  return null;
}
