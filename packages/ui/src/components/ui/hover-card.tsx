import React from 'react'

import { cn } from '@/lib/utils'

interface HoverCardProperties {
  children: React.ReactNode
  className?: string
  onClick?: () => void
}

/**
 * A card with a smooth hover effect using CSS transitions.
 * Perfect for interactive elements like cards, buttons, or items.
 */
export function HoverCard({
  children,
  className,
  onClick,
}: HoverCardProperties) {
  return (
    <div
      onClick={onClick}
      className={cn(
        'transition-transform duration-150',
        'hover:-translate-y-0.5 hover:shadow-[var(--shadow-md)]',
        onClick ? 'cursor-pointer' : 'cursor-default',
        className,
      )}
    >
      {children}
    </div>
  )
}
