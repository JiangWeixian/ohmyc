import React from 'react'

import { Badge as ShadcnBadge } from '@/components/ui/badge'
import { cn } from '@/lib/utils'

const colorClasses = {
  default: 'text-[var(--text-tertiary)] bg-[var(--surface-overlay)]',
  blue: 'text-[var(--accent-blue)] bg-[var(--accent-blue)]/10',
  purple: 'text-[var(--accent-purple)] bg-[var(--accent-purple)]/10',
  green: 'text-[var(--accent-green)] bg-[var(--accent-green)]/10',
  amber: 'text-[var(--accent-amber)] bg-[var(--accent-amber)]/10',
} as const

type BadgeVariant = keyof typeof colorClasses

interface BadgeProperties {
  children: React.ReactNode
  variant?: BadgeVariant
}

export function Badge({ children, variant = 'default' }: BadgeProperties) {
  return (
    <ShadcnBadge
      variant="outline"
      className={cn(
        'h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent px-2 py-0.5 text-[10px] font-semibold uppercase',
        colorClasses[variant],
      )}
    >
      {children}
    </ShadcnBadge>
  )
}

export function MonoBadge({ children }: { children: React.ReactNode }) {
  return (
    <ShadcnBadge
      variant="outline"
      className="h-auto min-h-0 rounded-[var(--radius-sm)] border-transparent bg-[var(--surface-panel)] px-2 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]"
    >
      {children}
    </ShadcnBadge>
  )
}
