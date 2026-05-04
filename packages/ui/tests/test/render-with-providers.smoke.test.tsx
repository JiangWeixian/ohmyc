import { screen } from '@testing-library/react'
import React from 'react'
import {
  describe,
  expect,
  it,
} from 'vitest'

import { renderWithProviders } from './render-with-providers'

function SmokeComponent() {
  return <div>provider smoke test</div>
}

describe('renderWithProviders', () => {
  it('renders a component through the shared test wrapper', () => {
    renderWithProviders(<SmokeComponent />)

    expect(screen.getByText('provider smoke test')).toBeInTheDocument()
  })
})
