import React from 'react';
import { useEffect, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';

interface Shortcut {
  key: string;
  label: string;
  category: string;
  action: () => void;
}

interface KeyboardShortcutsProps {
  shortcuts?: Shortcut[];
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'cmd+k', label: 'Command Palette', category: 'Global', action: () => {} },
  { key: 'g then a', label: 'Go to Agents', category: 'Navigation', action: () => {} },
  { key: 'g then s', label: 'Go to Skills', category: 'Navigation', action: () => {} },
  { key: 'g then c', label: 'Go to Commands', category: 'Navigation', action: () => {} },
  { key: 'g then p', label: 'Go to Profiles', category: 'Navigation', action: () => {} },
  { key: 'escape', label: 'Close Dialog', category: 'Global', action: () => {} },
  { key: '?', label: 'Show Shortcuts', category: 'Global', action: () => {} },
];

export function useKeyboardShortcuts(customShortcuts?: Shortcut[]) {
  const navigate = useNavigate();

  const shortcuts = customShortcuts || DEFAULT_SHORTCUTS;

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for modifier keys
    const isMeta = e.metaKey || e.ctrlKey;
    const key = e.key.toLowerCase();

    // Find matching shortcut
    const shortcut = shortcuts.find((s) => {
      const parts = s.key.toLowerCase().split('+');
      const hasModifiers = parts.length > 1;

      if (hasModifiers) {
        const modifier = parts[0];
        const mainKey = parts.slice(1).join('+');
        return (
          (modifier === 'cmd' ? isMeta : key === mainKey) ||
          (modifier === 'ctrl' ? e.ctrlKey && key === mainKey) :
          (modifier === 'shift' ? e.shiftKey && key === mainKey) :
          (modifier === 'alt' ? e.altKey && key === mainKey) :
          (!hasModifiers && key === mainKey)
        );
      }, [isMeta, e.ctrlKey, e.shiftKey, e.altKey, key]);

    if (shortcut) {
      e.preventDefault();
      shortcut.action();
    }
  }, [shortcuts, navigate]);

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => {
      window.removeEventListener('keydown', handleKeyDown);
    };
  }, [handleKeyDown]);

  return shortcuts;
}

