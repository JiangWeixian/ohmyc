import { Badge } from '@/components/ui/badge';
import { cn } from '@/lib/utils';

type InventorySource = 'local' | 'profile' | 'plugin' | 'project';

interface SourceBadgeProps {
  source: InventorySource;
  pluginId?: string;
}

export function SourceBadge({ source, pluginId }: SourceBadgeProps) {
  if (source === 'local') {
    return (
      <Badge
        variant="secondary"
        className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--surface-overlay)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]"
      >
        local
      </Badge>
    );
  }
  if (source === 'profile') {
    return (
      <Badge
        variant="outline"
        className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--accent-blue)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-blue)]"
      >
        profile
      </Badge>
    );
  }
  if (source === 'plugin') {
    const label = pluginId ? pluginId.split('@')[0] : 'plugin';
    return (
      <Badge
        variant="outline"
        className="h-auto min-h-0 gap-1 rounded-[var(--radius-sm)] border-transparent bg-[var(--accent-purple)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-purple)]"
      >
        <span>plugin</span>
        {pluginId ? <span className="normal-case">{label}</span> : null}
      </Badge>
    );
  }
  if (source === 'project') {
    return (
      <Badge
        variant="outline"
        className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--accent-green)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-green)]"
      >
        project
      </Badge>
    );
  }
  return null;
}
