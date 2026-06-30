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
  it.each([
    ['m', '/explore/monitor'],
    ['e', '/explore/agents'],
    ['a', '/explore/agents'],
    ['s', '/explore/skills'],
    ['c', '/explore/commands'],
    ['p', '/explore/plugins'],
    ['t', '/explore/timeline'],
  ])('maps g then %s to %s', (key, expectedPath) => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<ShortcutHarness />} />
      </Routes>,
      { route: '/menubar' },
    )

    fireEvent.keyDown(document, { key: 'g' })
    fireEvent.keyDown(document, { key })

    expect(screen.getByTestId('path')).toHaveTextContent(expectedPath)
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
