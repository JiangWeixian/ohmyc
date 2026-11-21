'use client'

import * as TooltipPrimitive from '@radix-ui/react-tooltip'
import * as React from 'react'

import { cn } from '@/lib/utils'

const TooltipProvider = TooltipPrimitive.Provider

// Self-contained: every Tooltip carries its own provider so call sites never
// hunt for a mount point (app root, popover window, stories, tests). The only
// cost is no shared delay group, which sparse icon tooltips don't need.
function Tooltip({ ...properties }: React.ComponentProps<typeof TooltipPrimitive.Root>) {
  return (
    <TooltipProvider>
      <TooltipPrimitive.Root data-slot="tooltip" {...properties} />
    </TooltipProvider>
  )
}

const TooltipTrigger = TooltipPrimitive.Trigger

const TooltipContent = React.forwardRef<
  React.ElementRef<typeof TooltipPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof TooltipPrimitive.Content>
>(({ className, sideOffset = 6, ...properties }, reference) => (
  <TooltipPrimitive.Portal>
    <TooltipPrimitive.Content
      ref={reference}
      data-slot="tooltip-content"
      sideOffset={sideOffset}
      className={cn(
        'z-50 max-w-64 rounded-md border border-[var(--border-standard)] bg-[var(--bg-surface)] px-2.5 py-1.5 font-mono-theme text-[10px] leading-[1.5] text-[var(--text-secondary)] shadow-md duration-100 motion-reduce:duration-0 motion-reduce:data-[state=delayed-open]:animate-none data-[state=delayed-open]:animate-in data-[state=delayed-open]:fade-in-0 data-[state=delayed-open]:zoom-in-95 data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=closed]:zoom-out-95 data-[side=bottom]:slide-in-from-top-1 data-[side=left]:slide-in-from-right-1 data-[side=right]:slide-in-from-left-1 data-[side=top]:slide-in-from-bottom-1',
        className,
      )}
      {...properties}
    />
  </TooltipPrimitive.Portal>
))
TooltipContent.displayName = TooltipPrimitive.Content.displayName

export { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger }
