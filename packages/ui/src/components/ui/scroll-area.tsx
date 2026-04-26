'use client'

import * as React from 'react'

import { cn } from '@/lib/utils'

const ScrollArea = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, children, ...properties }, reference) => (
  <div
    ref={reference}
    data-slot="scroll-area"
    className={cn('relative overflow-hidden h-full', className)}
    {...properties}
  >
    <div className="h-full w-full overflow-auto [&::-webkit-scrollbar]:w-2 [&::-webkit-scrollbar]:h-2 [&::-webkit-scrollbar-thumb]:rounded-full [&::-webkit-scrollbar-thumb]:bg-border [&::-webkit-scrollbar-track]:bg-transparent">
      {children}
    </div>
  </div>
))
ScrollArea.displayName = 'ScrollArea'

const ScrollBar = React.forwardRef<
  HTMLDivElement,
  React.HTMLAttributes<HTMLDivElement>
>(({ className, ...properties }, reference) => (
  <div
    ref={reference}
    data-slot="scroll-area-scrollbar"
    className={cn('flex touch-none select-none transition-colors', className)}
    {...properties}
  />
))
ScrollBar.displayName = 'ScrollBar'

export { ScrollArea, ScrollBar }
