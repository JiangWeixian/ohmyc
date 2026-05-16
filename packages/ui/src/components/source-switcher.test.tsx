import { render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import {
  beforeEach,
  describe,
  expect,
  it,
} from 'vitest'

import { REGISTERED_ORIGINS, useSources } from '../state/sources'
import { SourceSwitcher } from './source-switcher'

// jsdom doesn't implement these PointerEvent APIs that Radix uses; stub them
// so dropdown-menu interactions work under test.
beforeEach(() => {
  if (!('PointerEvent' in globalThis)) {
    // @ts-expect-error – minimal polyfill is sufficient for Radix's checks
    globalThis.PointerEvent = MouseEvent
  }
  Element.prototype.hasPointerCapture = Element.prototype.hasPointerCapture ?? (() => false)
  Element.prototype.releasePointerCapture = Element.prototype.releasePointerCapture ?? (() => {})
  Element.prototype.setPointerCapture = Element.prototype.setPointerCapture ?? (() => {})
  Element.prototype.scrollIntoView = Element.prototype.scrollIntoView ?? (() => {})
})

describe('SourceSwitcher', () => {
  beforeEach(() => {
    localStorage.clear()
    useSources.setState({ selected: new Set(REGISTERED_ORIGINS) })
  })

  it('renders "Source: All" when all origins are selected', () => {
    render(<SourceSwitcher />)
    expect(screen.getByRole('button')).toHaveTextContent(/Source:\s*All/i)
  })

  it('renders "Source: Claude" when only claude is selected', () => {
    useSources.setState({ selected: new Set(['claude']) })
    render(<SourceSwitcher />)
    expect(screen.getByRole('button')).toHaveTextContent(/Source:\s*Claude/i)
  })

  it('toggles an origin off when its checkbox is clicked', async () => {
    const user = userEvent.setup()
    render(<SourceSwitcher />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitemcheckbox', { name: /opencode/i }))
    expect(useSources.getState().selected.has('opencode')).toBe(false)
  })

  it('honors last-on guard — clicking the last remaining checkbox is a no-op', async () => {
    const user = userEvent.setup()
    useSources.setState({ selected: new Set(['claude']) })
    render(<SourceSwitcher />)
    await user.click(screen.getByRole('button'))
    await user.click(screen.getByRole('menuitemcheckbox', { name: /claude/i }))
    expect(useSources.getState().selected.has('claude')).toBe(true)
  })
})
