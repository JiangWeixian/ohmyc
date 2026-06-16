import { useCallback, useEffect } from 'react'

interface Shortcut {
  key: string
  label: string
  category: string
  action: () => void
}

const DEFAULT_SHORTCUTS: Shortcut[] = [
  { key: 'cmd+k', label: 'Command Palette', category: 'Global', action: () => {} },
  { key: 'g then a', label: 'Go to Agents', category: 'Navigation', action: () => {} },
  { key: 'g then s', label: 'Go to Skills', category: 'Navigation', action: () => {} },
  { key: 'g then c', label: 'Go to Commands', category: 'Navigation', action: () => {} },
  { key: 'escape', label: 'Close Dialog', category: 'Global', action: () => {} },
  { key: '?', label: 'Show Shortcuts', category: 'Global', action: () => {} },
]

export function useKeyboardShortcuts(customShortcuts?: Shortcut[]) {
  const shortcuts = customShortcuts || DEFAULT_SHORTCUTS

  const handleKeyDown = useCallback((e: KeyboardEvent) => {
    // Check for modifier keys
    const isMeta = e.metaKey || e.ctrlKey
    const key = e.key.toLowerCase()

    // Find matching shortcut
    const shortcut = shortcuts.find((s) => {
      const parts = s.key.toLowerCase().split('+')
      const hasModifiers = parts.length > 1

      if (hasModifiers) {
        const modifier = parts[0]
        const mainKey = parts.slice(1).join('+')
        if (modifier === 'cmd') {
          return isMeta && key === mainKey
        }
        if (modifier === 'ctrl') {
          return e.ctrlKey && key === mainKey
        }
        if (modifier === 'shift') {
          return e.shiftKey && key === mainKey
        }
        if (modifier === 'alt') {
          return e.altKey && key === mainKey
        }
        return key === mainKey
      }
      return key === s.key.toLowerCase()
    })

    if (shortcut) {
      e.preventDefault()
      shortcut.action()
    }
  }, [shortcuts])

  useEffect(() => {
    globalThis.addEventListener('keydown', handleKeyDown)
    return () => {
      globalThis.removeEventListener('keydown', handleKeyDown)
    }
  }, [handleKeyDown])

  return shortcuts
}
