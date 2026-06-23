// Command palette trigger button — opens the global ⌘K palette.
import { Search } from 'lucide-react'

import { useCommandPalette } from '@/components/command-palette'
import { cn } from '@/lib/utils'

/** Header search button that opens the global command palette (⌘K). */
export function CommandPaletteTrigger() {
  const { open } = useCommandPalette()

  return (
    <button
      onClick={open}
      className={cn(
        'w-60 h-9 rounded-md border border-[var(--border-standard)] bg-[var(--surface-raised)]',
        'flex items-center justify-between px-3 cursor-pointer',
        'hover:bg-[var(--bg-hover)] hover:border-[var(--border-hover)]',
        'transition-[background-color,border-color,color] duration-150 ease-out',
      )}
    >
      <div className="flex items-center gap-2">
        <Search size={14} className="text-[var(--text-tertiary)]" />
        <span className="text-[13px] text-[var(--text-tertiary)]">Search...</span>
      </div>
      <kbd
        className={cn(
          'text-[11px] font-[510] text-[var(--text-quaternary)]',
          'border border-[var(--border-standard)] rounded-sm px-1 py-0.5',
        )}
      >
        ⌘K
      </kbd>
    </button>
  )
}
