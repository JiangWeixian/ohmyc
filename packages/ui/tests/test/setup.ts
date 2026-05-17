import '@testing-library/jest-dom/vitest'

import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}

globalThis.ResizeObserver = ResizeObserverMock

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

afterEach(() => {
  cleanup()
  vi.clearAllMocks()
})
