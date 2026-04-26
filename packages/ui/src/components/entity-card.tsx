import { ChevronRight } from 'lucide-react'
import React from 'react'

import {
  Card,
  CardContent,
  CardFooter,
  CardHeader,
} from '@/components/ui/card'
import { cn } from '@/lib/utils'

import type { IconType } from './icons'

interface EntityCardProperties {
  icon: IconType
  iconAccentVar: string
  title: string
  description: string
  badges?: React.ReactNode
  featured?: boolean
  onClick: () => void
}

export function EntityCard({
  icon: Icon,
  iconAccentVar,
  title,
  description,
  badges,
  featured = false,
  onClick,
}: EntityCardProperties) {
  return (
    <Card
      onClick={onClick}
      className={cn(
        'panel group relative cursor-pointer text-left transition-smooth',
        'hover:border-[var(--border-hover)] hover:bg-[rgba(255,255,255,0.04)]',
        'active:scale-[0.992] active:transition-transform',
        'py-0 p-7',
        featured && 'md:col-span-2 lg:col-span-1',
      )}
    >
      <CardHeader className="mb-0 pb-0">
        <div className="flex items-start justify-between gap-4">
          <div
            className="flex size-11 items-center justify-center rounded-lg border border-[var(--border-standard)] bg-[rgba(255,255,255,0.02)] transition-all duration-300 group-hover:border-[rgba(255,255,255,0.15)]"
            style={iconAccentVar ? { '--icon-accent': `var(${iconAccentVar})` } as React.CSSProperties : undefined}
          >
            <Icon
              size={18}
              className="text-[var(--text-secondary)] transition-colors duration-300 group-hover:text-[var(--icon-accent,var(--text-primary))]"
            />
          </div>
          {badges && <div className="flex flex-wrap justify-end gap-1.5">{badges}</div>}
        </div>
      </CardHeader>
      <CardContent className="mt-6">
        <h3 className="text-[16px] font-semibold tracking-[-0.01em] text-[var(--text-primary)]">{title}</h3>
        <p className="text-pretty mt-3 min-h-[44px] text-[14px] leading-relaxed text-[var(--text-secondary)] line-clamp-2">
          {description}
        </p>
      </CardContent>
      <CardFooter className="mt-6 border-0 bg-transparent p-0">
        <div className="flex items-center text-[13px] font-medium text-[var(--text-secondary)] transition-transform duration-200 group-hover:translate-x-0.5 group-hover:text-[var(--text-primary)]">
          View details
          <ChevronRight size={14} className="ml-1 transition-transform duration-200 group-hover:translate-x-0.5" />
        </div>
      </CardFooter>
    </Card>
  )
}

// Re-export Badge and MonoBadge from dedicated file for backward compatibility
export { Badge, MonoBadge } from './badge'
