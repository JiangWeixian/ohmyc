import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

const localStorageState = new Map<string, string>()
const localStorageMock: Storage = {
  get length() {
    return localStorageState.size
  },
  clear() {
    localStorageState.clear()
  },
  getItem(key) {
    return localStorageState.get(key) ?? null
  },
  key(index) {
    return [...localStorageState.keys()][index] ?? null
  },
  removeItem(key) {
    localStorageState.delete(key)
  },
  setItem(key, value) {
    localStorageState.set(key, value)
  },
}

Object.defineProperty(globalThis, 'localStorage', {
  value: localStorageMock,
  configurable: true,
})

// jsdom doesn't implement these PointerEvent APIs that Radix uses; stub them
// so dropdown-menu interactions work under test. Guards keep this idempotent.
if (!('PointerEvent' in globalThis)) {
  // @ts-expect-error – minimal polyfill is sufficient for Radix's checks
  globalThis.PointerEvent = MouseEvent
}
if (!Element.prototype.hasPointerCapture) {
  Element.prototype.hasPointerCapture = () => false
}
if (!Element.prototype.releasePointerCapture) {
  Element.prototype.releasePointerCapture = () => {}
}
if (!Element.prototype.setPointerCapture) {
  Element.prototype.setPointerCapture = () => {}
}
if (!Element.prototype.scrollIntoView) {
  Element.prototype.scrollIntoView = () => {}
}

// jsdom does not implement matchMedia; components using useSyncExternalStore
// over a media query (e.g. prefers-reduced-motion) need it to render in tests.
if (!globalThis.matchMedia) {
  // @ts-expect-error – minimal stub is sufficient for reads + subscriptions
  globalThis.matchMedia = (query: string) => ({
    matches: false,
    media: query,
    onchange: null,
    addEventListener: () => {},
    removeEventListener: () => {},
    addListener: () => {},
    removeListener: () => {},
    dispatchEvent: () => false,
  })
}

// jsdom does not implement canvas.getContext (would log a not-implemented error
// that fails tests). LetterGlitch bails out gracefully when getContext is null.
HTMLCanvasElement.prototype.getContext = function getContext() {
  return null
}

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
