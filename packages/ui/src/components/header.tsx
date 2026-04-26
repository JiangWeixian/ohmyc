import { ActiveProfileChip } from './active-profile-chip'
import { CommandPaletteTrigger } from './command-palette-trigger'
import { cn } from '@/lib/utils'

interface HeaderProps {
  onCompare?: () => void
}

export function Header({ onCompare }: HeaderProps) {
  return (
    <header
      className={cn(
        'h-16 bg-[#0f1011] border-b border-[rgba(255,255,255,0.05)]',
        'flex items-center justify-between px-6 shrink-0',
      )}
    >
      <div className="flex-1" />
      <div className="flex items-center gap-3">
        <CommandPaletteTrigger />
        <ActiveProfileChip onCompare={onCompare} />
      </div>
    </header>
  )
}
