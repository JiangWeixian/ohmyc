// Styled badge variants — monospace badges for entity metadata.
import React from 'react'

import { Badge as ShadcnBadge } from '@/components/ui/badge'

/** Monospace badge for technical values (e.g. file extensions, version strings). */
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
