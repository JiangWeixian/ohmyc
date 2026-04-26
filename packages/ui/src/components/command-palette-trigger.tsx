import { Search } from 'lucide-react'

import { useCommandPalette } from '@/components/ui/command-palette'
import { cn } from '@/lib/utils'

export function CommandPaletteTrigger() {
  const { open } = useCommandPalette()

  return (
    <button
      onClick={open}
      className={cn(
        'w-60 h-9 rounded-md border border-[rgba(255,255,255,0.08)] bg-[rgba(255,255,255,0.02)]',
        'flex items-center justify-between px-3 cursor-pointer',
        'hover:bg-[rgba(255,255,255,0.04)] hover:border-[rgba(255,255,255,0.14)]',
        'transition-all duration-150',
      )}
    >
      <div className="flex items-center gap-2">
        <Search size={14} className="text-[#8a8f98]" />
        <span className="text-[13px] text-[#8a8f98]">Search...</span>
      </div>
      <kbd
        className={cn(
          'text-[11px] font-[510] text-[#62666d]',
          'border border-[rgba(255,255,255,0.08)] rounded-sm px-1 py-0.5',
        )}
      >
        ⌘K
      </kbd>
    </button>
  )
}
