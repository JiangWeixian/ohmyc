// Reusable card for top-level entities (agents, skills, commands) shown in grids.
import React from 'react'

import { Card } from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { IconType } from './icons'

/** Properties for the {@link EntityCard} component. */
interface EntityCardProperties {
  icon: IconType
  iconAccentVar: string
  title: string
  description: string
  badges?: React.ReactNode
  onClick: () => void
}

/** Clickable card summarizing an entity (agent, skill, or command) with icon,
 *  title, description, and optional badge row. */
export function EntityCard({
  icon: Icon,
  title,
  description,
  badges,
  onClick,
}: EntityCardProperties) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'group relative cursor-pointer text-left p-7',
        'bg-[rgba(255,255,255,0.02)] border border-[rgba(255,255,255,0.08)] rounded-lg',
        'hover:border-[rgba(255,255,255,0.12)] hover:bg-[rgba(255,255,255,0.04)]',
        'transition-colors duration-150',
      )}
    >
      <div className="mb-3.5 flex items-start gap-3.5">
        <div className="flex size-10 shrink-0 items-center justify-center rounded-[10px] bg-[var(--text-primary)]">
          <Icon size={18} className="text-[var(--bg-marketing)]" />
        </div>
        <div className="min-w-0 flex-1 pt-0.5">
          <div className="text-[15px] font-[590] text-[var(--text-primary)] truncate">{title}</div>
          {badges && (
            <div className="mt-1 flex flex-wrap items-center gap-1.5">
              {badges}
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

// Re-export Badge and MonoBadge from dedicated file for backward compatibility
export { Badge, MonoBadge } from './badge'
