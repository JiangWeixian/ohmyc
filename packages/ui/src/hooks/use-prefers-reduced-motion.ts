// Shared prefers-reduced-motion subscription. Extracted so the onboarding gate
// and menubar onboard surface don't duplicate the helper, and to centralize the
// matchMedia guard (Tauri webviews always have matchMedia; tests polyfill it).
import { useSyncExternalStore } from 'react'

const REDUCED_QUERY = '(prefers-reduced-motion: reduce)'

function subscribe(callback: () => void): () => void {
  if (typeof globalThis.matchMedia !== 'function') {
    return () => {}
  }
  const mq = globalThis.matchMedia(REDUCED_QUERY)
  mq.addEventListener('change', callback)
  return () => mq.removeEventListener('change', callback)
}

function getSnapshot(): boolean {
  if (typeof globalThis.matchMedia !== 'function') {
    return false
  }
  return globalThis.matchMedia(REDUCED_QUERY).matches
}

/** True when the user prefers reduced motion (drives Atropos tilt + glitch). */
export function usePrefersReducedMotion(): boolean {
  return useSyncExternalStore(subscribe, getSnapshot, () => false)
}
