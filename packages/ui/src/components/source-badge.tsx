// Badge indicating where an entity originates — local, plugin, or project.
import { Badge } from '@/components/ui/badge'

/** Union of possible inventory sources for an entity. */
type InventorySource = 'local' | 'plugin' | 'project'

/** Properties for the {@link SourceBadge} component. */
interface SourceBadgeProperties {
  source: InventorySource
  pluginId?: string
}

/** Renders a small colored badge indicating the origin of an entity
 *  (local file, installed plugin, or project directory). */
export function SourceBadge({ source, pluginId }: SourceBadgeProperties) {
  if (source === 'local') {
    return (
      <Badge
        variant="secondary"
        className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--surface-overlay)] px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--text-tertiary)]"
      >
        local
      </Badge>
    )
  }
  if (source === 'plugin') {
    // Extract plugin name before the @version segment
    const label = pluginId ? pluginId.split('@')[0] : 'plugin'
    return (
      <Badge
        variant="outline"
        className="h-auto min-h-0 gap-1 rounded-[var(--radius-sm)] border-transparent bg-[var(--accent-purple)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-purple)]"
      >
        <span>plugin</span>
        {pluginId ? <span className="normal-case">{label}</span> : null}
      </Badge>
    )
  }
  if (source === 'project') {
    return (
      <Badge
        variant="outline"
        className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--accent-green)]/10 px-2 py-0.5 text-[10px] font-semibold uppercase text-[var(--accent-green)]"
      >
        project
      </Badge>
    )
  }
  return null
}
