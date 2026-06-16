import { fireEvent, screen } from '@testing-library/react'
import {
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { useGlobalKeyboardShortcuts } from '@/hooks/use-keyboard-shortcuts'

function ShortcutHarness() {
  useGlobalKeyboardShortcuts()
  const location = useLocation()

  return (
    <div>
      <div data-testid="path">{location.pathname}</div>
      <input aria-label="Search input" />
    </div>
  )
}

describe('useGlobalKeyboardShortcuts', () => {
  it('maps g then s to Skills from Explorer pages', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/explore/lsp' },
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/skills')
  })

  it('maps g then s to Skills outside Explorer pages', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/menubar' },
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/skills')
  })

  it('ignores shortcut sequences while an input is focused', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/explore/lsp' },
    )

    screen.getByLabelText('Search input').focus()
    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key: 's' })

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/lsp')
  })
})
