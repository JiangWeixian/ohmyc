import {
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
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

  it('collapses to one icon badge and expands back to full navigation', async () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand navigation' })).toHaveFocus()
    })

    fireEvent.click(screen.getByRole('button', { name: 'Expand navigation' }))

    await waitFor(() => {
      expect(screen.getByRole('navigation', { name: 'Primary' })).toBeInTheDocument()
    })
    expect(screen.getByRole('button', { name: 'Collapse navigation' })).toHaveFocus()
  })

  it('clears native macOS traffic lights in expanded and collapsed desktop states', async () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    const expandedIsland = screen.getByRole('navigation', { name: 'Primary' })
    expect(expandedIsland).toHaveClass('top-[48px]')
    expect(expandedIsland).toHaveClass('h-[calc(100dvh-66px)]')

    fireEvent.click(screen.getByRole('button', { name: 'Collapse navigation' }))

    let expandButton: HTMLButtonElement | null = null
    await waitFor(() => {
      expandButton = screen.getByRole('button', { name: 'Expand navigation' })
      expect(expandButton).toHaveClass('size-12')
    })

    expect(expandButton?.closest('div')).toHaveClass('top-[48px]')
    expect(expandButton?.querySelector('svg')).toHaveAttribute('width', '16')
    expect(expandButton?.querySelector('svg')).toHaveAttribute('height', '16')
  })

  it('collapses after route navigation on narrow screens', async () => {
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
    await waitFor(() => {
      expect(screen.getByRole('button', { name: 'Expand navigation' })).toBeInTheDocument()
    })
  })

  it('marks the shell as reduced motion when the user prefers reduced motion', () => {
    Object.defineProperty(globalThis, 'matchMedia', {
      configurable: true,
      value: vi.fn().mockImplementation(query => ({
        matches: query === '(prefers-reduced-motion: reduce)',
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

    expect(screen.getByRole('navigation', { name: 'Primary' })).toHaveAttribute('data-motion-mode', 'reduced')
  })
})
