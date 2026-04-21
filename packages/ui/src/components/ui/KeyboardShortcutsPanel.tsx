import React from 'react';
import { NativeDialog, NativeDialogContent, NativeDialogTitle } from '@/components/uitripled/native-dialog';
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
  // Group shortcuts by category
  const groupedShortcuts = shortcuts.reduce((acc, shortcut) => {
    if (!acc[shortcut.category]) {
      acc[shortcut.category] = [];
    }
    acc[shortcut.category].push(shortcut);
    return acc;
  }, {} as Record<string, ShortcutItem[]>);

  return (
    <NativeDialog open={isOpen} onOpenChange={(open) => { if (!open) onClose(); }}>
      <NativeDialogContent className="bg-[var(--surface-overlay)] border-[var(--border-default)] rounded-[var(--radius-xl)] w-full max-w-lg overflow-hidden p-0 gap-0">
        <div className="px-6 py-4 border-b border-[var(--border-default)]">
          <NativeDialogTitle className="text-lg font-semibold text-[var(--text-primary)]">Keyboard Shortcuts</NativeDialogTitle>
        </div>

        <div className="p-6 max-h-[60vh] overflow-y-auto">
          {Object.entries(groupedShortcuts).map(([category, items]) => (
            <div key={category} className="mb-4">
              <div className="text-[11px] font-medium text-[var(--text-tertiary)] uppercase tracking-wide px-2">
                {category}
              </div>
              <div className="space-y-1">
                {items.map((shortcut) => (
                  <div
                    key={shortcut.key}
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
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </NativeDialogContent>
    </NativeDialog>
  );
}
