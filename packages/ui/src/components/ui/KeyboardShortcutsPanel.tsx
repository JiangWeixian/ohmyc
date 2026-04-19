import React from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { X, Command, ArrowLeft } from 'lucide-react';
import { cn } from '@/lib/utils';

interface ShortcutItem {
  key: string;
  label: string;
  category: string;
}

interface KeyboardShortcutsPanelProps {
  isOpen: boolean;
  onClose: () => void;
  shortcuts: ShortcutItem[];
}

export function KeyboardShortcutsPanel({
  isOpen,
  onClose,
  shortcuts,
}: KeyboardShortcutsPanelProps) {
  if (!isOpen) return null;

  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  return (
    <AnimatePresence>
      <motion.div
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
        className="fixed inset-0 z-50 flex items-center justify-center"
        onClick={onClose}
      >
        <motion.div
          initial={{ opacity: 0, scale: 0.95, y: 20 }}
          animate={{ opacity: 1, scale: 1, y: 0 }}
          exit={{ opacity: 0, scale: 0.95, y: -20 }}
          transition={{ duration: 0.2, ease: [0.16, 1, 0.3, 1] }}
          className={cn(
            'bg-[var(--surface-overlay)] border border-[var(--border-default)]',
            'rounded-[var(--radius-xl)] shadow-2xl',
            'w-full max-w-lg overflow-hidden'
          )}
        >
          <div className="flex items-center justify-between px-6 py-4 border-b border-[var(--border-default)]">
            <h2 className="text-lg font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</h2>
            <button
              onClick={onClose}
              className="p-2 hover:bg-[var(--surface-raised)] rounded-[var(--radius-md)] transition-colors"
            >
              <X size={18} className="text-[var(--text-tertiary)]" />
            </button>
          </div>

          <div className="p-6 max-h-[60vh] overflow-y-auto">
            {Object.entries(groupedShortcuts).map(([category, items]) => (
              <div key={category} className="mb-4">
                <div className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide px-2">
                  {category}
                </div>
                <div className="space-y-1">
                  {items.map((shortcut, index) => (
                    <motion.div
                      key={shortcut.key}
                      initial={{ opacity: 0, x: -10 }}
                      animate={{ opacity: 1, x: 0 }}
                      transition={{ delay: index * 0.03, duration: 0.15 }}
                      className={cn(
                        'flex items-center justify-between px-3 py-2.5 rounded-[var(--radius-md)]',
                        'hover:bg-[var(--surface-raised)] transition-colors'
                      )}
                    >
                      <div className="flex items-center gap-3">
                        <kbd className="text-[11px] font-mono text-[var(--text-secondary)] bg-[var(--surface-base)] px-2 py-1 rounded-[var(--radius-sm)]">
                          {shortcut.key}
                        </kbd>
                        <span className="text-[14px] text-[var(--text-primary)]">{shortcut.label}</span>
                      </div>
                    </motion.div>
                  ))}
                </div>
              ))}
            </div>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
