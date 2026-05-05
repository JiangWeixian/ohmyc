// Slide-in comparison panel — shows a side-by-side diff of two profiles' contents
// (agents, skills, commands, model config, plugins) with activate action.
import * as DialogPrimitive from '@radix-ui/react-dialog'
import { AnimatePresence, motion } from 'framer-motion'
import { X } from 'lucide-react'
import * as React from 'react'

import { cn } from '@/lib/utils'

import type { Profile } from '@ohmyc/shared'

/** Props for the {@link ComparePanel} component. */
interface ComparePanelProps {
  /** Whether the panel is visible. */
  open: boolean
  /** Callback to close the panel. */
  onClose: () => void
  /** The currently active profile (left side of diff). */
  activeProfile: Profile | null
  /** The profile being compared against (right side of diff). */
  targetProfile: Profile | null
  /** Callback to activate the target profile, replacing the active one. */
  onActivateTarget: () => void
}

// ---------------------------------------------------------------------------
// Overlay — animated backdrop that dims the page behind the panel
// ---------------------------------------------------------------------------

const CompareOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...properties }, reference) => (
  <DialogPrimitive.Overlay ref={reference} asChild {...properties}>
    <motion.div
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
      className={cn('fixed inset-0 z-50 bg-black/40', className)}
    />
  </DialogPrimitive.Overlay>
))
CompareOverlay.displayName = 'CompareOverlay'

// ---------------------------------------------------------------------------
// Content — animated panel that slides in from the right edge
// ---------------------------------------------------------------------------

const CompareContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...properties }, reference) => (
  <DialogPrimitive.Portal>
    <CompareOverlay />
    <DialogPrimitive.Content ref={reference} asChild {...properties}>
      <motion.div
        initial={{ x: '100%' }}
        animate={{ x: 0 }}
        exit={{ x: '100%' }}
        transition={{ duration: 0.2, ease: 'easeInOut' }}
        className={cn(
          'fixed right-0 top-0 h-full w-[480px] bg-[#191a1b] border-l border-[rgba(255,255,255,0.08)]',
          'shadow-2xl flex flex-col z-50',
          className,
        )}
      >
        {children}
      </motion.div>
    </DialogPrimitive.Content>
  </DialogPrimitive.Portal>
))
CompareContent.displayName = 'CompareContent'

// ---------------------------------------------------------------------------
// DiffSection — renders a single category diff (e.g. "Agents") between profiles
// ---------------------------------------------------------------------------

/** Renders a unified-diff view of one profile category. Items present only in
 *  the target are marked `+`, items only in the active profile are marked `−`,
 *  and shared items show `=`. */
function DiffSection({ title, activeItems, targetItems }: {
  title: string
  activeItems: string[]
  targetItems: string[]
}) {
  // Merge both lists into a unique set so every item appears once
  const allItems = [...new Set([...activeItems, ...targetItems])]

  if (allItems.length === 0) {
    return (
      <div className="py-4">
        <h4 className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#8a8f98] mb-2">{title}</h4>
        <p className="text-[13px] text-[#62666d]">No items</p>
      </div>
    )
  }

  return (
    <div className="py-4 border-b border-[rgba(255,255,255,0.05)] last:border-0">
      <h4 className="text-[12px] font-medium uppercase tracking-[0.04em] text-[#8a8f98] mb-3">{title}</h4>
      <div className="space-y-1">
        {allItems.map((item) => {
          const inActive = activeItems.includes(item)
          const inTarget = targetItems.includes(item)

          // Determine diff marker: + = added in target, − = removed in target, = = unchanged
          let marker = '='
          let markerClass = 'text-[#62666d]'

          if (inTarget && !inActive) {
            marker = '+'
            markerClass = 'text-[#f7f8f8]'
          } else if (inActive && !inTarget) {
            marker = '−'
            markerClass = 'text-[#8a8f98]'
          }

          return (
            <div key={item} className="flex items-center gap-2 font-mono text-[13px]">
              <span className={cn('w-4 text-center', markerClass)}>{marker}</span>
              <span className="text-[#d0d6e0]">{item}</span>
            </div>
          )
        })}
      </div>
    </div>
  )
}

// ---------------------------------------------------------------------------
// ComparePanel — public export, the full slide-in dialog
// ---------------------------------------------------------------------------

/** Slide-in panel that compares two profiles side-by-side, showing which
 *  agents, skills, commands, model configs, and plugins are added or removed. */
export function ComparePanel({ open, onClose, activeProfile, targetProfile, onActivateTarget }: ComparePanelProps) {
  if (!activeProfile || !targetProfile) {
    return null
  }

  const sections = [
    {
      title: 'Agents',
      activeItems: activeProfile.agents ?? [],
      targetItems: targetProfile.agents ?? [],
    },
    {
      title: 'Skills',
      activeItems: activeProfile.skills ?? [],
      targetItems: targetProfile.skills ?? [],
    },
    {
      title: 'Commands',
      activeItems: activeProfile.commands ?? [],
      targetItems: targetProfile.commands ?? [],
    },
    {
      title: 'Model Config',
      activeItems: activeProfile.modelConfig ? [activeProfile.modelConfig] : [],
      targetItems: targetProfile.modelConfig ? [targetProfile.modelConfig] : [],
    },
    {
      title: 'Plugins',
      activeItems: activeProfile.plugins ?? [],
      targetItems: targetProfile.plugins ?? [],
    },
  ]

  return (
    <DialogPrimitive.Root
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) {
          onClose()
        }
      }}
    >
      <AnimatePresence>
        {open && (
          <CompareContent>
            {/* Header */}
            <div className="flex items-center justify-between px-6 py-5 border-b border-[rgba(255,255,255,0.08)]">
              <h2 className="text-[24px] font-[510] text-[#f7f8f8]">
                Compare — {activeProfile.name} vs {targetProfile.name}
              </h2>
              <button
                onClick={onClose}
                className="rounded-full p-2 opacity-70 hover:opacity-100 hover:bg-[rgba(255,255,255,0.08)] transition-all"
              >
                <X size={18} className="text-[#d0d6e0]" />
              </button>
            </div>

            {/* Body */}
            <div className="flex-1 overflow-y-auto px-6 py-4">
              {sections.map(section => (
                <DiffSection
                  key={section.title}
                  title={section.title}
                  activeItems={section.activeItems}
                  targetItems={section.targetItems}
                />
              ))}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-6 py-4 border-t border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]">
              <button
                onClick={onClose}
                className="px-4 py-2 text-[13px] font-medium text-[#d0d6e0] hover:text-[#f7f8f8] hover:bg-[rgba(255,255,255,0.04)] rounded-md transition-all"
              >
                Close
              </button>
              <button
                onClick={onActivateTarget}
                className="px-4 py-2 text-[13px] font-medium bg-[#f7f8f8] text-[#08090a] hover:bg-[#d0d6e0] rounded-md transition-all"
              >
                Activate {targetProfile.name}
              </button>
            </div>
          </CompareContent>
        )}
      </AnimatePresence>
    </DialogPrimitive.Root>
  )
}
