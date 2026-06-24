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
import { useIslandStore } from '@/state/island-store'

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
  useIslandStore.setState({ isHovered: false })
  useIslandStore.getState().hoverProgress.set(0)
})

describe('NavigationIsland', () => {
  it('renders all six keycap letters', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    for (const keycap of ['M', 'T', 'A', 'C', 'S', 'P']) {
      expect(screen.getByText(keycap)).toBeInTheDocument()
    }
  })

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

  it('navigates to Agents from the Explore group', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    fireEvent.click(screen.getByRole('link', { name: 'Agents' }))

    expect(screen.getByTestId('path')).toHaveTextContent('/explore/agents')
  })

  it('renders the command palette trigger', () => {
    renderWithProviders(
      <Routes>
        <Route path="*" element={<Harness />} />
      </Routes>,
      { route: '/explore/timeline' },
    )

    expect(screen.getByText('Cmd K')).toBeInTheDocument()
  })
})
