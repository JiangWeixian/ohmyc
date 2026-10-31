// Popover auto-height. The Tauri popover window is declared compact
// (367×340, resizable: false) but its content height varies at runtime —
// the Quota section alone adds up to ~200px depending on provider count.
// macOS-style popovers grow to fit content, so this hook observes the page
// root and reports its rendered height to the shell (set_popover_height).
// No-op outside the desktop shell (storybook, tests, plain browser).
import { useEffect, useRef } from 'react'

function isTauriShell(): boolean {
  return globalThis.window !== undefined && '__TAURI_INTERNALS__' in globalThis
}

export function usePopoverAutosize<TElement extends HTMLElement>() {
  const ref = useRef<TElement | null>(null)

  useEffect(() => {
    const el = ref.current
    if (!el || !isTauriShell() || typeof ResizeObserver === 'undefined') {
      return
    }
    let last = 0
    const report = async (height: number) => {
      try {
        // Tauri supplies this module at runtime in the desktop shell.
        // eslint-disable-next-line import/no-extraneous-dependencies
        const { invoke } = await import('@tauri-apps/api/core')
        await invoke('set_popover_height', { height })
      } catch {
        // Shell rejected the resize — content stays clipped rather than crashing.
      }
    }
    const measure = () => {
      const next = Math.ceil(el.getBoundingClientRect().height)
      // Sub-pixel jitter guard also breaks the resize→observe→resize loop.
      if (Math.abs(next - last) < 1) {
        return
      }
      last = next
      report(next)
    }
    measure()
    const observer = new ResizeObserver(measure)
    observer.observe(el)
    return () => observer.disconnect()
  }, [])

  return ref
}
