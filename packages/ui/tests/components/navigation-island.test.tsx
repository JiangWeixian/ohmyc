import { fireEvent, screen } from '@testing-library/react'
import {
  Route,
  Routes,
  useLocation,
} from 'react-router-dom'
import {
  afterEach,
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { CommandPaletteProvider } from '@/components/command-palette'
import { NavigationIsland } from '@/components/navigation-island'

function Harness() {
  const location = useLocation()
  return (
    <CommandPaletteProvider>
      <NavigationIsland />
      <div data-testid="path">{location.pathname}</div>
    </CommandPaletteProvider>
  )
}

afterEach(() => {
  vi.restoreAllMocks()
})

describe('NavigationIsland', () => {
  it('navigates to Monitor from the Signal group', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('link', { name: 'Monitor' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/monitor')
  })

  it('collapses to one icon badge and expands back to full navigation', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus()

    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }))

    expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveFocus()
  })

  it('collapses after route navigation on narrow screens', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(max-width: 767px)',
        media: query,
        onchange: null,
        addListener: vi.fn(),
        removeListener: vi.fn(),
        addEventListener: vi.fn(),
        removeEventListener: vi.fn(),
        dispatchEvent: vi.fn(),
      })),
    })

    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('link', { name: 'Monitor' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/monitor')
    expect(screen.queryByRole('navigation', { name: 'Primary' })).not.toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
  })
})
