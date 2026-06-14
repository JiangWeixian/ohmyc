// Global keyboard shortcut hook — implements `g`-prefixed navigation (g-e, g-s).
import { useEffect } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

/**
 * Sets up global `g`-prefixed keyboard navigation:
 * - `g` then `e` → Explorer (Agents)
 * - `g` then `s` → Settings
 *
 * Silently ignored when an input, textarea, or contenteditable is focused.
 */
export function useGlobalKeyboardShortcuts() {
  const navigate = useNavigate()
  const location = useLocation()

  useEffect(() => {
    let gPressed = false
    // Reset the `g` prefix after 1 s to avoid trapping accidental keypresses.
    let gTimeout: ReturnType<typeof setTimeout> | null = null

    const isInputFocused = () => {
      const el = document.activeElement
      return (
        el instanceof HTMLInputElement
        || el instanceof HTMLTextAreaElement
        || el?.getAttribute('contenteditable') === 'true'
      )
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (isInputFocused()) {
        return
      }

      // Handle 'g' prefix for navigation
      if (e.key === 'g' && !gPressed) {
        gPressed = true
        gTimeout = setTimeout(() => {
          gPressed = false
        }, 1000)
        return
      }

      if (gPressed) {
        // Second key after `g` — consume the pending prefix and dispatch navigation.
        gPressed = false
        if (gTimeout) {
          clearTimeout(gTimeout)
          gTimeout = null
        }

        if (e.key === 'e') {
          e.preventDefault()
          navigate('/explore/agents')
          return
        }
        if (e.key === 's') {
          e.preventDefault()
          // `g-s` is context-aware: goes to Explorer settings inside /explore, global settings otherwise.
          if (location.pathname.startsWith('/explore')) {
            navigate('/explore/settings')
          } else {
            navigate('/settings')
          }
        }
      }
    }

    document.addEventListener('keydown', handleKeyDown)
    return () => {
      document.removeEventListener('keydown', handleKeyDown)
      if (gTimeout) {
        clearTimeout(gTimeout)
      }
    }
  }, [navigate, location.pathname])
}
