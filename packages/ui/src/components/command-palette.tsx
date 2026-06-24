import { Command } from 'cmdk'
import { Search } from 'lucide-react'
import React, { useEffect, useState } from 'react'

import {
  NativeDialog,
  NativeDialogContent,
  NativeDialogDescription,
  NativeDialogTitle,
} from '@/components/uitripled/native-dialog'

export interface CommandItem {
  id: string
  label: string
  shortcut?: string
  icon?: React.ReactNode
  category?: string
  action: () => void
}

interface CommandPaletteProperties {
  commands: CommandItem[]
  placeholder?: string
}

const CommandPaletteContext = React.createContext<{
  // eslint-disable-next-line func-call-spacing
  open: () => void
  close: () => void
  isOpen: boolean
}>({
  open: () => {},
  close: () => {},
  isOpen: false,
})

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false)

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault()
        setIsOpen(previous => !previous)
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false)
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [isOpen])

  return (
    <CommandPaletteContext.Provider
      value={{
        open: () => setIsOpen(true),
        close: () => setIsOpen(false),
        isOpen,
      }}
    >
      {children}
    </CommandPaletteContext.Provider>
  )
}

// eslint-disable-next-line react-refresh/only-export-components
export function useCommandPalette() {
  return React.useContext(CommandPaletteContext)
}

export function CommandPalette({ commands, placeholder = 'Search commands...' }: CommandPaletteProperties) {
  const { isOpen, close } = useCommandPalette()

  const groupedCommands = React.useMemo(() => {
    const grouped: Record<string, CommandItem[]> = {}
    for (const cmd of commands) {
      const cat = cmd.category || 'Commands'
      grouped[cat] = grouped[cat] || []
      grouped[cat].push(cmd)
    }
    return Object.entries(grouped)
  }, [commands])

  return (
    <NativeDialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) {
          close()
        }
      }}
    >
      <NativeDialogContent motionPreset="instant" className="w-[calc(100vw-32px)] max-w-[720px] gap-0 overflow-hidden rounded-[var(--radius-xl)] border-[var(--border-default)] bg-[var(--surface-overlay)] p-0 sm:w-[calc(100vw-64px)] lg:w-[720px]">
        <NativeDialogTitle className="sr-only">Command palette</NativeDialogTitle>
        <NativeDialogDescription className="sr-only">
          Search and run OhMyC navigation and command actions.
        </NativeDialogDescription>
        <Command className="[&_[cmdk-group-heading]]:text-[11px] [&_[cmdk-group-heading]]:font-medium [&_[cmdk-group-heading]]:text-[var(--text-tertiary)] [&_[cmdk-group-heading]]:uppercase [&_[cmdk-group-heading]]:tracking-wide [&_[cmdk-group-heading]]:px-4 [&_[cmdk-group-heading]]:py-2">
          {/* Search Input */}
          <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)]">
            <Search size={18} className="text-[var(--text-tertiary)] shrink-0" />
            <Command.Input
              placeholder={placeholder}
              className="flex-1 bg-transparent text-[var(--text-primary)] text-[15px] placeholder:text-[var(--text-tertiary)] outline-none"
            />
            <kbd className="px-1.5 py-0.5 bg-[var(--surface-base)] border border-[var(--border-default)] rounded text-[10px] text-[var(--text-tertiary)]">esc</kbd>
          </div>

          {/* Commands List */}
          <Command.List className="max-h-80 overflow-y-auto py-2">
            <Command.Empty>
              <div className="px-4 py-8 text-center text-[var(--text-tertiary)] text-[14px]">No commands found</div>
            </Command.Empty>
            {/* Group commands by category */}
            {groupedCommands.map(([category, items]) => (
              <Command.Group key={category} heading={category}>
                {items.map(cmd => (
                  <Command.Item
                    key={cmd.id}
                    value={cmd.label}
                    keywords={[cmd.category || '']}
                    onSelect={() => {
                      cmd.action()
                      close()
                    }}
                    className="mx-1 flex cursor-pointer items-center gap-3 rounded px-4 py-2.5 text-[14px] text-[var(--text-primary)] data-[selected=true]:bg-[var(--bg-hover)]"
                  >
                    {cmd.icon && <span className="w-5 shrink-0 text-[var(--text-secondary)]">{cmd.icon}</span>}
                    <span className="min-w-0 flex-1 truncate">{cmd.label}</span>
                    {cmd.shortcut && (
                      <kbd className="shrink-0 rounded border border-[var(--border-default)] bg-[var(--surface-base)] px-1.5 py-0.5 font-mono text-[10px] text-[var(--text-tertiary)]">
                        {cmd.shortcut}
                      </kbd>
                    )}
                  </Command.Item>
                ))}
              </Command.Group>
            ))}
          </Command.List>

          {/* Footer */}
          <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-default)] bg-[var(--surface-base)]/50 text-[11px] text-[var(--text-tertiary)]">
            <span className="flex items-center gap-4">
              <span>↵ to select</span>
              <span>↑↓ to navigate</span>
            </span>
          </div>
        </Command>
      </NativeDialogContent>
    </NativeDialog>
  )
}
