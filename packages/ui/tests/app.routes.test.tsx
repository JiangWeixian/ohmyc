import { screen, waitFor } from '@testing-library/react'
import React from 'react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from './test/render-with-providers'
import { App } from '@/app'

vi.mock('@/explorer', () => ({
  Explorer: () => <div data-testid="explorer-route">Explorer route</div>,
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
})
