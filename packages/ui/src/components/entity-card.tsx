// Reusable card for top-level entities (agents, skills, commands) shown in grids.
import { AgentGlyph } from './agent-glyph'
import { RenderBadgeView } from './render-badge'
import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { Origin, RenderBadge } from '@ohmyc/shared'
import type { IconType } from './icons'

/** Properties for the {@link EntityCard} component. */
interface EntityCardProperties {
  icon: IconType
  iconAccentVar: string
  title: string
  description: string
  origins?: Origin[]
  renderBadges?: RenderBadge[]
  onClick: () => void
}

/** Clickable card summarizing an entity (agent, skill, or command) with icon,
 *  title, description, origin icons, and provider-supplied badges. */
export function EntityCard({
  icon: Icon,
  title,
  description,
  origins,
  renderBadges,
  onClick,
}: EntityCardProperties) {
  const hasOrigins = Boolean(origins && origins.length > 0)
  const hasBadges = hasOrigins || (renderBadges && renderBadges.length > 0)

  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer text-left p-7',
        'bg-[var(--surface-raised)] border border-[var(--border-standard)] rounded-lg',
        'hover:border-[var(--border-hover)] hover:bg-[var(--bg-hover)]',
        'transition-colors duration-150',
      )}
    >
      <div className="mb-3.5 flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--text-primary)]">
          <Icon size={18} className="text-[var(--bg-marketing)]" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="font-display truncate text-[15px] font-[590] text-[var(--text-primary)]">{title}</div>
          {hasBadges && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {hasOrigins && (
                <span className="inline-flex items-center gap-1">
                  {origins!.map(origin => (
                    <span
                      key={origin}
                      title={origin}
                      aria-label={origin}
                      className="inline-flex size-4 items-center justify-center text-[var(--text-tertiary)]"
                    >
                      <AgentGlyph name={origin} size={12} />
                    </span>
                  ))}
                </span>
              )}
              {renderBadges?.map((b, idx) => (
                <RenderBadgeView key={`${b.kind}-${b.label}-${idx}`} badge={b} />
              ))}
            </div>
          )}
        </div>
      </div>
      <p className="text-[13px] leading-[1.55] text-[var(--text-secondary)] line-clamp-3">
        {description}
      </p>
    </Card>
  )
}
