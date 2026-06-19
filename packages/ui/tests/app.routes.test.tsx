import {
  fireEvent,
  screen,
  waitFor,
} from '@testing-library/react'
import React from 'react'
import { useLocation } from 'react-router-dom'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from './test/render-with-providers'
import { App } from '@/app'

vi.mock('@/explorer', () => ({
  Explorer: () => {
    const location = useLocation()
    return <div data-testid="explorer-route">{location.pathname}</div>
  },
}))

vi.mock('@/components/menubar/menubar-page', () => ({
  MenubarPage: () => <div data-testid="menubar-route">Menubar route</div>,
}))

vi.mock('@/hooks/use-agents', () => ({
  useAgents: () => ({ data: [] }),
}))

vi.mock('@/hooks/use-skills', () => ({
  useSkills: () => ({ data: [] }),
}))

vi.mock('@/hooks/use-commands', () => ({
  useCommands: () => ({ data: [] }),
}))

describe('App routes', () => {
  it('redirects unknown paths to the Explorer timeline fallback', async () => {
    renderWithProviders(<App />, { route: '/legacy/missing' })

    await waitFor(() => {
      expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
    })
  })

  it('keeps /explore routed through Explorer', async () => {
    renderWithProviders(<App />, { route: '/explore' })

    await waitFor(() => {
      expect(screen.getByTestId('explorer-route')).toBeInTheDocument()
    })
  })

  it('navigates to Monitor from the command palette', async () => {
    renderWithProviders(<App />, { route: '/menubar' })

    fireEvent.keyDown(document, { key: 'k', metaKey: true })

    const monitorItem = await screen.findByText('Monitor')
    expect(screen.getByText('g m')).toBeInTheDocument()

    fireEvent.click(monitorItem)

    await waitFor(() => {
      expect(screen.getByTestId('explorer-route')).toHaveTextContent('/explore/monitor')
    })
  })
})
