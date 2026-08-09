import { screen } from '@testing-library/react'
import React from 'react'
import {
  describe,
  expect,
  it,
  vi,
} from 'vitest'

import { renderWithProviders } from '../test/render-with-providers'
import { ExplorerLayout } from '@/components/explorer-layout'

vi.mock('@/components/navigation-island', () => ({
  NavigationIsland: () => <nav data-testid="navigation-island" />,
}))

describe('ExplorerLayout', () => {
  it('renders the padded explorer-content-shell by default', () => {
    renderWithProviders(
      <ExplorerLayout>
        <div data-testid="page-content">page</div>
      </ExplorerLayout>,
    )

    const shell = screen.getByTestId('explorer-content-shell')
    expect(shell).toHaveClass('pl-[280px]')
    expect(shell).toHaveClass('max-lg:pl-[260px]')
    expect(shell.querySelector('[data-testid="page-content"]')).not.toBeNull()
  })

  it('omits the explorer-content-shell when padded={false}', () => {
    renderWithProviders(
      <ExplorerLayout padded={false}>
        <div data-testid="page-content">page</div>
      </ExplorerLayout>,
    )

    expect(screen.queryByTestId('explorer-content-shell')).not.toBeInTheDocument()
    expect(screen.getByTestId('page-content')).toBeInTheDocument()
  })

  it('always mounts the NavigationIsland', () => {
    renderWithProviders(
      <ExplorerLayout>
        <div />
      </ExplorerLayout>,
    )

    expect(screen.getByTestId('navigation-island')).toBeInTheDocument()
  })
})
