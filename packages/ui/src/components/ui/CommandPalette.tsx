import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Search, CornerDownLeft, Command } from 'lucide-react';
import { cn } from '@/lib/utils';

interface CommandItem {
  id: string;
  label: string;
  shortcut?: string;
  icon?: React.ReactNode;
  category?: string;
  action: () => void;
}

interface CommandPaletteProps {
  commands: CommandItem[];
  placeholder?: string;
}

const CommandPaletteContext = React.createContext<{
  open: () => void;
  close: () => void;
  isOpen: boolean;
}>({
  open: () => {},
  close: () => {},
  isOpen: false,
});

export function CommandPaletteProvider({ children }: { children: React.ReactNode }) {
  const [isOpen, setIsOpen] = useState(false);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if ((e.metaKey || e.ctrlKey) && e.key === 'k') {
        e.preventDefault();
        setIsOpen((prev) => !prev);
      }
      if (e.key === 'Escape' && isOpen) {
        setIsOpen(false);
      }
    };

    document.addEventListener('keydown', handleKeyDown);
    return () => document.removeEventListener('keydown', handleKeyDown);
  }, [isOpen]);

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
  );
}

export function useCommandPalette() {
  return React.useContext(CommandPaletteContext);
}

export function CommandPalette({ commands, placeholder = 'Search commands...' }: CommandPaletteProps) {
  const { isOpen, close } = useCommandPalette();
  const [search, setSearch] = useState('');
  const [selectedIndex, setSelectedIndex] = useState(0);

  const filteredCommands = useMemo(() => {
    if (!search) return commands;
    const lowerSearch = search.toLowerCase();
    return commands.filter(
      (cmd) =>
        cmd.label.toLowerCase().includes(lowerSearch) ||
        cmd.category?.toLowerCase().includes(lowerSearch)
    );
  }, [commands, search]);

  const groupedCommands = useMemo(() => {
    const groups: Record<string, CommandItem[]> = {};
    filteredCommands.forEach((cmd) => {
      const category = cmd.category || 'Commands';
      if (!groups[category]) groups[category] = [];
      groups[category].push(cmd);
    });
    return groups;
  }, [filteredCommands]);

  useEffect(() => {
    setSelectedIndex(0);
  }, [search]);

  useEffect(() => {
    if (!isOpen) {
      setSearch('');
      setSelectedIndex(0);
    }
  }, [isOpen]);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      switch (e.key) {
        case 'ArrowDown':
          e.preventDefault();
          setSelectedIndex((prev) => (prev + 1) % filteredCommands.length);
          break;
        case 'ArrowUp':
          e.preventDefault();
          setSelectedIndex((prev) => (prev - 1 + filteredCommands.length) % filteredCommands.length);
          break;
        case 'Enter':
          e.preventDefault();
          if (filteredCommands[selectedIndex]) {
            filteredCommands[selectedIndex].action();
            close();
          }
          break;
        case 'Escape':
          e.preventDefault();
          close();
          break;
      }
    },
    [filteredCommands, selectedIndex, close]
  );

  if (!isOpen) return null;

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        transition={{ duration: 0.15 }}
        className="fixed inset-0 z-50"
        onClick={close}
      >
        {/* Backdrop */}
        <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" />

        {/* Modal */}
        <motion.div
          initial={{ opacity: 0, scale: 0.96, y: -20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.96, y: -20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className="absolute left-1/2 top-[20%] -translate-x-1/2 w-full max-w-xl"
          onClick={(e) => e.stopPropagation()}
        >
          <div
            className={cn(
              'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
              'rounded-[var(--radius-xl)] shadow-2xl overflow-hidden',
              'border border-[var(--border-hover)]'
            )}
          >
            {/* Search Input */}
            <div className="flex items-center gap-3 px-4 py-3 border-b border-[var(--border-default)]">
              <Search size={18} className="text-[var(--text-tertiary)]" />
              <input
                type="text"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                onKeyDown={handleKeyDown}
                placeholder={placeholder}
                className={cn(
                  'flex-1 bg-transparent text-[var(--text-primary)] text-[15px]',
                  'placeholder:text-[var(--text-tertiary)] outline-none'
                )}
                autoFocus
              />
              <div className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                <kbd className="px-1.5 py-0.5 bg-[var(--surface-base)] border border-[var(--border-default)] rounded text-[10px]">
                  esc
                </kbd>
              </div>
            </div>

            {/* Commands List */}
            <div className="max-h-80 overflow-y-auto py-2">
              {Object.entries(groupedCommands).map(([category, items]) => (
                <div key={category}>
                  <div className="px-4 py-2 text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide">
                    {category}
                  </div>
                  {items.map((cmd, idx) => {
                    const globalIndex = filteredCommands.indexOf(cmd);
                    return (
                      <motion.button
                        key={cmd.id}
                        initial={{ opacity: 0, x: -10 }}
                        animate={{ opacity: 1, x: 0 }}
                        transition={{ delay: idx * 0.03 }}
                        onClick={() => {
                          cmd.action();
                          close();
                        }}
                        className={cn(
                          'w-full flex items-center gap-3 px-4 py-2.5 text-left',
                          'transition-colors duration-100',
                          globalIndex === selectedIndex
                            ? 'bg-[var(--accent-blue)]/15 text-[var(--accent-blue)]'
                            : 'text-[var(--text-primary)] hover:bg-[var(--surface-raised)]'
                        )}
                      >
                        {cmd.icon && (
                          <span className="text-[var(--text-secondary)] w-5">{cmd.icon}</span>
                        )}
                        <span className="flex-1 text-[14px]">{cmd.label}</span>
                        {cmd.shortcut && (
                          <div className="flex items-center gap-1 text-[11px] text-[var(--text-tertiary)]">
                            <kbd className="px-1.5 py-0.5 bg-[var(--surface-base)] border border-[var(--border-default)] rounded text-[10px] font-mono">
                              {cmd.shortcut}
                            </kbd>
                          </div>
                        )}
                      </motion.button>
                    );
                  })}
                </div>
              ))}
              {filteredCommands.length === 0 && (
                <div className="px-4 py-8 text-center text-[var(--text-tertiary)] text-[14px]">
                  No commands found
                </div>
              )}
            </div>

            {/* Footer */}
            <div className="flex items-center justify-between px-4 py-2 border-t border-[var(--border-default)] bg-[var(--surface-base)]/50">
              <div className="flex items-center gap-4 text-[11px] text-[var(--text-tertiary)]">
                <span className="flex items-center gap-1">
                  <CornerDownLeft size={12} />
                  to select
                </span>
                <span className="flex items-center gap-1">
                  <span>↑↓</span>
                  to navigate
                </span>
              </div>
            </div>
          </div>
        </motion.div>
      </motion.div>
    </AnimatePresence>
  );
}

// Keyboard shortcut hint component
export function KeyboardShortcut({ shortcut }: { shortcut: string }) {
  const keys = shortcut.split('+');
  return (
    <div className="flex items-center gap-0.5">
      {keys.map((key, i) => (
        <React.Fragment key={key}>
          <kbd
            className={cn(
              'px-1.5 py-0.5 text-[10px] font-mono',
              'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
              'rounded-[var(--radius-sm)] text-[var(--text-tertiary)]'
            )}
          >
            {key === 'meta' ? '⌘' : key === 'ctrl' ? 'Ctrl' : key === 'shift' ? '⇧' : key}
          </kbd>
          {i < keys.length - 1 && <span className="text-[var(--text-tertiary)] mx-0.5">+</span>}
        </React.Fragment>
      ))}
    </div>
  );
}
